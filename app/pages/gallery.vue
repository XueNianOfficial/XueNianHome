<!--
============================================================
  雪年个人网站 - 图片展示页
  CSS columns 瀑布流展示画作（适配不一致的图片比例）
  支持分类胶囊筛选、灯箱预览（遮罩/ESC 关闭、左右切换）
============================================================
-->
<template>
  <div class="page-gallery">
    <div class="container-page">
      <!-- 页面标题 -->
      <header class="page-header">
        <h1 class="section-title">🖼️ 画廊</h1>
        <p class="section-subtitle">毛茸茸的世界w</p>
      </header>

      <!-- 分类筛选胶囊组（存在 2 个及以上分类时才显示） -->
      <nav
        v-if="!galleryLoading && categoryFilters.length > 1"
        class="filter-bar"
        aria-label="图片分类筛选"
      >
        <button
          class="filter-pill"
          :class="{ 'filter-pill--active': activeCategory === 'all' }"
          :aria-pressed="activeCategory === 'all'"
          @click="activeCategory = 'all'"
        >
          全部 <span class="pill-count">{{ galleryImages.length }}</span>
        </button>
        <button
          v-for="cat in categoryFilters"
          :key="cat"
          class="filter-pill"
          :class="{ 'filter-pill--active': activeCategory === cat }"
          :aria-pressed="activeCategory === cat"
          @click="activeCategory = cat"
        >
          {{ categoryLabel(cat) }} <span class="pill-count">{{ categoryCount(cat) }}</span>
        </button>
      </nav>

      <!-- 加载状态：模拟瀑布流比例的骨架屏 -->
      <div v-if="galleryLoading" class="gallery-masonry" aria-label="图片加载中">
        <div
          v-for="i in 8"
          :key="i"
          class="skeleton skeleton-item"
          :style="{ height: skeletonHeights[(i - 1) % skeletonHeights.length] }"
        ></div>
      </div>

      <!-- 图片瀑布流（key 绑定当前分类，切换筛选时重播入场动画） -->
      <div v-else-if="visibleImages.length > 0" :key="activeCategory" class="gallery-masonry">
        <figure
          v-for="(image, index) in visibleImages"
          :key="image.src"
          class="gallery-item card"
          :style="{ animationDelay: `${Math.min(index, 11) * 45}ms` }"
          role="button"
          tabindex="0"
          :aria-label="`查看大图：${image.title}`"
          @click="openLightbox(image)"
          @keydown.enter="openLightbox(image)"
        >
          <div class="gallery-image-wrapper">
            <img
              :src="image.src"
              :alt="image.title"
              class="gallery-image"
              loading="lazy"
              decoding="async"
            />
            <!-- 悬停遮罩 -->
            <div class="gallery-overlay">
              <span class="overlay-hint">🔍 查看大图</span>
            </div>
          </div>
          <figcaption class="gallery-caption">
            <div class="caption-row">
              <h3 class="caption-title">{{ image.title }}</h3>
              <span class="badge">{{ categoryLabel(image.category) }}</span>
            </div>
            <p v-if="image.description" class="caption-desc">{{ image.description }}</p>
          </figcaption>
        </figure>
      </div>

      <!-- 空状态（区分整站无图与当前分类无图） -->
      <div v-else class="empty-state">
        <p class="empty-state-icon">🖼️</p>
        <p>{{ activeCategory === 'all' ? '暂无图片' : '该分类下暂无图片' }}</p>
      </div>

      <!-- 灯箱预览（Teleport 到 body，避免受页面层叠上下文影响） -->
      <Teleport to="body">
        <Transition name="lightbox">
          <div
            v-if="lightboxImage"
            class="lightbox-backdrop"
            @click.self="closeLightbox"
          >
            <!-- 关闭按钮 -->
            <button class="lightbox-btn lightbox-close" aria-label="关闭" @click="closeLightbox">
              ✕
            </button>
            <!-- 上一张 -->
            <button class="lightbox-btn lightbox-prev" aria-label="上一张" @click.stop="prevImage">
              ‹
            </button>
            <!-- 大图与信息 -->
            <div class="lightbox-content">
              <!-- 大图加载中 / 加载失败的状态提示 -->
              <div v-if="lightboxLoading" class="lightbox-status">
                <span class="spinner" aria-label="加载中" />
              </div>
              <div v-else-if="lightboxError" class="lightbox-status lightbox-status-error">
                <span>⚠️ 图片加载失败</span>
                <button class="btn-outline btn-sm" @click.stop="retryLightbox">重试</button>
              </div>
              <img
                v-show="!lightboxLoading && !lightboxError"
                :key="`${lightboxImage.src}#${lightboxRetry}`"
                :src="lightboxImage.src"
                :alt="lightboxImage.title"
                class="lightbox-img"
                @load="lightboxLoading = false"
                @error="onLightboxError"
              />
              <div class="lightbox-info">
                <div class="lightbox-info-text">
                  <h3 class="lightbox-title">{{ lightboxImage.title }}</h3>
                  <p v-if="lightboxImage.description" class="lightbox-desc">
                    {{ lightboxImage.description }}
                  </p>
                </div>
                <span class="badge">{{ lightboxIndex + 1 }} / {{ visibleImages.length }}</span>
              </div>
            </div>
            <!-- 下一张 -->
            <button class="lightbox-btn lightbox-next" aria-label="下一张" @click.stop="nextImage">
              ›
            </button>
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 图片展示页
 * 数据来自 GET /api/gallery/list（src/title/description/category 等字段）
 * 支持分类筛选、灯箱预览（遮罩点击 / ESC 关闭、左右方向键切换）
 */
