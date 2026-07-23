/**
 * ============================================================
 *  服务端请求日志 - AI 聊天 / AI 画图的可观测性
 *  - 每次 AI 请求追加一条 JSONL：server/data/logs/requests-YYYY-MM-DD.jsonl
 *  - 记录完整请求消息、API 原始输出 / 上游错误详情与耗时，
 *    供管理后台「系统日志」排查问题（如自主画图失败原因）
 *  - 脱敏：base64 图片数据替换、超长字符串截断、密钥类字段隐藏；
 *    日志在任何环节都不会记录 API Key
 *  - 保留 7 天（与聊天记录过期策略一致），定时自动清理
 *  - 仅管理员可通过 /api/admin/logs 接口查看
 * ============================================================
 */
import { appendFile, mkdir, readdir, readFile, stat, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** 日志目录（server/data 已 gitignore，不会误提交） */
const LOG_DIR = join(process.cwd(), 'server/data/logs')

/** 日志保留天数（与聊天记录 7 天过期一致） */
const LOG_RETENTION_DAYS = 7

/** 单字段最大字符数（超出截断，防止超长文本撑爆日志文件） */
const MAX_FIELD_LENGTH = 8000

/** 深度防御：脱敏递归最大层数 */
const MAX_SANITIZE_DEPTH = 8

/** 密钥类字段名（命中即整体隐藏；正常流程不会传入，属防御性处理） */
const SENSITIVE_KEY_PATTERN = /api[-_]?key|authorization|token|password|secret/i

/** 日志文件名中的日期格式（东八区，站长与上游 API 均在国内） */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** 日志类型：聊天 / 画图 */
export type RequestLogType = 'chat' | 'draw'

/** 单条请求日志结构 */
export interface RequestLogEntry {
  /** ISO 时间戳 */
  time: string
  type: RequestLogType
  /** 聊天会话 ID（前端生成，用于关联同一次会话的多条日志） */
  sessionId?: string
  /** 请求使用的预设名（空为默认预设） */
  preset?: string
  /** 实际生效的模型 ID */
  model?: string
  /** 附加能力开关（深度思考 / 联网搜索 / 自定义系统提示词，已经过 resolveChatOptions 校验） */
  options?: Record<string, unknown>
  /** 完整请求内容（聊天为消息列表，画图为提示词与参数） */
  request?: unknown
  /** API 输出（聊天为聚合正文/思考链/usage，画图为落盘图片 URL） */
  response?: unknown
  /** 错误信息；detail 为上游 API 原始错误体（不含密钥） */
  error?: { statusCode?: number; message: string; detail?: unknown }
  /** 请求耗时（毫秒） */
  durationMs: number
}

/** 日志文件概览（管理后台列表用） */
export interface LogFileInfo {
  /** 日期（YYYY-MM-DD） */
  date: string
  /** 日志条数 */
  count: number
  /** 文件大小（字节） */
  size: number
}

/**
 * 返回当前东八区日期字符串（YYYY-MM-DD）
 * 服务器系统时区通常为 UTC，固定 +8 偏移保证「某天日志」符合国内直觉
 */
function dateStr(d: Date = new Date()): string {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/**
 * 由日期拼日志文件路径；日期格式不合法时抛 400（防路径遍历）
 */
function logFilePath(date: string): string {
  if (!DATE_PATTERN.test(date)) {
    throw createError({ statusCode: 400, message: '日期格式不正确' })
  }
  return join(LOG_DIR, `requests-${date}.jsonl`)
}

/**
 * 递归脱敏：base64 图片替换、超长截断、密钥类字段隐藏
 * 任何进入日志的数据都必须经过此函数
 */
function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value == null || depth > MAX_SANITIZE_DEPTH) return value ?? null

  if (typeof value === 'string') {
    // data URL 形式的 base64 图片（体积大且无排障价值），整体替换
    if (value.startsWith('data:image/')) return '[base64 图片数据已省略]'
    if (value.length > MAX_FIELD_LENGTH) {
      return `${value.slice(0, MAX_FIELD_LENGTH)}…[已截断，原长 ${value.length} 字符]`
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeForLog(item, depth + 1))
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[已隐藏]' : sanitizeForLog(val, depth + 1)
    }
    return out
  }

  return value
}

