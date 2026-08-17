<!--
  ============================================================
  ParallaxText - 横向视差滚动文本
  随页面滚动产生横向移动的大号文本装饰
  ============================================================
-->
<template>
  <div class="parallax-text" :style="{ transform: `translateX(${offset}px)` }">
    <span class="parallax-text-content">{{ text }}</span>
    <span class="parallax-text-content">{{ text }}</span>
    <span class="parallax-text-content">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  text: string
  speed?: number
  direction?: 'left' | 'right'
}>()

const speed = props.speed || 0.3
const direction = props.direction || 'right'
const offset = ref(0)

onMounted(() => {
  const handleScroll = () => {
    const scrollY = window.scrollY
    const multiplier = direction === 'right' ? 1 : -1
    offset.value = scrollY * speed * multiplier
  }

  window.addEventListener('scroll', handleScroll, { passive: true })
  onUnmounted(() => window.removeEventListener('scroll', handleScroll))
})
</script>

<style scoped>
.parallax-text {
  position: absolute;
  white-space: nowrap;
  font-size: clamp(4rem, 15vw, 12rem);
  font-weight: 900;
  color: var(--color-text-primary);
  opacity: 0.03;
  pointer-events: none;
  user-select: none;
  will-change: transform;
  z-index: 0;
  display: flex;
  gap: 2rem;
}

.parallax-text-content {
  display: inline-block;
}

@media (prefers-reduced-motion: reduce) {
  .parallax-text {
    display: none;
  }
}
</style>
