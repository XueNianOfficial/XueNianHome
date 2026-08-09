<!--
============================================================
  首页 - 最新博客文章
  展示最近三篇文章卡片（封面 + 日期 + 标题 + 摘要 + 标签）
  卡片逐张入场：左 / 上 / 右三个方向交替 + 递增延迟，打破线性队列感
============================================================
-->
<template>
  <div class="latest-posts">
    <div class="posts-grid">
      <CommonScrollReveal
        v-for="(post, i) in posts"
        :key="post.slug"
        :direction="CARD_DIRECTIONS[i % CARD_DIRECTIONS.length]"
        :delay="i * 110"
        class="post-cell"
      >
        <NuxtLink :to="`/blog/${post.slug}`" class="post-card card" :ref="tilt.bind">
          <!-- 封面：有封面图用图，无则用 accent 浅底 + emoji 占位 -->
          <div class="post-cover">
            <img v-if="post.cover" :src="post.cover" :alt="post.title" loading="lazy" />
            <span v-else class="cover-placeholder" aria-hidden="true">📖</span>
          </div>
          <div class="post-body">
            <p class="post-date">
              <span aria-hidden="true">📅</span>
              <time :datetime="post.date">{{ formatDate(post.date) }}</time>
            </p>
            <h3 class="post-title">{{ post.title }}</h3>
            <p class="post-desc">{{ post.description }}</p>
            <div v-if="post.tags?.length" class="post-tags">
              <span v-for="tag in post.tags.slice(0, 3)" :key="tag" class="badge">{{ tag }}</span>
            </div>
          </div>
        </NuxtLink>
      </CommonScrollReveal>
    </div>
    <div class="section-more">
      <NuxtLink to="/blog" class="btn-outline">查看全部文章 →</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  HomeLatestPosts - 首页最新博客文章
 *  - 数据由首页 SSR 拉取后经 props 传入（已截取前几条）
 *  - 日期格式与 BlogCard 保持一致（YYYY年M月D日）
 *  - 每张卡片独立 ScrollReveal：入场方向按「左/上/右」轮换，
 *    延迟递增 110ms，形成错落有致的非线性入场
 *  - 悬停 3D 倾斜 + 跟随指针的径向眩光（useTilt 写入 --glare-x/y，
 *    ::after 伪元素渲染；非精确指针设备回退为纯 CSS 上浮）
 * ============================================================
 */
import type { BlogPost } from '~/types'

/** 卡片 3D 倾斜（仅精确指针 + 未减弱动效时生效） */
const tilt = useTilt({ maxTilt: 6, lift: 6, scale: 1.02 })

defineProps<{
  /** 最新文章列表（建议不超过 3 条） */
  posts: BlogPost[]
}>()

/** 卡片入场方向轮换表 */
const CARD_DIRECTIONS = ['left', 'up', 'right'] as const

/** 格式化日期为中文格式（与 BlogCard 相同规则） */
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${year}年${parseInt(month, 10)}月${parseInt(day, 10)}日`
}
</script>

<style scoped>
/* ---------- 卡片网格 ---------- */
.posts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
  max-width: 1080px;
  margin: 0 auto;
}

/* reveal 包装层作为 grid 子项，需撑满列轨道以保持卡片等高 */
.post-cell {
  display: flex;
  flex-direction: column;
}

/* ---------- 文章卡片（在全局 .card 基础上叠加布局与动效） ---------- */
.post-card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  text-decoration: none;
  /* 填满 reveal 包装层，保证整行卡片等高 */
  height: 100%;
  transition:
    transform var(--transition-spring),
    box-shadow var(--transition-normal);
}

.post-card:hover {
  /* 3D 倾斜启用时由内联 transform 接管（含上浮），此处作无鼠标设备回退 */
  transform: translateY(-6px);
  box-shadow: var(--shadow-accent);
}

/* 眩光层：跟随 --glare-x/--glare-y 的径向高光（useTilt 逐帧写入变量），
   悬停淡入；overflow:hidden 将其裁进卡片圆角内 */
.post-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    320px circle at var(--glare-x, 50%) var(--glare-y, 50%),
    color-mix(in srgb, var(--color-accent-light) 22%, transparent) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity var(--transition-normal);
  pointer-events: none;
}

.post-card:hover::after {
  opacity: 1;
}

/* ---------- 封面（16:9 裁切，悬停时图片轻微放大） ---------- */
.post-cover {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--color-accent-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.post-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.post-card:hover .post-cover img {
  transform: scale(1.05);
}

.cover-placeholder {
  font-size: 3rem;
  opacity: 0.5;
}

/* ---------- 卡片正文 ---------- */
.post-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6) var(--space-6);
  flex: 1;
}

.post-date {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin: 0;
}

.post-title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  transition: color var(--transition-fast);
}

.post-card:hover .post-title {
  color: var(--color-accent);
}

/* 摘要最多两行，保持卡片视觉等高 */
.post-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin: 0;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.post-tags {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* ---------- 底部「查看全部」 ---------- */
.section-more {
  text-align: center;
  margin-top: var(--space-8);
}
</style>
