<!--
  ============================================================
  ScrollParallaxCard - 滚动视差卡片
  卡片内容随滚动产生多层视差位移，营造3D立体感
  ============================================================
-->
<template>
  <div ref="cardRef" class="parallax-card" :style="cardStyle">
    <div class="parallax-layer parallax-layer-back" :style="{ transform: `translateY(${offset * 0.3}px)` }">
      <slot name="background" />
    </div>
    <div class="parallax-layer parallax-layer-mid" :style="{ transform: `translateY(${offset * 0.15}px)` }">
      <slot name="content" />
    </div>
    <div class="parallax-layer parallax-layer-front" :style="{ transform: `translateY(${offset * -0.2}px)` }">
      <slot name="foreground" />
    </div>
  </div>
</template>

<script setup lang="ts">
const cardRef = ref<HTMLElement | null>(null)
const offset = ref(0)

const cardStyle = computed(() => ({
  '--glow-x': `${50 + offset.value * 0.05}%`,
  '--glow-y': `${50 + offset.value * 0.03}%`,
}))

onMounted(() => {
  const handleScroll = () => {
    if (!cardRef.value) return
    const rect = cardRef.value.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    // 计算元素相对于视口中心的偏移
    const centerOffset = rect.top + rect.height / 2 - viewportHeight / 2
    offset.value = centerOffset * 0.3
  }

  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll() // 初始计算

  onUnmounted(() => window.removeEventListener('scroll', handleScroll))
})
</script>

<style scoped>
.parallax-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-xl);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  min-height: 200px;
  transform-style: preserve-3d;
}

.parallax-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
  pointer-events: none;
}

.parallax-layer-back {
  opacity: 0.3;
  filter: blur(2px);
  z-index: 1;
}

.parallax-layer-mid {
  z-index: 2;
}

.parallax-layer-front {
  z-index: 3;
  font-size: 3rem;
  opacity: 0.1;
}

@media (prefers-reduced-motion: reduce) {
  .parallax-layer {
    transform: none !important;
  }
}
</style>
