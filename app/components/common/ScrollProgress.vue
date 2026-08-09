<template>
  <div class="scroll-progress" aria-hidden="true">
    <div ref="barRef" class="scroll-progress-bar"></div>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  ScrollProgress - 页面顶部滚动进度条
 *  - fixed 顶条 3px，渐变主色，scaleX 变换（只触发合成层）
 *  - scroll 事件经 rAF 节流，避免滚动期高频重绘
 *  - 位于页头之上（z-index 高于 --z-header），不拦截点击
 * ============================================================
 */

const barRef = ref<HTMLElement | null>(null)

let rafId: number | null = null

function updateBar(): void {
  rafId = null
  const el = barRef.value
  if (!el) return
  const doc = document.documentElement
  const max = doc.scrollHeight - doc.clientHeight
  const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
  el.style.transform = `scaleX(${progress})`
}

function onScroll(): void {
  if (rafId === null) rafId = requestAnimationFrame(updateBar)
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  updateBar()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<style scoped>
.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: calc(var(--z-header) + 10);
  pointer-events: none;
}

.scroll-progress-bar {
  width: 100%;
  height: 100%;
  background: var(--color-accent-gradient);
  transform-origin: left center;
  transform: scaleX(0);
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 8px rgba(74, 144, 217, 0.5);
}
</style>
