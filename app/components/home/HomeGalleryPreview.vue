<!--
============================================================
  首页 - 画廊预览
  最新六幅画作的错落方形网格，悬停放大并滑入标题遮罩
  中列整体下沉形成错落的非线性布局，图片逐张弹入
============================================================
-->
<template>
  <div class="gallery-preview">
    <div class="preview-grid">
      <div
        v-for="(image, i) in images"
        :key="image.src"
        class="preview-cell"
        :class="{ 'preview-cell--offset': i % 3 === 1 }"
      >
        <NuxtLink to="/gallery" class="preview-item" :title="image.title || '查看画廊'">
          <!-- 每张图片用不同种子，生成不同的碎片形状 -->
          <HomeImageShatter
            :src="image.src"
            :alt="image.title || '画廊作品'"
            :delay="i * 200"
            :seed="i * 137 + 42"
          />
          <!-- 悬停时从底部浮现的标题遮罩 -->
          <span class="item-overlay" aria-hidden="true">
            <span class="item-title">{{ image.title }}</span>
          </span>
        </NuxtLink>
      </div>
    </div>
    <div class="section-more">
      <NuxtLink to="/gallery" class="btn-outline">进入画廊 →</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  HomeGalleryPreview - 首页画廊预览
 *  - 数据由首页 SSR 拉取 /api/gallery/list 后经 props 传入
 *  - 图片 lazy 加载，避免首屏拉取全部大图
 *  - 桌面端中列下沉 1.5rem（--row-offset），网格不再死板对齐；
 *    每张图独立 ScrollReveal（zoom 弹入 + 递增延迟）
 * ============================================================
 */
import type { GalleryImage } from '~/types'

defineProps<{
  /** 预览图片列表（建议 6 张以内） */
  images: GalleryImage[]
}>()
</script>

<style scoped>
/* ---------- 方形图片网格（桌面端中列下沉，形成错落布局） ---------- */
.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  max-width: 960px;
  margin: 0 auto;
  /* 底部预留中列下沉的位移量，避免与下方按钮拥挤 */
  padding-bottom: var(--space-6);
}

/* reveal 包装层：中列（每行第 2 张）通过 --row-offset 整体下沉 */
.preview-cell:nth-child(3n + 2) {
  --row-offset: 1.5rem;
}

.preview-item {
  position: relative;
  display: block;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  /* 静态错落位移与悬停上浮共用同一 transform，互不覆盖 */
  transform: translateY(var(--row-offset, 0px));
  transition:
    transform var(--transition-spring),
    box-shadow var(--transition-normal);
}

.preview-item:hover {
  transform: translateY(calc(var(--row-offset, 0px) - 4px));
  /* 常规阴影 + 主色光晕描边（第二道阴影模拟 2px 发光描边） */
  box-shadow:
    var(--shadow-md),
    0 0 0 2px color-mix(in srgb, var(--color-accent) 55%, transparent);
}

.preview-item :deep(.image-shatter) {
  transition: transform var(--transition-slow);
}

.preview-item:hover :deep(.image-shatter) {
  transform: scale(1.06);
}

/* ---------- 标题遮罩：底部深色渐变，悬停时淡入 ---------- */
/* 遮罩固定在图片上，与亮/暗主题无关，统一用深色渐变保证文字可读 */
.item-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  padding: var(--space-3);
  background: linear-gradient(180deg, transparent 55%, var(--color-bg-mask) 100%);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.preview-item:hover .item-overlay {
  opacity: 1;
}

.item-title {
  color: #FFFFFF;
  font-size: var(--text-sm);
  font-weight: 600;
  /* 标题最多一行，超出省略 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- 底部「进入画廊」 ---------- */
.section-more {
  text-align: center;
  margin-top: var(--space-8);
}

/* ---------- 响应式：窄屏两列且取消错落（小屏错位易显凌乱） ---------- */
@media (max-width: 640px) {
  .preview-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
    padding-bottom: 0;
  }

  .preview-cell:nth-child(3n + 2) {
    --row-offset: 0px;
  }
}
</style>
