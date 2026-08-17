<!--
  ============================================================
  MaskReveal - 遮罩揭示效果
  内容通过动态遮罩逐渐显现
  ============================================================
-->
<template>
  <div ref="containerRef" class="mask-reveal" :class="{ 'is-visible': isVisible }">
    <slot />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  delay?: number
  direction?: 'top' | 'bottom' | 'left' | 'right'
}>()

const containerRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)

onMounted(() => {
  if (!containerRef.value) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isVisible.value) {
          setTimeout(() => {
            isVisible.value = true
          }, props.delay || 0)
        }
      })
    },
    { threshold: 0.1 }
  )

  observer.observe(containerRef.value)

  onUnmounted(() => observer.disconnect())
})
</script>

<style scoped>
.mask-reveal {
  --mask-direction: to right;
  position: relative;
  mask-image: linear-gradient(var(--mask-direction), transparent 0%, black 50%);
  mask-size: 200% 100%;
  mask-position: 100% 0;
  transition: mask-position 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.mask-reveal.is-visible {
  mask-position: 0% 0;
}

@media (prefers-reduced-motion: reduce) {
  .mask-reveal {
    mask-image: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .mask-reveal.is-visible {
    opacity: 1;
  }
}
</style>
