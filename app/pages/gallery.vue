<!--
============================================================
  雪年个人网站 - 图片展示页
  响应式网格布局展示所有画作和图片
  支持点击放大预览（灯箱效果）
============================================================
-->
<template>
  <div class="page-gallery">
    <div class="container-page">
      <!-- 页面标题 -->
      <header class="page-header">
        <h1 class="section-title">🖼️ 画作展示</h1>
        <p class="section-subtitle">用画笔描绘毛茸茸的世界</p>
      </header>

      <!-- 加载状态 -->
      <div v-if="galleryLoading" class="loading-text">
        <p>加载中...</p>
      </div>

      <!-- 图片网格 -->
      <div v-else-if="galleryImages.length > 0" class="gallery-grid">
        <div
          v-for="image in galleryImages"
          :key="image.src"
          class="gallery-item card"
          @click="openLightbox(image)"
        >
          <div class="gallery-image-wrapper">
            <img
              :src="image.src"
              :alt="image.title"
              class="gallery-image"
              loading="lazy"
              decoding="async"
              width="400"
              height="300"
            />
            <div class="gallery-overlay">
              <span class="overlay-text">{{ image.title }}</span>
            </div>
          </div>
          <div class="gallery-caption">
            <h3 class="caption-title">{{ image.title }}</h3>
            <p v-if="image.description" class="caption-desc">{{ image.description }}</p>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <p>暂无图片</p>
      </div>

      <!-- 灯箱预览（点击放大） -->
      <Teleport to="body">
        <Transition name="lightbox">
          <div
            v-if="lightboxImage"
            class="lightbox-backdrop"
            @click.self="closeLightbox"
            @keydown.escape="closeLightbox"
          >
            <button class="lightbox-close" @click="closeLightbox" aria-label="关闭">
              ✕
            </button>
            <button class="lightbox-prev" @click.stop="prevImage" aria-label="上一张">
              ‹
            </button>
            <div class="lightbox-content">
              <img
                :src="lightboxImage.src"
                :alt="lightboxImage.title"
                class="lightbox-img"
              />
              <div class="lightbox-info">
                <h3>{{ lightboxImage.title }}</h3>
                <p v-if="lightboxImage.description">{{ lightboxImage.description }}</p>
              </div>
            </div>
            <button class="lightbox-next" @click.stop="nextImage" aria-label="下一张">
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
 * 展示 public/images/ 下的所有图片资源
 * 支持灯箱预览和键盘导航
 */
import type { GalleryImage } from '~/types'

useHead({
  title: '画作展示'
})

/** 图片列表（从 API 动态获取） */
const { data: galleryData, pending: galleryLoading, error: galleryError } = useFetch<{ success: boolean; data: GalleryImage[] }>('/api/gallery/list')

const galleryImages = computed<GalleryImage[]>(() => {
  if (galleryData.value?.success && galleryData.value.data) {
    return galleryData.value.data
  }
  return []
})

/** 灯箱状态 */
const lightboxIndex = ref<number>(-1)

/** 当前预览的图片 */
const lightboxImage = computed(() => {
  if (lightboxIndex.value < 0) return null
  return galleryImages.value[lightboxIndex.value]
})

/** 打开灯箱 */
function openLightbox(image: GalleryImage) {
  lightboxIndex.value = galleryImages.value.indexOf(image)
}

/** 关闭灯箱 */
function closeLightbox() {
  lightboxIndex.value = -1
}

/** 上一张 */
function prevImage() {
  lightboxIndex.value = (lightboxIndex.value - 1 + galleryImages.value.length) % galleryImages.value.length
}

/** 下一张 */
function nextImage() {
  lightboxIndex.value = (lightboxIndex.value + 1) % galleryImages.value.length
}

/** 键盘导航 */
function handleKeydown(e: KeyboardEvent) {
  if (lightboxIndex.value < 0) return
  if (e.key === 'Escape') closeLightbox()
  if (e.key === 'ArrowLeft') prevImage()
  if (e.key === 'ArrowRight') nextImage()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
/* ---------- 页面标题 ---------- */
.page-header {
  text-align: center;
  margin-bottom: 48px;
}

/* ---------- 图片网格 ---------- */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

/* ---------- 图片卡片 ---------- */
.gallery-item {
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--transition-normal);
}

.gallery-item:hover {
  transform: translateY(-3px);
}

.gallery-image-wrapper {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.gallery-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.gallery-item:hover .gallery-image {
  transform: scale(1.08);
}

/* 悬停遮罩 */
.gallery-overlay {
  position: absolute;
  inset: 0;
  background: rgba(74, 144, 217, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.gallery-item:hover .gallery-overlay {
  opacity: 1;
}

.overlay-text {
  color: #fff;
  font-weight: 600;
  font-size: 1.1rem;
}

/* 图片标题 */
.gallery-caption {
  padding: 14px 16px;
}

.caption-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 4px;
}

.caption-desc {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* ---------- 灯箱 ---------- */
.lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: none;
  font-size: 1.5rem;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast);
  z-index: 1;
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.4);
}

.lightbox-prev,
.lightbox-next {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: none;
  font-size: 2rem;
  width: 50px;
  height: 80px;
  cursor: pointer;
  transition: background var(--transition-fast);
  z-index: 1;
}

.lightbox-prev { left: 0; border-radius: 0 8px 8px 0; }
.lightbox-next { right: 0; border-radius: 8px 0 0 8px; }

.lightbox-prev:hover,
.lightbox-next:hover {
  background: rgba(255, 255, 255, 0.4);
}

.lightbox-content {
  max-width: 90vw;
  max-height: 85vh;
  text-align: center;
}

.lightbox-img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

.lightbox-info {
  color: #fff;
  margin-top: 16px;
}

.lightbox-info h3 {
  margin: 0 0 4px;
  font-size: 1.2rem;
}

.lightbox-info p {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.8;
}

/* 灯箱过渡动画 */
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.3s ease;
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .lightbox-prev,
  .lightbox-next {
    width: 36px;
    height: 60px;
    font-size: 1.5rem;
  }
}

/* ---------- 加载与空状态 ---------- */
.loading-text,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--color-text-muted);
  font-size: 1.05rem;
}
</style>
