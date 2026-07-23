/**
 * ============================================================
 *  POST /api/chat/draw
 *  AI 画图端点（火山方舟 seedream，默认 doubao-seedream-5-0-lite）
 *  请求体：{ prompt: string }  — 画面描述（≤500 字）
 *  响应：  { success: true, data: { url: '/images/chat/draw_xxx.jpg' } }
 *
 *  安全考量：
 *  - CSRF 防护（Double-Submit Cookie）
 *  - 按客户端 IP 内存限速（60 秒窗口最多 5 次），防止刷付费画图 API；
 *    服务重启后计数清零，与登录限速同为预期的内存态行为
 *  - prompt 长度限制，避免异常长提示词产生高额费用
 *
 *  落盘策略与 chat/upload 一致：同时写入 public/ 与 .output/public/，
 *  兼容开发（public/images）与生产（.output/public/images）两种图片目录
 *
 *  长连接保活：方舟出图约 30 秒，期间响应静默。线上曾出现用户经运营商
 *  网络访问时，静默长连接被中间网络设备掐断（nginx 499：客户端先断开，
 *  图片虽已落盘但用户收不到结果，前端只能报「画图失败」）。因此本端点
 *  立即下发 200 响应头，生成期间每 5 秒写入一个空格作为心跳（JSON 允许
 *  前导空白，客户端解析不受影响），保持连接持续有字节流动；
 *  X-Accel-Buffering: no 告知 nginx 不要缓冲本响应，否则心跳会被
 *  proxy_buffering 吞掉。
 *  代价：响应头发出后无法再改状态码——生成阶段的成功/失败统一以响应体
 *  的 success 字段表达；参数校验类错误（400/429/405）仍在此前按 HTTP
 *  状态码正常抛出。
 *
 *  可观测性：成功/失败都会写请求日志（含方舟原始错误体），
 *  管理后台「系统日志」可排查画图失败原因
 * ============================================================
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { randomBytes } from 'node:crypto'

/** 画面描述最大长度（字符） */
const PROMPT_MAX = 500

/** 限速窗口（毫秒）与窗口内最大请求次数 */
const RATE_WINDOW_MS = 60 * 1000
const RATE_MAX = 5

/** 内存限速表：IP -> 窗口内的请求时间戳列表 */
const drawAttempts = new Map<string, number[]>()

/**
 * 检查并记录一次画图请求；超出限速返回 false
 * 同时惰性清理过期时间戳，防止 Map 无限增长
 */
function checkDrawRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_WINDOW_MS
  const list = (drawAttempts.get(ip) || []).filter(ts => ts > windowStart)

  if (list.length >= RATE_MAX) {
    drawAttempts.set(ip, list)
    return false
  }

  list.push(now)
  drawAttempts.set(ip, list)
  return true
}

