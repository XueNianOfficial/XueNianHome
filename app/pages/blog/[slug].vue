<!--
============================================================
  雪年个人网站 - 博客详情页
  根据 URL slug 动态加载对应的 Markdown 文章；
  正文为服务端 markdown-it 渲染好的 HTML（html:false，无 XSS 风险），
  排版样式通过 :deep() 选择器作用于 v-html 内容
============================================================
-->
<template>
  <div class="page-blog-detail">
    <div class="container-page">
      <!-- 加载状态：与文章结构一致的骨架屏 -->
      <div v-if="status === 'pending'" class="article-skeleton" aria-hidden="true">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-meta"></div>
        <div class="skeleton skeleton-cover"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line skeleton-line-short"></div>
      </div>

      <!-- 文章未找到 -->
      <div v-else-if="status === 'error' || !post" class="empty-state">
        <span class="empty-state-icon">😢</span>
        <h1 class="error-title">文章未找到</h1>
        <p>可能已被删除或链接有误</p>
        <NuxtLink to="/blog" class="btn-outline">返回博客列表</NuxtLink>
      </div>

      <!-- 文章内容 -->
      <article v-else class="blog-article">
        <!-- 顶部返回链接 -->
        <nav class="article-nav">
          <NuxtLink to="/blog" class="btn-ghost back-link">
            <span aria-hidden="true">←</span> 返回博客列表
          </NuxtLink>
        </nav>

        <!-- 文章头部：标题、元信息、封面 -->
        <header class="article-header">
          <h1 class="article-title">{{ post.title }}</h1>
          <div class="article-meta">
            <span class="meta-date">
              <span class="meta-icon" aria-hidden="true">📅</span>
              <time :datetime="post.date">{{ formatDate(post.date) }}</time>
            </span>
            <span v-if="post.tags?.length" class="meta-tags">
              <span
                v-for="tag in post.tags"
                :key="tag"
                class="badge"
              ># {{ tag }}</span>
            </span>
          </div>
        </header>

        <!-- 封面图 -->
        <img
          v-if="post.cover"
          :src="post.cover"
          :alt="post.title"
          class="article-cover"
          loading="eager"
        />

        <!-- 文章正文（服务端渲染的 HTML，排版样式见下方 :deep() 规则） -->
        <div class="article-content" v-html="post.content"></div>

        <!-- 文章底部导航 -->
        <footer class="article-footer">
          <NuxtLink to="/blog" class="btn-outline">
            ← 返回博客列表
          </NuxtLink>
        </footer>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 博客详情页 [slug].vue
 * 通过 API 获取单篇文章数据（服务端已渲染 Markdown 为 HTML）
 */
import type { BlogPostMeta } from '~/types'

const route = useRoute()
const slug = route.params.slug as string

/** 从 API 获取文章数据 */
const { data: postData, status } = await useAsyncData(`blog-${slug}`, () => {
  return $fetch<{ success: boolean; data: (BlogPostMeta & { slug: string; content: string }) | null }>(
    `/api/blog/${slug}`
  ).catch(() => ({ success: false, data: null }))
})

/** 文章数据 */
const post = computed(() => postData.value?.data || null)

// 动态设置页面标题
useHead({
  title: post.value?.title || '文章',
  meta: [
    {
      name: 'description',
      content: post.value?.description || '雪年的博客文章'
    }
  ]
})

/**
 * 格式化日期为中文格式
 * @param dateStr - YYYY-MM-DD 格式的日期字符串
 * @returns 中文格式日期，如 "2025年1月2日"
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${year}年${parseInt(month, 10)}月${parseInt(day, 10)}日`
}
</script>

<style scoped>
/* ---------- 文章容器 ---------- */
/* 长文阅读采用窄栏（760px），保证每行字数在舒适区间 */
.blog-article {
  max-width: 760px;
  margin: 0 auto;
  animation: fade-in-up var(--transition-slow) both;
}

/* ---------- 顶部返回链接 ---------- */
.article-nav {
  margin-bottom: var(--space-6);
}

.back-link {
  /* 抵消按钮内边距，让「←」与正文左缘对齐 */
  margin-left: calc(-1 * var(--space-4));
}

/* ---------- 文章头部 ---------- */
.article-header {
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--color-border-light);
}

.article-title {
  font-size: var(--text-3xl);
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-4);
}

.article-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.meta-date {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.meta-tags {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* ---------- 封面图 ---------- */
.article-cover {
  display: block;
  width: 100%;
  max-height: 420px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  margin-bottom: var(--space-8);
}

/* ============================================================
 *  文章正文排版（作用于 v-html 渲染的 Markdown HTML）
 *  - 只使用设计系统令牌，亮/暗双主题自动适配；
 *  - 代码块采用「反色」方案：背景取主文字色、文字取主背景色，
 *    亮色主题下为深色代码块，暗色主题下为浅色代码块，两侧均可读。
 * ============================================================ */
.article-content {
  font-size: var(--text-base);
  line-height: 1.85;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-12);
  overflow-wrap: break-word;
}

/* 正文首个元素不保留上间距，避免与封面之间出现双倍空隙 */
.article-content :deep(> :first-child) {
  margin-top: 0;
}

/* ---------- 标题层级 ---------- */
/* h2：一级小节标题，左侧品牌蓝竖线标记 */
.article-content :deep(h2) {
  position: relative;
  font-size: var(--text-2xl);
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text-primary);
  margin: var(--space-12) 0 var(--space-4);
  padding-left: var(--space-3);
}

