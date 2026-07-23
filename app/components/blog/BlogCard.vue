<!--
============================================================
  雪年个人网站 - 博客卡片组件
  以卡片形式展示单篇文章的封面、标题、日期、摘要与标签；
  无封面时使用品牌蓝渐变占位，悬停时卡片上浮、封面轻微放大
============================================================
-->
<template>
  <NuxtLink :to="`/blog/${post.slug}`" class="blog-card card">
    <!-- 封面区：有封面显示图片，无封面显示渐变占位 -->
    <div class="blog-card-cover">
      <img
        v-if="post.cover"
        :src="post.cover"
        :alt="post.title"
        class="cover-img"
        loading="lazy"
        width="600"
        height="300"
      />
      <!-- 渐变占位封面：雪花点缀，呼应「雪年」主题 -->
      <div v-else class="cover-placeholder" aria-hidden="true">
        <span class="placeholder-icon">❄️</span>
      </div>
    </div>

    <!-- 文章信息 -->
    <div class="blog-card-body">
      <!-- 日期行 -->
      <p class="blog-card-date">
        <span class="date-icon" aria-hidden="true">📅</span>
        <time :datetime="post.date">{{ formatDate(post.date) }}</time>
      </p>

      <h2 class="blog-card-title">{{ post.title }}</h2>
      <p class="blog-card-desc">{{ post.description }}</p>

      <!-- 标签（如果有） -->
      <div v-if="post.tags && post.tags.length" class="blog-card-tags">
        <span
          v-for="tag in post.tags"
          :key="tag"
          class="badge"
        ># {{ tag }}</span>
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
 * @returns 中文格式日期，如 "2025年1月2日"
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${year}年${parseInt(month, 10)}月${parseInt(day, 10)}日`
}
</script>

<style scoped>
/* ---------- 卡片容器 ---------- */
.blog-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 入场动画：上浮淡入，延迟由列表页通过 inline style 阶梯设置 */
  animation: fade-in-up var(--transition-slow) both;
  transition:
    transform var(--transition-normal),
    box-shadow var(--transition-normal),
    border-color var(--transition-normal);
}

/* 悬停时整体上浮，阴影带一点品牌蓝的「光晕」 */
.blog-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-accent);
}

/* ---------- 封面区 ---------- */
/* 固定 2:1 宽高比，保证网格中所有卡片高度节奏一致 */
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

/* 悬停时封面轻微放大，营造「窥视窗口」的生动感 */
.blog-card:hover .cover-img {
  transform: scale(1.05);
}

/* 无封面时的渐变占位：品牌蓝渐变 + 居中的大雪花 */
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-gradient);
}

.placeholder-icon {
  font-size: 3rem;
  opacity: 0.85;
  transition: transform var(--transition-spring);
}

.blog-card:hover .placeholder-icon {
  transform: scale(1.12) rotate(-8deg);
}

/* ---------- 卡片正文 ---------- */
.blog-card-body {
  padding: var(--space-4) var(--space-6) var(--space-6);
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 日期行：弱化小字，日历图标点缀 */
.blog-card-date {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

.date-icon {
  font-size: var(--text-sm);
}

/* 标题：最多两行，超出省略 */
.blog-card-title {
  font-size: var(--text-xl);
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2);
  transition: color var(--transition-fast);

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 悬停时标题染上强调色，提示「可点击进入」 */
.blog-card:hover .blog-card-title {
  color: var(--color-accent);
}

/* 摘要：最多三行，flex:1 把标签行推到底部对齐 */
.blog-card-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin: 0 0 var(--space-4);
  flex: 1;

  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---------- 标签 ---------- */
.blog-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .blog-card-body {
    padding: var(--space-4) var(--space-4) var(--space-4);
  }

  .blog-card-title {
    font-size: var(--text-lg);
  }
}
</style>
