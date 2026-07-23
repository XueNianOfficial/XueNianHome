/**
 * ============================================================
 *  POST /api/admin/gallery/update
 *  更新图片的标题、描述、分类等元数据
 *  安全：requireAuth 鉴权 + csrfProtection 校验；
 *        filename 拒绝 ".." 与 "/"（防路径遍历）
 * ============================================================
 */
import { requireAuth } from '../../../utils/admin-auth'
import { setImageMeta } from '../../../utils/gallery-meta'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  csrfProtection(event)

  const { filename, title, description, category } = await readBody(event)
  if (!filename) throw createError({ statusCode: 400, message: 'filename 为必填项' })

  // 安全检查
  if (filename.includes('..') || filename.includes('/')) {
    throw createError({ statusCode: 400, message: '非法的文件名' })
  }

  const meta = setImageMeta(filename, { title, description, category })

  return { success: true, data: meta, message: '更新成功' }
})
