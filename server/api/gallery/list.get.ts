/**
 * GET /api/gallery/list
 * 公开接口：列出 public/images/ 下的所有图片
 */
import { loadGalleryMeta } from '../../utils/gallery-meta'
import { getPublicImagesDir } from '../../utils/image-dir'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

export default defineEventHandler(async () => {
  const imgDir = getPublicImagesDir()
  if (!existsSync(imgDir)) return { success: true, data: [] }

  const files = await readdir(imgDir)
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico']

  const metaMap = loadGalleryMeta()

  const images = await Promise.all(
    files
      .filter(f => imageExts.some(ext => f.toLowerCase().endsWith(ext)))
      .map(async (filename) => {
        const filePath = join(imgDir, filename)
        const stats = await stat(filePath)
        const meta = metaMap[filename]
        return {
          src: `/images/${filename}`,
          title: meta?.title || filename.replace(/\.[^.]+$/, ''),
          description: meta?.description || '',
          category: meta?.category || 'other',
          filename,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString()
        }
      })
  )

  images.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))

  return { success: true, data: images }
})