import type { GalleryImage } from '~/types'

useHead({
  title: '画廊'
})

/** 分类元信息：中文标签 + 筛选栏排序权重 */
const CATEGORY_META: Record<string, { label: string; order: number }> = {
  illustration: { label: '插画', order: 0 },
  avatar: { label: '头像', order: 1 },
  logo: { label: 'Logo', order: 2 },
  other: { label: '其他', order: 3 }
}

/** 骨架屏占位块的循环高度，模拟真实瀑布流的错落比例 */
const skeletonHeights = ['240px', '320px', '280px', '360px']

/** 图片列表（从 API 动态获取） */
const { data: galleryData, pending: galleryLoading } = useFetch<{ success: boolean; data: GalleryImage[] }>('/api/gallery/list')

const galleryImages = computed<GalleryImage[]>(() => {
  if (galleryData.value?.success && galleryData.value.data) {
    return galleryData.value.data
  }
  return []
})

/** 当前选中的分类（'all' 表示全部） */
const activeCategory = ref<string>('all')

/** 数据中出现过的分类，按预定义顺序排列（用于渲染筛选胶囊） */
const categoryFilters = computed<string[]>(() => {
  const present = new Set(galleryImages.value.map(img => img.category || 'other'))
  return [...present].sort((a, b) => {
    return (CATEGORY_META[a]?.order ?? 99) - (CATEGORY_META[b]?.order ?? 99)
  })
})

/** 当前筛选条件下可见的图片 */
const visibleImages = computed<GalleryImage[]>(() => {
  if (activeCategory.value === 'all') return galleryImages.value
  return galleryImages.value.filter(img => (img.category || 'other') === activeCategory.value)
})

/** 分类英文 key → 中文标签 */
function categoryLabel(category?: string): string {
  return CATEGORY_META[category || 'other']?.label ?? '其他'
}

/** 某分类下的图片数量（用于胶囊上的计数角标） */
function categoryCount(category: string): number {
  return galleryImages.value.filter(img => (img.category || 'other') === category).length
}

/** 灯箱状态：-1 表示关闭，否则为 visibleImages 中的下标 */
const lightboxIndex = ref<number>(-1)

/** 大图加载状态：加载中 / 加载失败（切换图片时重置） */
const lightboxLoading = ref(false)
const lightboxError = ref(false)

/** 当前预览的图片 */
const lightboxImage = computed(() => {
  if (lightboxIndex.value < 0) return null
  return visibleImages.value[lightboxIndex.value]
})

/** 大图加载失败 */
function onLightboxError() {
  lightboxLoading.value = false
  lightboxError.value = true
}

/** 加载失败后重试：通过 :key 变化强制重建 img 重新发起请求 */
const lightboxRetry = ref(0)
function retryLightbox() {
  lightboxLoading.value = true
  lightboxError.value = false
  lightboxRetry.value++
}

/** 切换图片时重置加载状态 */
watch(lightboxImage, () => {
  lightboxLoading.value = true
  lightboxError.value = false
})

/** 打开灯箱（在可见列表中定位，保证左右切换不越出筛选结果） */
function openLightbox(image: GalleryImage) {
  lightboxIndex.value = visibleImages.value.indexOf(image)
}

/** 关闭灯箱 */
function closeLightbox() {
  lightboxIndex.value = -1
}

/** 上一张（循环） */
function prevImage() {
  const len = visibleImages.value.length
  if (len === 0) return
  lightboxIndex.value = (lightboxIndex.value - 1 + len) % len
}

/** 下一张（循环） */
function nextImage() {
  const len = visibleImages.value.length
  if (len === 0) return
  lightboxIndex.value = (lightboxIndex.value + 1) % len
}

