/**
 * ============================================================
 *  聊天图片路由 - GET /images/chat/:filename
 *  提供聊天上传图片的文件服务
 *  生产环境从 .output/public/images/chat/ 读取，失败回退 public/images/chat/
 *  均失败则不响应，交给后续处理器（404）
 * ============================================================
 */
import { IMAGE_MIME_MAP } from '../../../utils/image-dir'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { existsSync } from 'node:fs'

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') return

  const filename = getRouterParam(event, 'filename')
  if (!filename) return

  // 安全防护
  if (filename.includes('..') || filename.includes('/')) {
    throw createError({ statusCode: 400, message: '非法的文件名' })
  }

  // 尝试多个目录
  const dirs = [
    join(process.cwd(), '.output', 'public', 'images', 'chat'),
    join(process.cwd(), 'public', 'images', 'chat')
  ]

  let data: Buffer | null = null
  for (const dir of dirs) {
    const fp = join(dir, filename)
    if (existsSync(fp)) {
      try {
        data = await readFile(fp)
        break
      } catch { /* 继续尝试下一个 */ }
    }
  }

  if (!data) return // 404，交给下一个处理器

  const ext = extname(filename).toLowerCase()
  const contentType = IMAGE_MIME_MAP[ext] || 'application/octet-stream'

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=604800') // 7 天缓存
  return data
})
