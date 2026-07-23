/**
 * ============================================================
 *  POST /api/admin/blog/delete
 *  删除博客文章（content/blog/{slug}.md），并清除对应缓存
 *  安全：requireAuth 鉴权 + csrfProtection 校验；
 *        slug 经字符白名单校验后才允许拼入文件路径（防路径遍历）
 * ============================================================
 */
import { requireAuth } from '../../../utils/admin-auth'
import { unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  csrfProtection(event)

  const { slug } = await readBody(event)
  if (!slug) throw createError({ statusCode: 400, message: 'slug 为必填项' })

  // 安全：slug 直接拼入文件路径，必须为安全字符（isSafeSlug 由 Nitro 自动导入）
  if (typeof slug !== 'string' || !isSafeSlug(slug)) {
    throw createError({ statusCode: 400, message: '非法的 slug' })
  }

  const filePath = join(process.cwd(), 'content/blog', `${slug}.md`)
  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: '文章不存在' })
  }

  await unlink(filePath)

  // 清除缓存，确保公开页面实时更新
  clearBlogCache(slug)

  return { success: true, message: '删除成功' }
})
