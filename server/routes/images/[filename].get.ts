/**
 * ============================================================
 *  图片路由 - GET /images/:filename
 *  动态提供图片文件（绕过 Nitro 构建时静态路由映射限制）
 *  生产环境从 .output/public/images/ 读取，失败回退 public/images/
 *  均失败则不响应，交给后续处理器（Nuxt 404 页）
 * ============================================================
 */
import { getPublicImagesDir, IMAGE_MIME_MAP } from '../../utils/image-dir'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { existsSync } from 'node:fs'

export default defineEventHandler(async (event) => {
  // 仅处理 GET 请求
  if (event.method !== 'GET') return

  const filename = getRouterParam(event, 'filename')
  if (!filename) return

  // 安全：防止路径穿越
  if (filename.includes('..') || filename.includes('/')) {
    throw createError({ statusCode: 400, message: '非法的文件名' })
  }

  // 查找文件
  const imgDir = getPublicImagesDir()
  const filePath = join(imgDir, filename)

  // 如果主目录找不到，尝试源目录
  const sourceDir = join(process.cwd(), 'public', 'images')
  const sourcePath = imgDir !== sourceDir ? join(sourceDir, filename) : null

  let data: Buffer
  try {
    if (existsSync(filePath)) {
      data = await readFile(filePath)
    } else if (sourcePath && existsSync(sourcePath)) {
      data = await readFile(sourcePath)
    } else {
      // 文件不存在，让请求继续传递给下一个处理器（Nuxt 404 页）
      return
    }
  } catch {
    return
  }

  // 设置正确的 Content-Type
  const ext = extname(filename).toLowerCase()
  const contentType = IMAGE_MIME_MAP[ext] || 'application/octet-stream'

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')

  return data
})
