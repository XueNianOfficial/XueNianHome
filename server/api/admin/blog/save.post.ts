/**
 * POST /api/admin/blog/save
 * 创建或更新博客文章
 */
import { requireAuth } from '../../../utils/admin-auth'
import { writeFile, unlink } from 'node:fs/promises'
import { mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 构建 YAML frontmatter 字符串
 */
function buildFrontmatter(meta: Record<string, any>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      lines.push(`${key}:`)
      for (const item of value) {
        lines.push(`  - ${item}`)
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    } else {
      lines.push(`${key}: ${String(value)}`)
    }
  }
  return lines.join('\n')
}

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const body = await readBody(event)
  const { slug, title, date, description, tags, cover, draft, body: content, oldSlug } = body

  if (!slug || !title) {
    throw createError({ statusCode: 400, message: 'slug 和 title 为必填项' })
  }

  const blogDir = join(process.cwd(), 'content/blog')
  if (!existsSync(blogDir)) mkdirSync(blogDir, { recursive: true })

  // 构建 frontmatter
  const frontmatter: Record<string, any> = { title }
  if (date) frontmatter.date = date
  if (description) frontmatter.description = description
  if (cover) frontmatter.cover = cover
  if (tags && tags.length > 0) frontmatter.tags = tags
  if (draft) frontmatter.draft = true

  const fmStr = buildFrontmatter(frontmatter)
  const fileContent = `---\n${fmStr}\n---\n\n${content || ''}`

  const filePath = join(blogDir, `${slug}.md`)

  // 如果 slug 变更，删除旧文件
  if (oldSlug && oldSlug !== slug) {
    const oldPath = join(blogDir, `${oldSlug}.md`)
    if (existsSync(oldPath)) await unlink(oldPath)
  }

  await writeFile(filePath, fileContent, 'utf-8')

  return { success: true, message: '保存成功' }
})