/** 切换筛选时关闭灯箱，避免下标错位 */
watch(activeCategory, () => closeLightbox())

/** 灯箱打开时锁定背景滚动 */
watch(lightboxIndex, (val) => {
  document.body.style.overflow = val >= 0 ? 'hidden' : ''
})

/** 键盘导航：ESC 关闭，左右方向键切换 */
function handleKeydown(e: KeyboardEvent) {
  if (lightboxIndex.value < 0) return
  if (e.key === 'Escape') closeLightbox()
  if (e.key === 'ArrowLeft') prevImage()
  if (e.key === 'ArrowRight') nextImage()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  // 兜底恢复背景滚动
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* ---------- 页面标题 ---------- */
.page-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

/* ---------- 分类筛选胶囊组 ---------- */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
  margin-bottom: var(--space-8);
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 8px 18px;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.filter-pill:hover {
  color: var(--color-accent);
  border-color: var(--color-accent-light);
  transform: translateY(-1px);
}

/* 选中态：品牌蓝渐变 + 发光阴影 */
.filter-pill--active,
.filter-pill--active:hover {
  color: var(--color-text-inverse);
  background: var(--color-accent-gradient);
  border-color: transparent;
  box-shadow: var(--shadow-accent);
}

.pill-count {
  font-size: var(--text-xs);
  opacity: 0.75;
}

/* ---------- 瀑布流布局（CSS columns，保留图片原始比例） ---------- */
.gallery-masonry {
  columns: 280px;
  column-gap: var(--space-6);
}

.skeleton-item {
  margin-bottom: var(--space-6);
  border-radius: var(--radius-lg);
}

/* ---------- 图片卡片 ---------- */
.gallery-item {
  display: block;
  margin: 0 0 var(--space-6);
  padding: 0;
  break-inside: avoid;       /* 防止卡片被截断到两列 */
  overflow: hidden;
  cursor: pointer;
  animation: fade-in-up var(--transition-slow) both;
}

.gallery-item:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}

.gallery-image-wrapper {
  position: relative;
  overflow: hidden;
}

.gallery-image {
  display: block;
  width: 100%;
  height: auto;              /* 保持原始纵横比，是瀑布流的关键 */
  transition: transform var(--transition-slow);
}

.gallery-item:hover .gallery-image {
  transform: scale(1.06);
}

/* 悬停遮罩：品牌蓝渐变 + 提示文字 */
.gallery-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-gradient);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.gallery-item:hover .gallery-overlay {
  opacity: 0.85;
}

.overlay-hint {
  color: var(--color-text-inverse);
  font-size: var(--text-sm);
  font-weight: 600;
}

/* 图片信息区 */
.gallery-caption {
  padding: var(--space-3) var(--space-4);
}

.caption-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.caption-title {
  margin: 0;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.caption-desc {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---------- 灯箱 ---------- */
.lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: var(--color-bg-mask);
  backdrop-filter: blur(6px);
}

/* 灯箱按钮统一基底：关闭 / 上一张 / 下一张 */
.lightbox-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    transform var(--transition-fast);
}

.lightbox-btn:hover {
  background: var(--color-bg-hover);
}

.lightbox-close {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: 40px;
  height: 40px;
  font-size: var(--text-lg);
}

.lightbox-close:hover {
  transform: scale(1.08);
}

.lightbox-prev,
.lightbox-next {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 64px;
  font-size: var(--text-2xl);
}

.lightbox-prev { left: var(--space-4); }
.lightbox-next { right: var(--space-4); }

.lightbox-prev:hover,
.lightbox-next:hover {
  transform: translateY(-50%) scale(1.06);
}

.lightbox-content {
  max-width: 90vw;
  animation: fade-in-up var(--transition-normal) both;
}

.lightbox-img {
  display: block;
  max-width: 100%;
  max-height: 72vh;
  object-fit: contain;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

/* 大图加载中 / 加载失败的状态占位（与图片同区域，避免灯箱跳动） */
.lightbox-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  min-width: min(480px, 80vw);
  min-height: 40vh;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

/* 底部信息条：复用卡片配色，保证亮/暗主题下都可读 */
.lightbox-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  text-align: left;
}

.lightbox-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}

.lightbox-desc {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* 灯箱过渡动画 */
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity var(--transition-normal);
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .gallery-masonry {
    columns: 2;
    column-gap: var(--space-3);
  }

  .gallery-item,
  .skeleton-item {
    margin-bottom: var(--space-3);
  }

  .lightbox-prev,
  .lightbox-next {
    width: 36px;
    height: 52px;
    font-size: var(--text-xl);
  }

  .lightbox-prev { left: var(--space-2); }
  .lightbox-next { right: var(--space-2); }
}
</style>
