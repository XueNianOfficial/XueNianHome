/**
 * GET /api/admin/gallery/list
 * 列出 public/images/ 下的所有图片
 */
import { requireAuth } from '../../../utils/admin-auth'
import { loadGalleryMeta } from '../../../utils/gallery-meta'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const imgDir = join(process.cwd(), 'public/images')
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
          filename,
          path: `/images/${filename}`,
          size: stats.size,
          sizeFormatted: formatSize(stats.size),
          modifiedAt: stats.mtime.toISOString(),
          title: meta?.title || filename.replace(/\.[^.]+$/, ''),
          description: meta?.description || '',
          category: meta?.category || 'other'
        }
      })
  )

  images.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))

  return { success: true, data: images }
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