export default defineEventHandler(async (event) => {
  // 仅允许 POST 请求
  if (event.method !== 'POST') {
    throw createError({
      statusCode: 405,
      message: '仅支持 POST 请求'
    })
  }

  // CSRF 防护
  csrfProtection(event)

  // IP 限速（防刷付费 API）；命中限速也写日志——这是「自主画图失败」的高发原因，
  // 不记录的话管理后台排障时会完全看不到这类失败
  const ip = getClientIP(event)
  if (!checkDrawRateLimit(ip)) {
    logRequest({
      time: new Date().toISOString(),
      type: 'draw',
      error: { statusCode: 429, message: '画图太频繁啦，请一分钟后再试' },
      durationMs: 0
    })
    throw createError({
      statusCode: 429,
      message: '画图太频繁啦，请一分钟后再试'
    })
  }

  const body = await readBody(event)
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  // 会话 ID 仅用于日志关联（可选）
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.slice(0, 64) : undefined

  // 参考图片（可选）：支持 base64 data URL（用户上传）和 public/images/ 下的相对路径
  const rawRefs: unknown = body?.referenceImages
  let referenceImages: string[] | undefined

  if (Array.isArray(rawRefs) && rawRefs.length > 0) {
    const resolved: string[] = []
    const imagesDir = getPublicImagesDir()

    for (const ref of rawRefs) {
      if (typeof ref !== 'string' || !ref) continue
      // base64 data URL：直接使用
      if (ref.startsWith('data:image/')) {
        resolved.push(ref)
        continue
      }
      // 服务端相对路径（如 /images/立绘.png）→ 读本地文件转 base64
      if (ref.startsWith('/images/')) {
        try {
          // 安全：仅允许 public/images/ 下的文件，防路径遍历
          const relPath = ref.slice('/images/'.length)
          // 过滤危险字符（路径遍历、null 字节）
          if (/\.\.(?:[/\\]|$)|[\x00]/.test(relPath)) continue
          const filePath = join(imagesDir, relPath)
          if (!existsSync(filePath)) continue
          const ext = extname(filePath).toLowerCase()
          const mime = IMAGE_MIME_MAP[ext] || 'image/png'
          const fileBuffer = await readFile(filePath)
          const b64 = fileBuffer.toString('base64')
          resolved.push(`data:${mime};base64,${b64}`)
        } catch {
          // 读取失败静默跳过（文件可能不存在或损坏）
        }
      }
    }

    if (resolved.length > 0) {
      referenceImages = resolved
    }
  }

  if (!prompt) {
    throw createError({
      statusCode: 400,
      message: '请描述想画的画面'
    })
  }

  if (prompt.length > PROMPT_MAX) {
    throw createError({
      statusCode: 400,
      message: `画面描述过长，最多 ${PROMPT_MAX} 字`
    })
  }

  // 调用火山方舟画图 API（b64_json 模式，方舟临时 URL 仅 24h 有效，必须落盘）
  // 成功/失败都写请求日志（失败含方舟原始错误体），便于排查画图故障
  const startTime = Date.now()
  const imageCfg = getEffectiveSettings().imageGen
  const logRequestBase = {
    type: 'draw' as const,
    sessionId,
    model: imageCfg?.model,
    request: { prompt, size: imageCfg?.size || '2K', hasReferenceImage: referenceImages ? referenceImages.length : 0 }
  }

  // —— 长连接保活（见文件头注释）——
  // 立即下发 200 响应头，之后每 5 秒写一个空格心跳，防止静默约 30 秒的
  // 生成过程中连接被中间网络设备掐断。自此错误只能经响应体 success 字段表达。
  const res = event.node.res
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no'
  })
  const heartbeat = setInterval(() => {
    try {
      res.write(' ')
    } catch {
      // 连接已被客户端关闭，忽略写入错误（close 事件会清理定时器）
    }
  }, 5000)

  // 客户端中途断开（nginx 499 场景）：清理心跳并标记，结束时不再向死连接写数据；
  // 生成与落盘仍继续完成，保证请求日志完整（与既往行为一致）
  let clientGone = false
  res.on('close', () => {
    clientGone = true
    clearInterval(heartbeat)
  })

  /** 结束响应：仅在连接存活且未结束时写出最终 JSON */
  const finish = (payload: object) => {
    clearInterval(heartbeat)
    if (!clientGone && !res.writableEnded) {
      try {
        res.end(JSON.stringify(payload))
      } catch {
        // 连接刚好关闭，忽略
      }
    }
  }

  try {
    const { b64Json } = await generateImage(prompt, referenceImages)
    const buffer = Buffer.from(b64Json, 'base64')

    // 确保目录存在（开发目录）
    const chatImgDir = join(process.cwd(), 'public', 'images', 'chat')
    if (!existsSync(chatImgDir)) {
      await mkdir(chatImgDir, { recursive: true })
    }

    // 同时确保生产构建输出目录存在
    const buildImgDir = join(process.cwd(), '.output', 'public', 'images', 'chat')
    if (!existsSync(buildImgDir)) {
      await mkdir(buildImgDir, { recursive: true }).catch(() => {})
    }

    // 文件名重新生成（不信任任何外部输入），jpeg 格式见 generateImage 的 output_format
    const filename = `draw_${Date.now()}_${randomBytes(4).toString('hex')}.jpg`

    // 双写：源目录 + 构建输出目录（生产环境运行时直接读 .output）
    await writeFile(join(chatImgDir, filename), buffer)
    await writeFile(join(buildImgDir, filename), buffer).catch(() => {})

    // 成功日志（记录落盘 URL 与耗时，不记录 b64 数据本体）
    logRequest({
      ...logRequestBase,
      time: new Date(startTime).toISOString(),
      response: { url: `/images/chat/${filename}`, bytes: buffer.length },
      durationMs: Date.now() - startTime
    })

    finish({ success: true, data: { url: `/images/chat/${filename}` } })
  } catch (err: any) {
    logRequest({
      ...logRequestBase,
      time: new Date(startTime).toISOString(),
      error: { statusCode: err?.statusCode, message: err?.message || '画图失败', detail: err?.data?.detail },
      durationMs: Date.now() - startTime
    })
    // 响应头已发出，失败原因通过响应体 message 传达（前端读取展示）
    finish({ success: false, message: err?.message || '画图失败，请稍后重试' })
  }
  // 响应已手动结束，handler 返回 undefined，h3 不会重复处理该响应
})
