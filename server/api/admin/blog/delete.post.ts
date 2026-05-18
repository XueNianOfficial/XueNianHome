/**
 * POST /api/admin/blog/delete
 * 删除博客文章
 */
import { requireAuth } from '../../../utils/admin-auth'
import { unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const { slug } = await readBody(event)
  if (!slug) throw createError({ statusCode: 400, message: 'slug 为必填项' })

  const filePath = join(process.cwd(), 'content/blog', `${slug}.md`)
  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: '文章不存在' })
  }

  await unlink(filePath)
  return { success: true, message: '删除成功' }
})
