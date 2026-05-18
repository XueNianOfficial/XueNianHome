<!--
============================================================
  雪年个人网站 - 博客列表页
  展示所有博客文章的卡片列表，按日期倒序排列
============================================================
-->
<template>
  <div class="page-blog">
    <div class="container-page">
      <!-- 页面标题 -->
      <header class="page-header">
        <h1 class="section-title">📝 博客</h1>
        <p class="section-subtitle">记录创作、技术和生活的点点滴滴</p>
      </header>

      <!-- 加载状态 -->
      <div v-if="status === 'pending'" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="status === 'error'" class="error-state">
        <p>加载失败，请刷新页面重试</p>
      </div>

      <!-- 文章列表 -->
      <div v-else class="blog-grid">
        <BlogCard
          v-for="post in posts"
          :key="post.slug"
          :post="post"
        />

        <!-- 空状态 -->
        <div v-if="posts.length === 0" class="empty-state">
          <p class="empty-icon">📭</p>
          <p>还没有文章，敬请期待！</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 博客列表页
 * 通过 API 调用获取所有博客文章
 * 排除草稿，按日期倒序排列
 */
import type { BlogPostMeta } from '~/types'

useHead({
  title: '博客'
})

/** 从 API 获取博客文章列表 */
const { data: postsData, status } = await useAsyncData('blog-posts', () => {
  return $fetch<{ success: boolean; data: (BlogPostMeta & { slug: string })[] }>('/api/blog/list')
})

/** 提取文章列表，空数组兜底 */
const posts = computed(() => postsData.value?.data || [])
</script>

<style scoped>
/* ---------- 页面标题 ---------- */
.page-header {
  text-align: center;
  margin-bottom: 48px;
}

/* ---------- 博客网格 ---------- */
.blog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

/* ---------- 加载状态 ---------- */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--color-text-muted);
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ---------- 错误状态 ---------- */
.error-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--color-text-muted);
}

/* ---------- 空状态 ---------- */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 80px 20px;
  color: var(--color-text-muted);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .blog-grid {
    grid-template-columns: 1fr;
  }
}
</style>
