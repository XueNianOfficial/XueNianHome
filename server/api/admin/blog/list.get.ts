/**
 * GET /api/admin/blog/list
 * 列出所有博客文章（含草稿）
 */
import { requireAuth } from '../../../utils/admin-auth'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { parseFrontmatter } from '../../../utils/markdown'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const blogDir = join(process.cwd(), 'content/blog')
  if (!existsSync(blogDir)) return { success: true, data: [] }

  const files = await readdir(blogDir)
  const mdFiles = files.filter(f => f.endsWith('.md'))

  const posts = await Promise.all(
    mdFiles.map(async (filename) => {
      const slug = filename.replace('.md', '')
      const raw = await readFile(join(blogDir, filename), 'utf-8')
      const { frontmatter, content } = parseFrontmatter(raw)

      return {
        slug,
        filename,
        title: frontmatter.title || slug,
        date: frontmatter.date || '',
        description: frontmatter.description || '',
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        cover: frontmatter.cover || '',
        draft: frontmatter.draft === true,
        body: content
      }
    })
  )

  posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return { success: true, data: posts }
})
