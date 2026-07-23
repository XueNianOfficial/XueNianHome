<!--
============================================================
  首页 - 数据统计带
  博客文章 / 画廊画作 / 好朋友数量，进入视口时数字滚动递增
  三项逐枚入场（上浮 + 递增延迟）
============================================================
-->
<template>
  <div ref="statsRef" class="stats-bar">
    <CommonScrollReveal
      v-for="(item, i) in items"
      :key="item.label"
      direction="up"
      :delay="i * 130"
    >
      <div class="stat-item">
        <span class="stat-icon" aria-hidden="true">{{ item.icon }}</span>
        <span class="stat-value">
          {{ item.value }}<span class="stat-suffix">{{ item.suffix }}</span>
        </span>
        <span class="stat-label">{{ item.label }}</span>
      </div>
    </CommonScrollReveal>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  HomeStats - 首页数据统计带
 *  - 数据由首页 SSR 拉取公开列表接口后经 props 传入
 *  - 进入视口后用 rAF + easeOutCubic 让数字从 0 滚动到目标值
 *  - 三个统计项各自 ScrollReveal（上浮 + 130ms 递增延迟）
 *  - 减弱动效 / 无 IntersectionObserver 时直接显示最终数字
 * ============================================================
 */

const props = defineProps<{
  /** 博客文章总数 */
  posts: number
  /** 画廊画作总数 */
  artworks: number
  /** 友链总数 */
  friends: number
}>()

/** 当前显示的数字（由滚动动画逐帧驱动） */
const display = reactive({ posts: 0, artworks: 0, friends: 0 })

const items = computed(() => [
  { icon: '📝', value: display.posts, suffix: '篇', label: '博客文章' },
  { icon: '🖼️', value: display.artworks, suffix: '幅', label: '画廊画作' },
  { icon: '🔗', value: display.friends, suffix: '位', label: '好朋友' }
])

const statsRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let rafId = 0

/** 数字滚动：1.6 秒 easeOutCubic（先快后慢），从 0 递增到目标值 */
function startCountUp(): void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) {
    display.posts = props.posts
    display.artworks = props.artworks
    display.friends = props.friends
    return
  }
  const DURATION = 1600
  const startTime = performance.now()
  const step = (now: number): void => {
    const progress = Math.min((now - startTime) / DURATION, 1)
    const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
    display.posts = Math.round(props.posts * eased)
    display.artworks = Math.round(props.artworks * eased)
    display.friends = Math.round(props.friends * eased)
    if (progress < 1) rafId = requestAnimationFrame(step)
  }
  rafId = requestAnimationFrame(step)
}

onMounted(() => {
  if (!statsRef.value || !('IntersectionObserver' in window)) {
    startCountUp()
    return
  }
  // 统计带 40% 进入视口时触发一次数字滚动
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        startCountUp()
        observer?.disconnect()
        observer = null
      }
    },
    { threshold: 0.4 }
  )
  observer.observe(statsRef.value)
})

onUnmounted(() => {
  observer?.disconnect()
  cancelAnimationFrame(rafId)
})
</script>

<style scoped>
/* ---------- 统计带容器：居中的悬浮卡片 ---------- */
.stats-bar {
  display: flex;
  justify-content: center;
  gap: var(--space-16);
  flex-wrap: wrap;
  padding: var(--space-8) var(--space-6);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  max-width: 860px;
  margin: 0 auto;
}

/* ---------- 单个统计项：图标 + 渐变数字 + 文案 ---------- */
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  min-width: 120px;
}

.stat-icon {
  font-size: var(--text-2xl);
}

.stat-value {
  font-size: var(--text-4xl);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  /* 品牌蓝渐变文字，与首页大标题呼应 */
  background: var(--color-accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  /* 等宽数字：滚动递增时宽度不抖动 */
  font-variant-numeric: tabular-nums;
}

.stat-suffix {
  font-size: var(--text-base);
  font-weight: 500;
  margin-left: var(--space-1);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* ---------- 响应式：窄屏缩小间距与数字 ---------- */
@media (max-width: 640px) {
  .stats-bar {
    gap: var(--space-8);
    padding: var(--space-6) var(--space-4);
  }

  .stat-value {
    font-size: var(--text-3xl);
  }
}
</style>
