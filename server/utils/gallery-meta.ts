/**
 * ============================================================
 *  画廊元数据存储
 *  将图片的标题、描述、分类持久化到 JSON 文件
 * ============================================================
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const META_FILE = join(process.cwd(), 'server/data/gallery-meta.json')

/** 单张图片的元数据 */
export interface GalleryImageMeta {
  /** 图片标题 */
  title: string
  /** 图片描述 */
  description: string
  /** 图片分类 */
  category: string
}

/** 所有图片的元数据映射：filename -> meta */
type GalleryMetaMap = Record<string, GalleryImageMeta>

/**
 * 读取全部元数据
 */
export function loadGalleryMeta(): GalleryMetaMap {
  try {
    if (!existsSync(META_FILE)) return {}
    const raw = readFileSync(META_FILE, 'utf-8')
    return JSON.parse(raw) as GalleryMetaMap
  } catch {
    console.error('读取画廊元数据文件失败')
    return {}
  }
}

/**
 * 保存全部元数据
 */
function saveGalleryMeta(meta: GalleryMetaMap): void {
  try {
    const dir = join(process.cwd(), 'server/data')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf-8')
  } catch (e) {
    console.error('保存画廊元数据失败：', e)
    throw createError({ statusCode: 500, message: '保存元数据失败' })
  }
}

/**
 * 获取单张图片的元数据
 */
export function getImageMeta(filename: string): GalleryImageMeta | null {
  const meta = loadGalleryMeta()
  return meta[filename] || null
}

/**
 * 更新或创建单张图片的元数据
 */
export function setImageMeta(filename: string, data: Partial<GalleryImageMeta>): GalleryImageMeta {
  const meta = loadGalleryMeta()
  const existing = meta[filename] || { title: filename.replace(/\.[^.]+$/, ''), description: '', category: 'other' }
  meta[filename] = { ...existing, ...data }
  saveGalleryMeta(meta)
  return meta[filename]
}

/**
 * 删除单张图片的元数据
 */
export function removeImageMeta(filename: string): void {
  const meta = loadGalleryMeta()
  delete meta[filename]
  saveGalleryMeta(meta)
}