/**
 * 追加一条请求日志（fire-and-forget）
 * 写失败只输出到控制台，绝不影响业务请求本身
 */
export function logRequest(entry: RequestLogEntry): void {
  const sanitized: RequestLogEntry = {
    ...entry,
    request: sanitizeForLog(entry.request),
    response: sanitizeForLog(entry.response),
    options: entry.options ? (sanitizeForLog(entry.options) as Record<string, unknown>) : undefined,
    error: entry.error
      ? { ...entry.error, detail: sanitizeForLog(entry.error.detail) }
      : undefined
  }
  const line = JSON.stringify(sanitized) + '\n'
  const file = join(LOG_DIR, `requests-${dateStr()}.jsonl`)

  ;(async () => {
    if (!existsSync(LOG_DIR)) {
      await mkdir(LOG_DIR, { recursive: true })
    }
    await appendFile(file, line, 'utf8')
  })().catch(e => console.error('[请求日志] 写入失败：', e?.message || e))
}

/**
 * 列出所有日志文件概览（按日期倒序，最新在前）
 */
export async function listLogFiles(): Promise<LogFileInfo[]> {
  if (!existsSync(LOG_DIR)) return []

  const files = (await readdir(LOG_DIR))
    .filter(f => /^requests-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .sort()
    .reverse()

  const result: LogFileInfo[] = []
  for (const file of files) {
    const filePath = join(LOG_DIR, file)
    const [content, fileStat] = await Promise.all([
      readFile(filePath, 'utf8').catch(() => ''),
      stat(filePath).catch(() => null)
    ])
    result.push({
      date: file.slice(9, 19),
      count: content ? content.trimEnd().split('\n').length : 0,
      size: fileStat?.size ?? 0
    })
  }
  return result
}

/**
 * 读取指定日期的日志条目（倒序，最新在前）
 * @param date - YYYY-MM-DD
 * @param opts.type - 按类型过滤（chat / draw），空为全部
 * @param opts.limit - 最大返回条数（默认 100，上限 500）
 */
export async function readLogEntries(
  date: string,
  opts: { type?: string; limit?: number } = {}
): Promise<RequestLogEntry[]> {
  const file = logFilePath(date)
  if (!existsSync(file)) return []

  const limit = Math.min(Math.max(1, opts.limit ?? 100), 500)
  const lines = (await readFile(file, 'utf8')).trimEnd().split('\n')

  const entries: RequestLogEntry[] = []
  // 从文件尾向前扫描，坏行跳过（可能因进程中断留下半行）
  for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
    try {
      const entry = JSON.parse(lines[i]) as RequestLogEntry
      if (opts.type && entry.type !== opts.type) continue
      entries.push(entry)
    } catch { /* 跳过损坏行 */ }
  }
  return entries
}

/**
 * 删除指定日期的日志文件；文件不存在返回 false
 */
export async function deleteLogFile(date: string): Promise<boolean> {
  const file = logFilePath(date)
  if (!existsSync(file)) return false
  await unlink(file)
  return true
}

/**
 * 清理超过保留期的日志文件（启动时 + 每 6 小时执行一次）
 */
async function cleanupOldLogs(): Promise<void> {
  if (!existsSync(LOG_DIR)) return

  // ISO 日期字符串的字典序即时间序，可直接比较
  const cutoff = dateStr(new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 3600 * 1000))
  for (const file of await readdir(LOG_DIR)) {
    const match = /^requests-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(file)
    if (match && match[1] < cutoff) {
      await unlink(join(LOG_DIR, file)).catch(() => {})
      console.log(`[请求日志] 已清理过期日志 ${file}`)
    }
  }
}

/** 定时器防重入标记（server/utils 模块在 Nitro 中为单例） */
let timerStarted = false

/**
 * 启动日志定时清理任务（由 Nitro 插件调用一次）
 */
export function startLogCleanupTimer(): void {
  if (timerStarted) return
  timerStarted = true
  cleanupOldLogs()
  // unref：定时器不阻止进程退出
  const timer = setInterval(cleanupOldLogs, 6 * 3600 * 1000)
  ;(timer as unknown as { unref?: () => void }).unref?.()
}
