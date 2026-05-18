/**
 * POST /api/admin/gallery/upload
 * 上传图片到 public/images/
 * 支持 multipart/form-data 上传
 */
import { requireAuth } from '../../../utils/admin-auth'
import { writeFile } from 'node:fs/promises'
import { mkdirSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const imgDir = join(process.cwd(), 'public/images')
  if (!existsSync(imgDir)) mkdirSync(imgDir, { recursive: true })

  // 读取 multipart form data
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: '请选择要上传的图片' })
  }

  const uploaded: string[] = []

  for (const part of formData) {
    if (!part.filename || !part.data) continue

    const ext = extname(part.filename).toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      throw createError({
        statusCode: 400,
        message: `不支持的文件类型: ${ext}，仅支持 ${ALLOWED_EXTS.join(', ')}`
      })
    }

    if (part.data.length > MAX_SIZE) {
      throw createError({
        statusCode: 400,
        message: `文件过大: ${part.filename}，最大 10MB`
      })
    }

    // 清理文件名
    const safeName = part.filename.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, '_')
    const filePath = join(imgDir, safeName)

    await writeFile(filePath, part.data)
    uploaded.push(safeName)
  }

  return { success: true, data: { uploaded }, message: `成功上传 ${uploaded.length} 个文件` }
})
