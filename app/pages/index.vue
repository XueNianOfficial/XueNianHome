<template>
  <div class="home-page">
    <!-- 全站极光彩带背景（fixed z-index:-1，亮/暗主题自动切换配色） -->
    <HomeAuroraBackground />

    <!-- 鼠标光晕与丝带拖尾（仅细指针设备启用，组件内部自行判断） -->
    <CommonCursorGlow />

    <!-- Hero 区域 -->
    <HomeHeroSection />

    <!-- 关于我简介区 -->
    <section class="about-section">
      <div class="container">
        <CommonScrollReveal direction="up">
          <div class="about-content">
            <h2 class="section-title">欢迎来到我的数字小窝</h2>
            <p>
              我是雪年，一只热爱艺术和技术的雪狼。
              在这里，我会分享我的画作、记录生活点滴、展示我的创作。
              希望这个小窝能给你带来温暖和灵感！
            </p>
            <p>
              我是一只喜欢画画和写代码的小狼。白天在代码的世界里打怪升级，
              晚上用画笔记录脑内的奇思妙想。偶尔也会在这里碎碎念，
              分享一些生活的碎片。
            </p>
            <p>
              你可以去<NuxtLink to="/blog" class="about-link">博客</NuxtLink>读读我的随笔，
              到<NuxtLink to="/gallery" class="about-link">画廊</NuxtLink>看看我的画作，
              或者<NuxtLink to="/chat" class="about-link">和我聊聊天</NuxtLink>。
            </p>
          </div>
        </CommonScrollReveal>
      </div>
    </section>

    <!-- 站点数据统计 -->
    <section class="stats-section">
      <div class="container">
        <CommonScrollReveal direction="zoom">
          <HomeStats :posts="postsCount" :artworks="artworksCount" :friends="friendsCount" />
        </CommonScrollReveal>
      </div>
    </section>

    <!-- 最新博客文章（标题自左侧入场，卡片在组件内部逐张交错入场） -->
    <section v-if="latestPosts.length" class="posts-section">
      <!-- 视差漂浮装饰：随滚动反向轻漂的爪印 -->
      <span ref="decoPawEl" class="float-deco float-deco--paw" aria-hidden="true">🐾</span>
      <div class="container">
        <CommonScrollReveal direction="left">
          <div class="section-head">
            <h2 class="section-title">📝 最新文章</h2>
            <p class="section-subtitle">最近写下的文字</p>
          </div>
        </CommonScrollReveal>
        <HomeLatestPosts :posts="latestPosts" />
      </div>
    </section>

    <!-- 画廊最新作品预览（标题自右侧入场，画作逐张弹入 + 错落网格） -->
    <section v-if="galleryPreview.length" class="gallery-section">
      <!-- 视差漂浮装饰：慢速跟随的雪花 -->
      <span ref="decoSnowEl" class="float-deco float-deco--snow" aria-hidden="true">❄️</span>
      <div class="container">
        <CommonScrollReveal direction="right">
          <div class="section-head">
            <h2 class="section-title">🖼️ 最新画作</h2>
            <p class="section-subtitle">涂涂抹抹的日常</p>
          </div>
        </CommonScrollReveal>
        <HomeGalleryPreview :images="galleryPreview" />
      </div>
    </section>

    <!-- 功能导航区 -->
    <section class="features-section">
      <div class="container">
        <CommonScrollReveal direction="up">
          <h2 class="section-title">✨ 探索更多</h2>
        </CommonScrollReveal>
        <CommonScrollReveal direction="up" :delay="120">
          <HomeFeatureCards />
        </CommonScrollReveal>
      </div>
    </section>

    <!-- 社交账号链接（标题弹入，胶囊在组件内部逐枚弹入） -->
    <section class="social-section">
      <!-- 视差漂浮装饰：反向轻漂的星星 -->
      <span ref="decoStarEl" class="float-deco float-deco--star" aria-hidden="true">✨</span>
      <div class="container">
        <CommonScrollReveal direction="zoom">
          <div class="section-head">
            <h2 class="section-title">🐾 找到我</h2>
            <p class="section-subtitle">在这些地方也能看到我</p>
          </div>
        </CommonScrollReveal>
        <HomeSocialLinks />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  首页 - 站点门面
 *  - Hero 区（3D 视差立绘 / 流光标题 / 轮播标签语 / 光晕滚动视差）
 *  - 关于简介、数据统计、最新文章、画廊预览、功能导航、社交链接
 *  - 非线性动效：各区块入场方向交替（左/右/缩放/上浮）、
 *    卡片逐张交错入场、缓动带轻微过冲回弹、装饰元素滚动视差
 *  - 鼠标光晕 + Canvas 丝带拖尾（尊重 prefers-reduced-motion）
 *  - AuroraBackground 极光彩带背景（fixed 底层，配色走 --aurora-* 令牌）
 *  - 数据统一在此通过 useFetch 拉取，再以 props 传给各内容区组件
 * ============================================================
 */
