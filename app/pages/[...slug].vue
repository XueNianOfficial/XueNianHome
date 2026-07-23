<!--
============================================================
  雪年个人网站 - Catch-All 路由（404 页面）
  功能：
  1. 显示友好的 404 提示（渐变大字 + 狼爪装饰）
  2. 5 秒倒计时结束无操作 → 自动跳转首页
  3. 倒计时期间按任意键 / 点击「玩把小恐龙」→ 进入跑酷小游戏
  4. 游戏按 ESC 可退出返回 404 页
  5. SSR 时返回正确的 404 HTTP 状态码（SEO 友好）
============================================================
-->
<template>
  <div class="page-404" @keydown="handleKeydown" tabindex="0" ref="pageRef">
    <!-- 状态 1：默认 404 倒计时模式 -->
    <div v-if="gameState === 'idle'" class="not-found-content">
      <!-- 渐变 404 大字 + 两侧跳动的狼爪 -->
      <div class="nf-hero">
        <span class="paw paw-left">🐾</span>
        <span class="nf-code">404</span>
        <span class="paw paw-right">🐾</span>
      </div>

      <h1 class="nf-title">呜喵，迷路惹……</h1>
      <p class="nf-desc">
        腻访问的页面被年年吃掉惹……<br />
        别担心，咱会连腻一起吃掉哒！
      </p>

      <!-- 倒计时圆环：进度条随秒数递减 -->
      <div class="nf-countdown">
        <div class="countdown-ring">
          <svg class="ring-svg" viewBox="0 0 80 80">
            <circle
              class="ring-bg"
              cx="40" cy="40" r="34"
              fill="none"
              stroke="var(--color-border)"
              stroke-width="4"
            />
            <circle
              class="ring-progress"
              cx="40" cy="40" r="34"
              fill="none"
              stroke="var(--color-accent)"
              stroke-width="4"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="dashOffset"
              style="transform: rotate(-90deg); transform-origin: 50% 50%;"
            />
          </svg>
          <span class="countdown-number">{{ countdown }}</span>
        </div>
        <p class="countdown-text">秒后自动返回首页</p>
      </div>

      <!-- 操作区：返回首页 / 直接进入小游戏 -->
      <div class="nf-actions">
        <NuxtLink to="/" class="btn-primary">🏠 返回首页</NuxtLink>
        <button type="button" class="btn-outline" @click="startGame">🎮 玩把小恐龙</button>
      </div>
      <p class="nf-hint">💡 等待期间按任意键，也可以立刻开始跑酷小游戏哦</p>
    </div>

    <!-- 状态 2：游戏中 -->
    <div v-else-if="gameState === 'playing'" class="game-container">
      <GameDinoGame
        @gameover="onGameOver"
        @exit="exitGame"
      />
    </div>

    <!-- 状态 3：游戏结束 -->
    <div v-else-if="gameState === 'gameover'" class="gameover-card card">
      <div class="go-emoji">🎮</div>
      <h2 class="go-title">游戏结束</h2>
      <p class="go-score-label">最终得分</p>
      <p class="go-score">{{ finalScore }}</p>
      <div class="go-actions">
        <button type="button" class="btn-primary" @click="restartGame">🔄 再来一局</button>
        <NuxtLink to="/" class="btn-outline">🏠 返回首页</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  Catch-all 404 页面
 *  ------------------------------------------------------------
 *  三种状态：idle（倒计时）→ playing（游戏）→ gameover（结束）
 *  DinoGame 组件按需懒加载，减少首屏 JS 体积
 * ============================================================
 */
import type { GameState } from '~/types'

/** 断网小恐龙游戏组件（懒加载，仅在进入游戏时加载） */
const GameDinoGame = defineAsyncComponent(() => import('~/components/game/DinoGame.vue'))

definePageMeta({
  layout: false  // 404 页面不使用默认布局，实现沉浸式体验
})

// SSR 期间把响应状态码设为 404，避免 catch-all 路由返回 200 误导搜索引擎
if (import.meta.server) {
  setResponseStatus(404)
}

useHead({
  title: '页面未找到 · 404',
  meta: [
    // 404 页不应被搜索引擎收录
    { name: 'robots', content: 'noindex' }
  ]
})

const pageRef = ref<HTMLElement | null>(null)

/** 当前游戏状态 */
const gameState = ref<GameState>('idle')

/** 倒计时秒数（初始值与 startCountdown 保持一致，均为 5 秒） */
const countdown = ref(5)

/** 倒计时定时器 */
let countdownTimer: ReturnType<typeof setInterval> | null = null

/** 倒计时结束兜底定时器（略长于倒计时，确保圆环动画播完） */
let idleTimer: ReturnType<typeof setTimeout> | null = null

/** 最终得分 */
const finalScore = ref(0)

