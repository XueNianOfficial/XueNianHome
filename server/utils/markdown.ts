/**
 * ============================================================
 *  雪年个人网站 - Markdown 解析工具
 *  基于 markdown-it 的 Markdown 渲染 + frontmatter 解析
 *  内置内存缓存（5 分钟 TTL），避免重复文件读取
 * ============================================================
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import MarkdownIt from 'markdown-it'

// ---------- 类型定义 ----------

/** frontmatter 元数据（YAML-like 键值对） */
export interface FrontMatter {
  [key: string]: string | string[] | boolean | undefined
}

/** 解析后的 Markdown 文件（不含渲染 HTML） */
interface ParsedMarkdown {
  /** frontmatter 元数据 */
  frontmatter: FrontMatter
  /** Markdown 正文内容（不含 frontmatter） */
  content: string
}

/** 博客文章元数据（与 app/types 中的 BlogPostMeta 保持一致） */
export interface BlogPostMeta {
  title: string
  date: string
  description: string
  cover?: string | null
  tags?: string[]
  draft?: boolean
  slug: string
}

/** 博客文章完整数据（与 app/types 中的 BlogPost 保持一致） */
export interface BlogPost extends BlogPostMeta {
  content?: string        // 渲染后的 HTML
}

// ---------- 缓存系统 ----------

/** 缓存条目 */
interface CacheEntry<T> {
  data: T
  timestamp: number
}

/** 缓存 Map：key → { data, timestamp } */
const cache = new Map<string, CacheEntry<unknown>>()

/** 缓存过期时间：5 分钟 */
const CACHE_TTL = 5 * 60 * 1000

/**
 * 从缓存读取数据
 * @param key - 缓存键
 * @returns 缓存数据，过期或不存在返回 null
 */
function getCache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

/**
 * 写入缓存
 * @param key - 缓存键
 * @param data - 要缓存的数据
 */
function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// ---------- markdown-it 实例 ----------

/** markdown-it 渲染器（全局单例，安全配置） */
const md = new MarkdownIt({
  html: false,            // 安全：禁用原始 HTML
  linkify: true,          // 自动转换 URL 为链接
  typographer: true,      // 智能引号、破折号
  breaks: false           // 不将单个换行转为 <br>
})

// ---------- 配置 ----------

/** 博客内容根目录 */
const BLOG_CONTENT_DIR = join(process.cwd(), 'content', 'blog')

// ==================== 导出函数 ====================

/**
 * 获取所有博客文章列表（不含正文 HTML）
 * 自动跳过草稿，按日期倒序排列
 * 结果缓存 5 分钟
 * @returns 博客文章元数据列表
 */
export async function getAllBlogPosts(): Promise<BlogPostMeta[]> {
  const cacheKey = 'all_posts'
  const cached = getCache<BlogPostMeta[]>(cacheKey)
  if (cached) return cached

  try {
    const files = await readdir(BLOG_CONTENT_DIR)
    const mdFiles = files.filter(f => f.endsWith('.md'))

    const posts: BlogPostMeta[] = []

    for (const file of mdFiles) {
      const slug = file.replace('.md', '')
      const filePath = join(BLOG_CONTENT_DIR, file)
      const rawContent = await readFile(filePath, 'utf-8')
      const parsed = parseFrontmatter(rawContent)

      // 跳过草稿
      if (parsed.frontmatter.draft === true || parsed.frontmatter.draft === 'true') {
        continue
      }

      posts.push({
        slug,
        title: (parsed.frontmatter.title as string) || slug,
        date: (parsed.frontmatter.date as string) || '',
        description: (parsed.frontmatter.description as string) || '',
        cover: (parsed.frontmatter.cover as string) || null,
        tags: parseTags(parsed.frontmatter.tags),
        draft: false
      })
    }

    // 按日期倒序排列
    posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    setCache(cacheKey, posts)
    return posts
  } catch {
    return []
  }
}

/**
 * 获取单篇博客文章（含渲染后的 HTML）
 * 结果缓存 5 分钟
 * @param slug - 文章 slug
 * @returns 文章数据，未找到返回 null
 */
export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const cacheKey = `post_${slug}`
  const cached = getCache<BlogPost>(cacheKey)
  if (cached) return cached

  try {
    const filePath = join(BLOG_CONTENT_DIR, `${slug}.md`)
    const rawContent = await readFile(filePath, 'utf-8')
    const parsed = parseFrontmatter(rawContent)
    const html = md.render(parsed.content)

    const post: BlogPost = {
      slug,
      title: (parsed.frontmatter.title as string) || slug,
      date: (parsed.frontmatter.date as string) || '',
      description: (parsed.frontmatter.description as string) || '',
      cover: (parsed.frontmatter.cover as string) || null,
      tags: parseTags(parsed.frontmatter.tags),
      content: html,
      draft: parsed.frontmatter.draft === true || parsed.frontmatter.draft === 'true'
    }

    setCache(cacheKey, post)
    return post
  } catch {
    return null
  }
}

/**
 * 解析 Markdown frontmatter（YAML 格式的 --- 分隔块）
 * 供博客列表 API 和管理后台复用
 * @param raw - 原始 Markdown 文本
 * @returns 解析结果：frontmatter 元数据 + 正文内容
 */
export function parseFrontmatter(raw: string): ParsedMarkdown {
  const frontmatter: FrontMatter = {}
  let content = raw

  // 匹配 --- ... --- 块（兼容 Windows \r\n）
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (fmMatch) {
    const fmText = fmMatch[1]

    // 逐行解析 YAML-like 键值对
    for (const line of fmText.split('\n')) {
      const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/)
      if (kvMatch) {
        const key = kvMatch[1]
        let value: string | string[] | boolean = kvMatch[2].trim()

        // 空值 → 初始化为空数组（后续可填充列表项）
        if (value === '') {
          value = []
        } else if (value === 'true') {
          value = true
        } else if (value === 'false') {
          value = false
        }

        frontmatter[key] = value
      }

      // 处理数组项（- item）
      const arrMatch = line.match(/^\s*-\s+(.*)$/)
      if (arrMatch) {
        // 找最近的键作为数组名
        const keys = Object.keys(frontmatter)
        const lastKey = keys[keys.length - 1]
        if (lastKey && Array.isArray(frontmatter[lastKey])) {
          ;(frontmatter[lastKey] as string[]).push(arrMatch[1].trim())
        } else if (lastKey && frontmatter[lastKey] === '') {
          // 空字符串 → 初始化为数组
          frontmatter[lastKey] = [arrMatch[1].trim()]
        }
      }
    }

    content = raw.slice(fmMatch[0].length).trim()
  }

  return { frontmatter, content }
}

// ==================== 内部辅助函数 ====================

/**
 * 解析标签（支持数组或逗号分隔字符串）
 * @param tags - 标签数据
 * @returns 标签字符串数组
 */
function parseTags(tags: string | string[] | boolean | undefined): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags as string[]
  if (typeof tags === 'string') {
    return tags.split(',').map(t => t.trim()).filter(Boolean)
  }
  return []
}
