<!--
  ============================================================
  ShatterEffect - 镜面破碎效果
  元素从破碎状态逐渐组合完整
  ============================================================
-->
<template>
  <div ref="containerRef" class="shatter-container" :class="{ 'is-assembled': isVisible }">
    <div class="shatter-grid">
      <div v-for="i in 16" :key="i" class="shatter-piece" :style="{ transitionDelay: `${i * 30}ms` }">
        <div class="shatter-content">
          <slot />
        </div>
      </div>
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
    { threshold: 0.3 }
  )

  observer.observe(containerRef.value)

  onUnmounted(() => observer.disconnect())
})
</script>

<style scoped>
.shatter-container {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.shatter-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
  width: 100%;
  aspect-ratio: 1;
}

.shatter-piece {
  position: relative;
  overflow: hidden;
  transform: translate(var(--tx, 0), var(--ty, 0)) rotate(var(--rotate, 0deg)) scale(0.3);
  opacity: 0;
  transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 0.6s ease;
}

.shatter-content {
  position: absolute;
  width: 400%;
  height: 400%;
  pointer-events: none;
  user-select: none;
}

/* 为每个碎片设置不同的初始偏移 */
.shatter-piece:nth-child(1) { --tx: -80px; --ty: -80px; --rotate: -15deg; }
.shatter-piece:nth-child(2) { --tx: -40px; --ty: -100px; --rotate: 10deg; }
.shatter-piece:nth-child(3) { --tx: 40px; --ty: -90px; --rotate: -8deg; }
.shatter-piece:nth-child(4) { --tx: 80px; --ty: -70px; --rotate: 12deg; }
.shatter-piece:nth-child(5) { --tx: -90px; --ty: -30px; --rotate: 8deg; }
.shatter-piece:nth-child(6) { --tx: -30px; --ty: -40px; --rotate: -10deg; }
.shatter-piece:nth-child(7) { --tx: 30px; --ty: -35px; --rotate: 15deg; }
.shatter-piece:nth-child(8) { --tx: 85px; --ty: -25px; --rotate: -12deg; }
.shatter-piece:nth-child(9) { --tx: -85px; --ty: 25px; --rotate: -9deg; }
.shatter-piece:nth-child(10) { --tx: -35px; --ty: 40px; --rotate: 11deg; }
.shatter-piece:nth-child(11) { --tx: 35px; --ty: 38px; --rotate: -14deg; }
.shatter-piece:nth-child(12) { --tx: 90px; --ty: 28px; --rotate: 9deg; }
.shatter-piece:nth-child(13) { --tx: -78px; --ty: 75px; --rotate: 13deg; }
.shatter-piece:nth-child(14) { --tx: -38px; --ty: 95px; --rotate: -11deg; }
.shatter-piece:nth-child(15) { --tx: 42px; --ty: 88px; --rotate: 10deg; }
.shatter-piece:nth-child(16) { --tx: 82px; --ty: 80px; --rotate: -16deg; }

/* 组装状态 */
.is-assembled .shatter-piece {
  transform: translate(0, 0) rotate(0deg) scale(1);
  opacity: 1;
}

/* 每个碎片的内容位置对齐 */
.shatter-piece:nth-child(1) .shatter-content { top: 0; left: 0; }
.shatter-piece:nth-child(2) .shatter-content { top: 0; left: -100%; }
.shatter-piece:nth-child(3) .shatter-content { top: 0; left: -200%; }
.shatter-piece:nth-child(4) .shatter-content { top: 0; left: -300%; }
.shatter-piece:nth-child(5) .shatter-content { top: -100%; left: 0; }
.shatter-piece:nth-child(6) .shatter-content { top: -100%; left: -100%; }
.shatter-piece:nth-child(7) .shatter-content { top: -100%; left: -200%; }
.shatter-piece:nth-child(8) .shatter-content { top: -100%; left: -300%; }
.shatter-piece:nth-child(9) .shatter-content { top: -200%; left: 0; }
.shatter-piece:nth-child(10) .shatter-content { top: -200%; left: -100%; }
.shatter-piece:nth-child(11) .shatter-content { top: -200%; left: -200%; }
.shatter-piece:nth-child(12) .shatter-content { top: -200%; left: -300%; }
.shatter-piece:nth-child(13) .shatter-content { top: -300%; left: 0; }
.shatter-piece:nth-child(14) .shatter-content { top: -300%; left: -100%; }
.shatter-piece:nth-child(15) .shatter-content { top: -300%; left: -200%; }
.shatter-piece:nth-child(16) .shatter-content { top: -300%; left: -300%; }

@media (prefers-reduced-motion: reduce) {
  .shatter-piece {
    transform: none !important;
    transition: opacity 0.3s ease;
  }
}
</style>