/** 倒计时圆环参数 */
const circumference = 2 * Math.PI * 34  // 圆周长 = 2πr = 2π×34 ≈ 213.6
const dashOffset = computed(() => {
  return circumference * (1 - countdown.value / 5)
})

/** 启动倒计时 */
function startCountdown() {
  countdown.value = 5

  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearTimer()
      navigateTo('/')
    }
  }, 1000)

  // 兜底跳转：比倒计时略多 300ms，确保动画完成
  idleTimer = setTimeout(() => {
    clearTimer()
    navigateTo('/')
  }, 5300)
}

/** 清除所有定时器 */
function clearTimer() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
}

/** 进入小恐龙游戏 */
function startGame() {
  clearTimer()
  gameState.value = 'playing'
}

/** 退出游戏，回到 404 idle 状态 */
function exitGame() {
  gameState.value = 'idle'
  startCountdown()
}

/** 用户按下任意键时的处理 */
function handleKeydown(e: KeyboardEvent) {
  if (gameState.value === 'idle') {
    // 忽略功能键和修饰键
    if (['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return
    e.preventDefault()
    startGame()
  }
}

/** 游戏结束回调 */
function onGameOver(score: number) {
  finalScore.value = score
  gameState.value = 'gameover'
}

/** 重新开始游戏 */
function restartGame() {
  gameState.value = 'playing'
}

// 生命周期
onMounted(() => {
  startCountdown()
  // 自动聚焦以接收键盘事件
  pageRef.value?.focus()
})

onUnmounted(() => {
  clearTimer()
})
</script>

<style scoped>
/* ---------- 页面容器 ---------- */
.page-404 {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary);
  outline: none;
  padding: var(--space-6);
  overflow: hidden;
}

/* 顶部柔和的品牌蓝光晕，营造层次而不喧宾夺主 */
.page-404::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 28%,
    var(--color-accent-bg) 0%,
    transparent 55%
  );
  opacity: 0.55;
  pointer-events: none;
}

/* ========== 404 默认状态 ========== */
.not-found-content {
  position: relative;
  text-align: center;
  max-width: 520px;
  animation: fade-in-up var(--transition-slow) both;
}

/* ---------- 渐变 404 大字 + 狼爪 ---------- */
.nf-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.paw {
  font-size: 2rem;
  animation: pawBounce 1s ease-in-out infinite;
}

.paw-right {
  animation-delay: 0.5s;
}

@keyframes pawBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* 品牌蓝渐变文字（background-clip: text 方案） */
.nf-code {
  font-size: clamp(4.5rem, 18vw, 7.5rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.03em;
  background: var(--color-accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  /* 渐变文字无法使用 text-shadow，改用投影滤镜 + 主题阴影令牌保持立体感 */
  filter: drop-shadow(var(--shadow-accent));
}

/* ---------- 标题和描述 ---------- */
.nf-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3);
}

.nf-desc {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin: 0 0 var(--space-8);
}

/* ---------- 倒计时圆环 ---------- */
.nf-countdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: var(--space-8);
}

.countdown-ring {
  position: relative;
  width: 80px;
  height: 80px;
  margin-bottom: var(--space-3);
}

.ring-svg {
  width: 80px;
  height: 80px;
}

.ring-progress {
  transition: stroke-dashoffset 1s linear;
}

.countdown-number {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-3xl);
  font-weight: 800;
  font-family: var(--font-mono);
  color: var(--color-accent);
}

.countdown-text {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin: 0;
}

/* ---------- 操作按钮 ---------- */
.nf-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.nf-hint {
  margin: var(--space-6) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* ========== 游戏容器 ========== */
.game-container {
  position: relative;
  width: 100%;
  max-width: 800px;
  animation: fade-in var(--transition-normal) both;
}

/* ========== 游戏结束状态 ========== */
.gameover-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  padding: var(--space-12) var(--space-8);
  text-align: center;
  animation: fade-in-up var(--transition-slow) both;
}

.go-emoji {
  font-size: 2.5rem;
  margin-bottom: var(--space-2);
}

.go-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-4);
}

.go-score-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--space-1);
}

/* 得分大数字：等宽字体 + 品牌强调色，突出「战绩」 */
.go-score {
  font-size: var(--text-4xl);
  font-weight: 800;
  font-family: var(--font-mono);
  color: var(--color-accent);
  line-height: 1.2;
  margin: 0 0 var(--space-8);
}

.go-actions {
  display: flex;
  gap: var(--space-4);
  justify-content: center;
  flex-wrap: wrap;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .paw {
    font-size: 1.5rem;
  }

  .nf-title {
    font-size: var(--text-xl);
  }

  .nf-desc {
    font-size: var(--text-base);
  }

  .gameover-card {
    padding: var(--space-8) var(--space-6);
  }
}
</style>
