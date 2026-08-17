<!--
  ============================================================
  SplitReveal - 镜面破碎揭示效果
  内容从中心向两侧分裂展开的动画
  ============================================================
-->
<template>
  <div ref="containerRef" class="split-reveal" :class="{ 'is-visible': isVisible }">
    <div class="split-reveal-left">
      <slot />
    </div>
    <div class="split-reveal-right">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const containerRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)

onMounted(() => {
  if (!containerRef.value) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isVisible.value) {
          isVisible.value = true
        }
      })
    },
    { threshold: 0.2 }
  )

  observer.observe(containerRef.value)

  onUnmounted(() => observer.disconnect())
})
</script>

<style scoped>
.split-reveal {
  position: relative;
  overflow: hidden;
}

.split-reveal-left,
.split-reveal-right {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary);
  transition: transform 1.2s cubic-bezier(0.76, 0, 0.24, 1);
}

.split-reveal-left {
  clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
  transform: translateX(-100%);
}

.split-reveal-right {
  clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%);
  transform: translateX(100%);
}

.split-reveal.is-visible .split-reveal-left,
.split-reveal.is-visible .split-reveal-right {
  transform: translateX(0);
}

/* 创建内容的真实占位 */
.split-reveal::before {
  content: '';
  display: block;
  padding-bottom: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .split-reveal-left,
  .split-reveal-right {
    transform: none !important;
    transition: opacity 0.3s ease;
    opacity: 0;
  }

  .split-reveal.is-visible .split-reveal-left,
  .split-reveal.is-visible .split-reveal-right {
    opacity: 1;
  }
}
</style>
