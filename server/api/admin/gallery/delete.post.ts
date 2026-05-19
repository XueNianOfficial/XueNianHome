/**
 * POST /api/admin/gallery/delete
 * 删除图片（同时清理源目录和构建输出目录）
 */
import { requireAuth } from '../../../utils/admin-auth'
import { getPublicImagesDir } from '../../../utils/image-dir'
import { unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const { filename } = await readBody(event)
  if (!filename) throw createError({ statusCode: 400, message: 'filename 为必填项' })

  // 安全检查：防止路径穿越
  if (filename.includes('..') || filename.includes('/')) {
    throw createError({ statusCode: 400, message: '非法的文件名' })
  }

  const imgDir = getPublicImagesDir()
  const filePath = join(imgDir, filename)

  // 同时清理源目录（开发环境）
  const sourcePath = join(process.cwd(), 'public', 'images', filename)

  const deleted: string[] = []
  if (existsSync(filePath)) {
    await unlink(filePath)
    deleted.push(filePath)
  }
  if (sourcePath !== filePath && existsSync(sourcePath)) {
    await unlink(sourcePath)
    deleted.push(sourcePath)
  }

  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: '文件不存在' })
  }

  return { success: true, message: '删除成功' }
})
