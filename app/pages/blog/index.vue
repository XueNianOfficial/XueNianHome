<!--
============================================================
  雪年个人网站 - 博客列表页
  以卡片网格展示所有博客文章，按日期倒序排列；
  加载中显示骨架屏，无文章时显示空状态
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

      <!-- 加载状态：与真实卡片布局一致的骨架屏 -->
      <div v-if="status === 'pending'" class="blog-grid" aria-hidden="true">
        <div v-for="i in 6" :key="i" class="skeleton-card card">
          <div class="skeleton skeleton-cover"></div>
          <div class="skeleton-body">
            <div class="skeleton skeleton-line skeleton-line-sm"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line skeleton-line-md"></div>
            <div class="skeleton-footer">
              <div class="skeleton skeleton-badge"></div>
              <div class="skeleton skeleton-badge"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="status === 'error'" class="empty-state">
        <span class="empty-state-icon">😢</span>
        <p>加载失败，请刷新页面重试</p>
      </div>

      <!-- 文章列表：卡片依次上浮入场（阶梯延迟） -->
      <div v-else class="blog-grid">
        <BlogCard
          v-for="(post, index) in posts"
          :key="post.slug"
          :post="post"
          :style="{ animationDelay: `${Math.min(index, 8) * 70}ms` }"
        />

        <!-- 空状态 -->
        <div v-if="posts.length === 0" class="empty-state blog-empty">
          <span class="empty-state-icon">📭</span>
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
  margin-bottom: var(--space-12);
  animation: fade-in-up var(--transition-slow) both;
}

/* ---------- 博客网格 ---------- */
.blog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-6);
}

/* ---------- 加载骨架屏 ---------- */
/* 骨架卡片与真实卡片同构（封面 + 文字行 + 徽章），避免加载前后布局跳动 */
.skeleton-card {
  overflow: hidden;
}

.skeleton-cover {
  aspect-ratio: 2 / 1;
  border-radius: 0;
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6) var(--space-6);
}

.skeleton-line {
  height: 1em;
}

.skeleton-line-sm {
  width: 34%;
  height: 0.8em;
}

.skeleton-line-md {
  width: 72%;
}

.skeleton-footer {
  display: flex;
  gap: var(--space-2);
}

.skeleton-badge {
  width: 56px;
  height: 22px;
  border-radius: var(--radius-full);
}

/* ---------- 空状态 ---------- */
/* 占满整行，居中显示 */
.blog-empty {
  grid-column: 1 / -1;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .page-header {
    margin-bottom: var(--space-8);
  }

  .blog-grid {
    grid-template-columns: 1fr;
  }
}
</style>
