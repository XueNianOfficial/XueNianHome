/**
 * ============================================================
 *  POST /api/admin/gallery/upload
 *  上传图片到 public/images/（multipart/form-data）
 *  安全：requireAuth 鉴权 + csrfProtection 校验；
 *        扩展名白名单 + 单文件 50MB 上限；
 *        文件名经字符过滤重新净化（去除路径分隔符等特殊字符）
 * ============================================================
 */
import { requireAuth } from '../../../utils/admin-auth'
import { getPublicImagesDir } from '../../../utils/image-dir'
import { writeFile } from 'node:fs/promises'
import { mkdirSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

/** 允许的图片扩展名白名单 */
const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
/** 单文件最大 50MB（与 Nitro maxRequestBodySize 对齐） */
const MAX_SIZE = 50 * 1024 * 1024

export default defineEventHandler(async (event) => {
  requireAuth(event)
  csrfProtection(event)

  const imgDir = getPublicImagesDir()
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
        message: `文件过大: ${part.filename}，最大 50MB`
      })
    }

    // 清理文件名
    const safeName = part.filename.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, '_')
    const filePath = join(imgDir, safeName)

    await writeFile(filePath, part.data)

    // 同时写入源目录（兼容 dev/build 切换）
    const sourceDir = join(process.cwd(), 'public', 'images')
    if (imgDir !== sourceDir) {
      if (!existsSync(sourceDir)) mkdirSync(sourceDir, { recursive: true })
      await writeFile(join(sourceDir, safeName), part.data)
    }

    uploaded.push(safeName)
  }

  return { success: true, data: { uploaded }, message: `成功上传 ${uploaded.length} 个文件` }
})
