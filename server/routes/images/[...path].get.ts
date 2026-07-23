/**
 * ============================================================
 *  图片路由 - GET /images/**:path
 *  动态提供任意嵌套层级的图片文件
 *  解决生产构建后新增子目录中的图片无法访问的问题
 *  生产环境从 .output/public/images/ 读取，失败回退 public/images/
 *  均失败则返回 404
 * ============================================================
 */
import { IMAGE_MIME_MAP } from '../../utils/image-dir'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { existsSync } from 'node:fs'

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') return

  const path = getRouterParam(event, 'path')
  if (!path) return

  // 安全：防止路径穿越攻击
  if (path.includes('..')) {
    throw createError({ statusCode: 400, message: '非法的文件路径' })
  }

  // 尝试多个可能的目录（按优先级）
  const dirs = [
    join(process.cwd(), '.output', 'public', 'images'),
    join(process.cwd(), 'public', 'images')
  ]

  let data: Buffer | null = null
  for (const dir of dirs) {
    const fp = join(dir, path)
    if (existsSync(fp)) {
      try {
        data = await readFile(fp)
        break
      } catch {
        // 继续尝试下一个目录
      }
    }
  }

  if (!data) {
    // 文件不存在，返回 404
    throw createError({ statusCode: 404, message: '图片不存在' })
  }

  // 设置正确的 Content-Type
  const ext = extname(path).toLowerCase()
  const contentType = IMAGE_MIME_MAP[ext] || 'application/octet-stream'

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')

  return data
})
