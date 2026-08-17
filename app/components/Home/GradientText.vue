<!--
  ============================================================
  GradientText - 渐变流动文字
  背景渐变动画在文字中流动的炫酷效果
  ============================================================
-->
<template>
  <span class="gradient-text" :class="{ 'gradient-text--large': large }">
    <slot />
  </span>
</template>

<script setup lang="ts">
defineProps<{
  large?: boolean
}>()
</script>

<style scoped>
.gradient-text {
  background: linear-gradient(
    90deg,
    var(--color-accent) 0%,
    #a78bfa 25%,
    #f472b6 50%,
    var(--color-accent) 75%,
    #a78bfa 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: gradient-shift 6s ease-in-out infinite;
  font-weight: 700;
}

.gradient-text--large {
  font-size: clamp(2rem, 8vw, 5rem);
  line-height: 1.2;
}

@keyframes gradient-shift {
  0% {
    background-position: 0% center;
  }
  50% {
    background-position: 100% center;
  }
  100% {
    background-position: 0% center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gradient-text {
    animation: none;
    background-position: 50% center;
  }
}
</style>
