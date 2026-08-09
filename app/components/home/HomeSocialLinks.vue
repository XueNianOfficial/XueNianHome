<!--
============================================================
  首页 - 社交平台链接
  与页脚共用 app/data/social.ts 配置，胶囊按钮一排展示
  胶囊逐枚弹入（zoom + 递增延迟）
============================================================
-->
<template>
  <div class="social-links">
    <CommonScrollReveal
      v-for="(link, i) in socialLinks"
      :key="link.platform"
      direction="zoom"
      :delay="i * 70"
    >
      <a
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="social-pill"
        :style="{ '--platform-color': link.color }"
        :ref="magnetic.bind"
      >
        <span class="platform-dot" aria-hidden="true"></span>
        {{ link.platform }}
      </a>
    </CommonScrollReveal>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  HomeSocialLinks - 首页社交链接区
 *  - 数据来自 app/data/social.ts（与 AppFooter 共用同一份配置）
 *  - 每个平台的品牌色通过 CSS 变量 --platform-color 传入，
 *    用于小圆点与悬停边框染色（属于内容数据，非主题色）
 *  - 每枚胶囊独立 ScrollReveal：缩放弹入 + 70ms 递增延迟
 *  - 悬停磁吸：胶囊向指针轻微吸附、离开回弹（useMagnetic；
 *    内联 transform 接管后 CSS 上浮仅作无鼠标设备回退）
 * ============================================================
 */
import { socialLinks } from '~/data/social'

/** 胶囊磁吸（仅精确指针 + 未减弱动效时生效） */
const magnetic = useMagnetic({ strength: 0.35, maxOffset: 5 })
</script>

<style scoped>
/* ---------- 胶囊按钮排 ---------- */
.social-links {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.social-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 18px;
  border-radius: var(--radius-full);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  box-shadow: var(--shadow-sm);
  transition:
    transform var(--transition-spring),
    box-shadow var(--transition-normal),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

/* 悬停：上浮 + 边框染上平台品牌色 */
.social-pill:hover {
  transform: translateY(-3px);
  border-color: var(--platform-color, var(--color-accent));
  color: var(--color-text-primary);
  box-shadow: var(--shadow-md);
}

/* 平台色小圆点 */
.platform-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--platform-color, var(--color-accent));
}
</style>
