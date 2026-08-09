<template>
  <div class="aurora-bg" aria-hidden="true">
    <div class="aurora-blob aurora-blob-1"></div>
    <div class="aurora-blob aurora-blob-2"></div>
    <div class="aurora-blob aurora-blob-3"></div>
    <div class="aurora-blob aurora-blob-4"></div>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  AuroraBackground - 全站极光彩带背景
 *  - fixed 全屏、z-index -1，压在 body 背景之上、内容之下
 *  - 4 个径向渐变光斑（颜色/强度走 main.css 的 --aurora-* 令牌，
 *    亮/暗双主题自动切换），仅 transform 慢速动画（合成层，零重绘）
 *  - 动画减弱模式下由 main.css 全局降级块静止
 * ============================================================
 */
</script>

<style scoped>
.aurora-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.aurora-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  will-change: transform;
}

/* 光斑 1：主色蓝，左上，缓慢漂移 */
.aurora-blob-1 {
  width: 55vmax;
  height: 55vmax;
  left: -15vmax;
  top: -20vmax;
  background: radial-gradient(
    circle at center,
    rgba(var(--aurora-1), var(--aurora-strength)) 0%,
    transparent 65%
  );
  animation: aurora-drift-1 32s ease-in-out infinite alternate;
}

/* 光斑 2：青色，右侧，反向漂移 */
.aurora-blob-2 {
  width: 48vmax;
  height: 48vmax;
  right: -18vmax;
  top: 10vh;
  background: radial-gradient(
    circle at center,
    rgba(var(--aurora-2), var(--aurora-strength)) 0%,
    transparent 65%
  );
  animation: aurora-drift-2 40s ease-in-out infinite alternate;
}

/* 光斑 3：紫色，底部，横向游走 */
.aurora-blob-3 {
  width: 50vmax;
  height: 50vmax;
  left: 20vw;
  bottom: -25vmax;
  background: radial-gradient(
    circle at center,
    rgba(var(--aurora-3), var(--aurora-strength)) 0%,
    transparent 65%
  );
  animation: aurora-drift-3 46s ease-in-out infinite alternate;
}

/* 光斑 4：主色蓝小号，中部呼吸 */
.aurora-blob-4 {
  width: 36vmax;
  height: 36vmax;
  right: 12vw;
  bottom: 5vh;
  background: radial-gradient(
    circle at center,
    rgba(var(--aurora-1), calc(var(--aurora-strength) * 0.7)) 0%,
    transparent 65%
  );
  animation: aurora-drift-4 26s ease-in-out infinite alternate;
}

@keyframes aurora-drift-1 {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(8vw, 6vh, 0) scale(1.12);
  }
  100% {
    transform: translate3d(-4vw, 12vh, 0) scale(0.94);
  }
}

@keyframes aurora-drift-2 {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(-10vw, 8vh, 0) scale(1.08);
  }
  100% {
    transform: translate3d(-5vw, -6vh, 0) scale(1.15);
  }
}

@keyframes aurora-drift-3 {
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  50% {
    transform: translate3d(12vw, -5vh, 0) rotate(12deg);
  }
  100% {
    transform: translate3d(-8vw, -8vh, 0) rotate(-8deg);
  }
}

@keyframes aurora-drift-4 {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(-6vw, -10vh, 0) scale(1.18);
  }
  100% {
    transform: translate3d(5vw, 4vh, 0) scale(0.9);
  }
}
</style>
