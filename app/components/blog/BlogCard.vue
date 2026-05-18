<!--
============================================================
  雪年个人网站 - 博客卡片组件
  显示单篇文章的标题、日期、摘要，白色卡片 + 蓝色悬停效果
============================================================
-->
<template>
  <NuxtLink :to="`/blog/${post.slug}`" class="blog-card card">
    <!-- 封面图（如果有） -->
    <div v-if="post.cover" class="blog-card-cover">
      <img
        :src="post.cover"
        :alt="post.title"
        class="cover-img"
        loading="lazy"
        width="600"
        height="300"
      />
    </div>

    <!-- 文章信息 -->
    <div class="blog-card-body">
      <h2 class="blog-card-title">{{ post.title }}</h2>
      <p class="blog-card-date">
        <span class="date-icon">📅</span>
        {{ formatDate(post.date) }}
      </p>
      <p class="blog-card-desc">{{ post.description }}</p>

      <!-- 标签（如果有） -->
      <div v-if="post.tags && post.tags.length" class="blog-card-tags">
        <span
          v-for="tag in post.tags"
          :key="tag"
          class="blog-tag"
        >#{{ tag }}</span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
/**
 * BlogCard - 博客卡片组件
 * 接收 BlogPostMeta 数据，渲染为可点击的卡片链接
 */
import type { BlogPostMeta } from '~/types'

const props = defineProps<{
  post: BlogPostMeta & { slug: string }
}>()

/**
 * 格式化日期为中文格式
 * @param dateStr - YYYY-MM-DD 格式的日期字符串
 * @returns 中文格式日期，如 "2025年1月15日"
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${year}年${parseInt(month)}月${parseInt(day)}日`
}
</script>

<style scoped>
/* ---------- 卡片容器 ---------- */
.blog-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  overflow: hidden;
  transition: transform var(--transition-normal),
              box-shadow var(--transition-normal);
}

.blog-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-accent);
}

/* ---------- 封面图 ---------- */
.blog-card-cover {
  width: 100%;
  aspect-ratio: 2 / 1;
  overflow: hidden;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.blog-card:hover .cover-img {
  transform: scale(1.05);
}

/* ---------- 卡片正文 ---------- */
.blog-card-body {
  padding: 20px 24px 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.blog-card-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px;
  line-height: 1.4;

  /* 最多显示两行 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-card-date {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.date-icon {
  font-size: 0.9rem;
}

.blog-card-desc {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: 0 0 16px;
  flex: 1;

  /* 最多显示三行 */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---------- 标签 ---------- */
.blog-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.blog-tag {
  font-size: 0.8rem;
  color: var(--color-accent);
  background: var(--color-accent-bg);
  padding: 3px 10px;
  border-radius: 20px;
}
</style>
