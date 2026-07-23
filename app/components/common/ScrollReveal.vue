<!--
============================================================
  滚动进入视口揭示动画容器
  内容进入视口时按指定方向入场一次，支持延迟形成错落节奏
============================================================
-->
<template>
  <div
    ref="el"
    class="scroll-reveal"
    :class="[`reveal-${direction}`, { 'is-visible': isVisible }]"
    :style="delayStyle"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  ScrollReveal - 滚动揭示动画容器
 *  - 用 IntersectionObserver 观察自身，进入视口后加 is-visible
 *  - 只揭示一次（触发后即断开观察，滚动回去不回退）
 *  - 支持多种入场方向：up / down / left / right / zoom，
 *    左右方向附带轻微旋转回正，缓动带微小过冲（非线性弹性感）
 *  - 不支持 IO 或用户要求减弱动效时直接显示，保证内容始终可达
 * ============================================================
 */

const props = withDefaults(defineProps<{
  /** 入场延迟（毫秒），用于多元素阶梯式出现 */
  delay?: number
  /** 入场方向 */
  direction?: 'up' | 'down' | 'left' | 'right' | 'zoom'
}>(), {
  delay: 0,
  direction: 'up'
})

const el = ref<HTMLElement | null>(null)
const isVisible = ref(false)

/** 延迟通过 transition-delay 实现，0 时不输出内联样式 */
const delayStyle = computed(() =>
  props.delay > 0 ? { transitionDelay: `${props.delay}ms` } : undefined
)

let observer: IntersectionObserver | null = null

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!el.value || !('IntersectionObserver' in window) || reducedMotion) {
    isVisible.value = true
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        isVisible.value = true
        observer?.disconnect()
        observer = null
      }
    },
    // 元素顶部距视口下缘 60px 时触发，比完全进入稍早，观感更自然
    { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
  )
  observer.observe(el.value)
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<style scoped>
/* 初始透明；进入视口后归位（只走合成器属性，丝滑不回流）。
   transform 缓动带轻微过冲（cubic-bezier 第二控制点 > 1），
   让入场在终点处有一次极轻的「回弹」，避免匀速线性感 */
.scroll-reveal {
  opacity: 0;
  transition:
    opacity 0.6s ease,
    transform 0.8s cubic-bezier(0.34, 1.3, 0.5, 1);
  will-change: opacity, transform;
}

/* ---------- 各入场方向的初始姿态 ---------- */
.reveal-up {
  transform: translateY(30px);
}

.reveal-down {
  transform: translateY(-30px);
}

/* 左右入场附带 1.5° 旋转，归正过程更生动 */
.reveal-left {
  transform: translateX(-38px) rotate(-1.5deg);
}

.reveal-right {
  transform: translateX(38px) rotate(1.5deg);
}

/* 缩放入场：配合过冲缓动呈「弹入」效果 */
.reveal-zoom {
  transform: scale(0.86);
}

.scroll-reveal.is-visible {
  opacity: 1;
  transform: none;
}

/* 减弱动效：直接显示（JS 端同样兜底，此处为双保险） */
@media (prefers-reduced-motion: reduce) {
  .scroll-reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