.article-content :deep(h2)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.22em;
  bottom: 0.22em;
  width: 4px;
  border-radius: var(--radius-full);
  background: var(--color-accent-gradient);
}

.article-content :deep(h3) {
  font-size: var(--text-xl);
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text-primary);
  margin: var(--space-8) 0 var(--space-3);
}

.article-content :deep(h4) {
  font-size: var(--text-lg);
  font-weight: 600;
  line-height: 1.5;
  color: var(--color-text-primary);
  margin: var(--space-6) 0 var(--space-2);
}

/* ---------- 段落与行内元素 ---------- */
.article-content :deep(p) {
  margin: 0 0 var(--space-4);
}

.article-content :deep(strong) {
  color: var(--color-text-primary);
  font-weight: 700;
}

.article-content :deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  transition: color var(--transition-fast), text-decoration-color var(--transition-fast);
}

.article-content :deep(a:hover) {
  color: var(--color-accent-dark);
  text-decoration-color: currentColor;
}

/* ---------- 引用块：左侧品牌蓝边框 + 浅底色 ---------- */
.article-content :deep(blockquote) {
  margin: var(--space-6) 0;
  padding: var(--space-4) var(--space-6);
  border-left: 4px solid var(--color-accent);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  background: var(--color-accent-bg);
  color: var(--color-text-secondary);
}

/* 引用块内部段落不再叠加外边距 */
.article-content :deep(blockquote p:last-child) {
  margin-bottom: 0;
}

/* ---------- 行内代码：浅蓝底 + 品牌深色文字 ---------- */
.article-content :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.88em;
  padding: 0.15em 0.45em;
  border-radius: var(--radius-sm);
  background: var(--color-accent-bg);
  color: var(--color-accent-dark);
  overflow-wrap: break-word;
}

/* ---------- 代码块：反色深底（两主题均可读） ---------- */
.article-content :deep(pre) {
  margin: var(--space-6) 0;
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-md);
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  overflow-x: auto;
  font-size: var(--text-sm);
  line-height: 1.7;
  box-shadow: var(--shadow-sm);
}

/* 代码块内的 code 重置为透明底，继承块级配色 */
.article-content :deep(pre code) {
  font-family: var(--font-mono);
  font-size: inherit;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
}

/* ---------- 列表 ---------- */
.article-content :deep(ul),
.article-content :deep(ol) {
  padding-left: 1.5em;
  margin: 0 0 var(--space-4);
}

.article-content :deep(li) {
  margin-bottom: var(--space-2);
  line-height: 1.8;
}

/* 列表标记用强调色，增加精致感 */
.article-content :deep(li::marker) {
  color: var(--color-accent);
  font-weight: 600;
}

/* 嵌套列表缩小间距 */
.article-content :deep(li > ul),
.article-content :deep(li > ol) {
  margin: var(--space-2) 0 0;
}

/* ---------- 图片 ---------- */
.article-content :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: var(--space-6) auto;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

/* ---------- 分割线 ---------- */
.article-content :deep(hr) {
  border: none;
  height: 1px;
  background: var(--color-border);
  margin: var(--space-12) auto;
  width: 100%;
}

/* ---------- 表格：斑马纹 + 圆角外框，移动端可横向滚动 ---------- */
.article-content :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  margin: var(--space-6) 0;
  font-size: var(--text-sm);
}

.article-content :deep(th),
.article-content :deep(td) {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

.article-content :deep(thead th) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  font-weight: 600;
}

.article-content :deep(tbody tr:nth-child(even)) {
  background: var(--color-bg-tertiary);
}

/* ---------- 文章底部 ---------- */
.article-footer {
  text-align: center;
  padding: var(--space-8) 0 var(--space-12);
  border-top: 1px solid var(--color-border-light);
}

/* ---------- 加载骨架屏 ---------- */
.article-skeleton {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.skeleton-title {
  height: 2.2em;
  width: 70%;
}

.skeleton-meta {
  height: 1.2em;
  width: 40%;
  margin-bottom: var(--space-4);
}

.skeleton-cover {
  aspect-ratio: 2 / 1;
  border-radius: var(--radius-lg);
}

.skeleton-line {
  height: 1em;
}

.skeleton-line-short {
  width: 62%;
}

/* ---------- 错误状态 ---------- */
.error-title {
  font-size: var(--text-2xl);
  color: var(--color-text-primary);
  margin: 0;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .article-title {
    font-size: var(--text-2xl);
  }

  .article-content {
    font-size: var(--text-sm);
  }

  .article-content :deep(h2) {
    font-size: var(--text-xl);
    margin: var(--space-8) 0 var(--space-3);
  }

  .article-content :deep(h3) {
    font-size: var(--text-lg);
  }

  .article-content :deep(pre) {
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-xs);
  }
}
</style>
