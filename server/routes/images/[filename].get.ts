/**
 * GET /images/:filename
 * 动态提供图片文件（绕过 Nitro 构建时静态路由映射限制）
 * 生产环境：从 .output/public/images/ 读取
 * 开发环境：从 public/images/ 读取
 * 均失败则返回 404
 */
import { getPublicImagesDir } from '../../utils/image-dir'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { existsSync } from 'node:fs'

/** 扩展名 → MIME type 映射 */
const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

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
  const contentType = MIME_MAP[ext] || 'application/octet-stream'

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')

  return data
})