import type { BlogPost, GalleryImage, FriendLink } from '~/types'

useHead({
  title: '首页',
  meta: [
    {
      name: 'description',
      content: '雪年的个人网站 - 分享艺术、技术与生活',
    },
  ],
})

// 列表接口统一响应结构
interface ApiListResponse<T> {
  success: boolean
  data: T
}

// 并行拉取三类公开数据（SSR 友好，失败时兜底为空数组）
const { data: blogRes } = await useFetch<ApiListResponse<BlogPost[]>>('/api/blog/list')
const { data: galleryRes } = await useFetch<ApiListResponse<GalleryImage[]>>('/api/gallery/list')
const { data: friendsRes } = await useFetch<ApiListResponse<FriendLink[]>>('/api/friends')

const allPosts = computed<BlogPost[]>(() =>
  blogRes.value?.success ? blogRes.value.data : [],
)
const allImages = computed<GalleryImage[]>(() =>
  galleryRes.value?.success ? galleryRes.value.data : [],
)
const allFriends = computed<FriendLink[]>(() =>
  friendsRes.value?.success ? friendsRes.value.data : [],
)

// 首页只展示最新几篇 / 几幅
const latestPosts = computed(() => allPosts.value.slice(0, 3))
const galleryPreview = computed(() => allImages.value.slice(0, 6))

// 统计数字
const postsCount = computed(() => allPosts.value.length)
const artworksCount = computed(() => allImages.value.length)
const friendsCount = computed(() => allFriends.value.length)

// ---------- 漂浮装饰的滚动视差（负系数 = 反向轻漂，正系数 = 慢速跟随） ----------
const decoPawEl = useParallax(-0.08)
const decoSnowEl = useParallax(0.1)
const decoStarEl = useParallax(-0.06)
</script>

<style scoped>
.section-title {
  font-size: var(--text-3xl);
  text-align: center;
  color: var(--color-text-primary);
  margin-bottom: var(--space-6);
}

.section-head {
  text-align: center;
  margin-bottom: var(--space-8);
}

.section-head .section-title {
  margin-bottom: var(--space-2);
}

.section-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--text-base);
  margin: 0;
}

/* 关于我简介区 */
.about-section {
  padding: var(--space-12) 0 0;
}

.about-content {
  max-width: 700px;
  margin: 0 auto;
  text-align: center;
}

.about-content p {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin-bottom: var(--space-4);
}

.about-link {
  color: var(--color-accent);
  text-decoration: none;
  font-weight: 500;
  margin: 0 var(--space-1);
  transition: color var(--transition-fast);
}

.about-link:hover {
  color: var(--color-accent-dark);
  text-decoration: underline;
}

/* 数据统计区 */
.stats-section {
  padding: var(--space-8) 0 0;
}

/* 最新文章 / 画廊预览 / 社交区（relative 供漂浮装饰定位） */
.posts-section,
.gallery-section,
.social-section {
  position: relative;
  padding: var(--space-12) 0 0;
}

/* 功能导航区 */
.features-section {
  padding: var(--space-12) 0 0;
}

.features-section .section-title {
  margin-bottom: var(--space-8);
}

/* 社交区收尾留白 */
.social-section {
  padding-bottom: var(--space-8);
}

/* ---------- 漂浮装饰：超大 emoji 低透明度，随滚动视差漂移 ---------- */
.float-deco {
  position: absolute;
  font-size: 7rem;
  opacity: 0.06;
  pointer-events: none;
  user-select: none;
  will-change: transform;
}

.float-deco--paw {
  top: var(--space-8);
  right: 6%;
}

.float-deco--snow {
  top: var(--space-4);
  left: 5%;
  font-size: 6rem;
}

.float-deco--star {
  top: 0;
  right: 10%;
  font-size: 5rem;
}

/* 窄屏隐藏漂浮装饰，避免与正文争夺注意力 */
@media (max-width: 860px) {
  .float-deco {
    display: none;
  }
}
</style>
