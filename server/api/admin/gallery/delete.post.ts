/**
 * POST /api/admin/gallery/delete
 * 删除 public/images/ 下的图片
 */
import { requireAuth } from '../../../utils/admin-auth'
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

  const filePath = join(process.cwd(), 'public/images', filename)
  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: '文件不存在' })
  }

  await unlink(filePath)
  return { success: true, message: '删除成功' }
})
