/**
 * ============================================================
 *  POST /api/chat/upload
 *  上传聊天图片，将 base64 转为文件存储，返回 URL
 *  请求体：{ images: string[] }  — base64 data URLs
 *  响应：  { success: true, urls: string[] }
 *
 *  目的：避免 base64 图片存入聊天记录 JSON，
 *        防止 localStorage / 服务端 JSON 体积过大导致保存失效
 * ============================================================
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

/** 允许的图片 MIME 类型 */
const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp'
}

/** 单张最大 10MB（base64 解码后） */
const MAX_SIZE = 10 * 1024 * 1024

export default defineEventHandler(async (event) => {
  // CSRF 防护
  csrfProtection(event)

  const body = await readBody(event)
  const { images } = body

  if (!images || !Array.isArray(images) || images.length === 0) {
    throw createError({
      statusCode: 400,
      message: '请提供有效的图片列表'
    })
  }

  // 确保目录存在
  const chatImgDir = join(process.cwd(), 'public', 'images', 'chat')
  if (!existsSync(chatImgDir)) {
    await mkdir(chatImgDir, { recursive: true })
  }

  // 同时确保 .output 目录存在（生产环境）
  const buildImgDir = join(process.cwd(), '.output', 'public', 'images', 'chat')
  if (!existsSync(buildImgDir)) {
    await mkdir(buildImgDir, { recursive: true }).catch(() => {})
  }

  const urls: string[] = []

  for (const dataUrl of images) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      continue // 跳过非 data URL
    }

    // 解析 data URL: data:image/png;base64,XXXXX
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/i)
    if (!match) continue

    const mime = match[1]!.toLowerCase()
    const ext = ALLOWED_MIME[mime]
    if (!ext) continue

    const base64Data = match[2]!
    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.length > MAX_SIZE) {
      throw createError({
        statusCode: 400,
        message: `图片过大 (${(buffer.length / 1024 / 1024).toFixed(1)}MB)，最大 10MB`
      })
    }

    // 生成唯一文件名
    const id = `${Date.now()}_${randomBytes(4).toString('hex')}`
    const filename = `chat_${id}.${ext}`

    // 写入源目录
    await writeFile(join(chatImgDir, filename), buffer)

    // 同时写入构建输出目录（兼容生产环境）
    await writeFile(join(buildImgDir, filename), buffer).catch(() => {})

    // 返回相对 URL
    urls.push(`/images/chat/${filename}`)
  }

  return { success: true, urls }
})
