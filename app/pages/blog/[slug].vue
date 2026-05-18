<!--
============================================================
  雪年个人网站 - 博客详情页
  根据 URL slug 动态加载对应的 Markdown 文章
============================================================
-->
<template>
  <div class="page-blog-detail">
    <div class="container-page">
      <!-- 加载状态 -->
      <div v-if="status === 'pending'" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载文章...</p>
      </div>

      <!-- 文章未找到 -->
      <div v-else-if="status === 'error' || !post" class="error-state">
        <h1>😢 文章未找到</h1>
        <p>可能已被删除或链接有误</p>
        <NuxtLink to="/blog" class="btn-outline">返回博客列表</NuxtLink>
      </div>

      <!-- 文章内容 -->
      <article v-else class="blog-article">
        <!-- 文章头部 -->
        <header class="article-header">
          <h1 class="article-title">{{ post.title }}</h1>
          <div class="article-meta">
            <span class="meta-date">
              <span class="meta-icon">📅</span>
              {{ formatDate(post.date) }}
            </span>
            <span v-if="post.tags?.length" class="meta-tags">
              <span
                v-for="tag in post.tags"
                :key="tag"
                class="blog-tag"
              >#{{ tag }}</span>
            </span>
          </div>
          <!-- 封面图 -->
          <img
            v-if="post.cover"
            :src="post.cover"
            :alt="post.title"
            class="article-cover"
            loading="eager"
          />
        </header>

        <!-- 文章正文（服务端渲染的 HTML） -->
        <div class="article-content">
          <div v-html="post.content"></div>
        </div>

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
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${year}年${parseInt(month)}月${parseInt(day)}日`
}</script>

<style scoped>
/* ---------- 文章容器 ---------- */
.blog-article {
  max-width: 800px;
  margin: 0 auto;
}

/* ---------- 文章头部 ---------- */
.article-header {
  margin-bottom: 40px;
}

.article-title {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--color-text-primary);
  margin: 0 0 16px;
  line-height: 1.3;
}

.article-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
  font-size: 0.95rem;
  color: var(--color-text-muted);
}

.meta-icon {
  margin-right: 2px;
}

.meta-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.blog-tag {
  font-size: 0.8rem;
  color: var(--color-accent);
  background: var(--color-accent-bg);
  padding: 3px 10px;
  border-radius: 20px;
}

.article-cover {
  width: 100%;
  border-radius: var(--radius-md);
  max-height: 400px;
  object-fit: cover;
}

/* ---------- 文章正文（Prose 样式） ---------- */
.article-content {
  margin-bottom: 48px;
}

/* 自定义 prose 样式 */
.article-content :deep(h2) {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 2rem 0 1rem;
  color: var(--color-text-primary);
}

.article-content :deep(h3) {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 1.5rem 0 0.8rem;
  color: var(--color-text-primary);
}

.article-content :deep(p) {
  line-height: 1.9;
  margin-bottom: 1.2rem;
  color: var(--color-text-secondary);
}

.article-content :deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.article-content :deep(blockquote) {
  border-left: 4px solid var(--color-accent);
  padding-left: 16px;
  margin: 1.5rem 0;
  color: var(--color-text-muted);
  font-style: italic;
}

.article-content :deep(code) {
  background: var(--color-bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: var(--font-mono);
}

.article-content :deep(pre) {
  background: var(--color-bg-tertiary);
  padding: 16px 20px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin: 1.5rem 0;
}

.article-content :deep(pre code) {
  background: none;
  padding: 0;
}

.article-content :deep(ul),
.article-content :deep(ol) {
  padding-left: 1.5rem;
  margin: 1rem 0;
  color: var(--color-text-secondary);
}

.article-content :deep(li) {
  margin-bottom: 0.5rem;
  line-height: 1.7;
}

.article-content :deep(img) {
  max-width: 100%;
  border-radius: var(--radius-sm);
  margin: 1.5rem 0;
}

/* ---------- 文章底部 ---------- */
.article-footer {
  text-align: center;
  padding: 40px 0 60px;
  border-top: 1px solid var(--color-border);
}

/* ---------- 加载/错误状态 ---------- */
.loading-state,
.error-state {
  text-align: center;
  padding: 100px 20px;
  color: var(--color-text-muted);
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: var(--color-text-primary);
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .article-title {
    font-size: 1.6rem;
  }

  .article-content :deep(h2) {
    font-size: 1.3rem;
  }
}
</style>
