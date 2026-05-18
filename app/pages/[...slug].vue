<!--
============================================================
  雪年个人网站 - Catch-All 路由（404 页面）
  功能：
  1. 显示友好的 404 提示
  2. 5 秒内无操作 → 自动跳转首页（带倒计时）
  3. 5 秒内按任意键 → 进入断网小恐龙游戏
  4. 游戏按 ESC 可退出返回
============================================================
-->
<template>
  <div class="page-404" @keydown="handleKeydown" tabindex="0" ref="pageRef">
    <!-- 状态 1：默认 404 倒计时模式 -->
    <div v-if="gameState === 'idle'" class="not-found-content">
      <!-- 狼爪子装饰 -->
      <div class="paw-decoration">
        <span class="paw paw-left">🐾</span>
        <span class="paw-num">404</span>
        <span class="paw paw-right">🐾</span>
      </div>

      <h1 class="nf-title">呜喵，迷路惹……</h1>
      <p class="nf-desc">
        腻访问的页面被年年吃掉惹……<br />
        别担心，咱会连腻一起吃掉哒！
      </p>

      <!-- 倒计时提示 -->
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

      <div class="nf-actions">
        <NuxtLink to="/" class="btn-primary">🏠 返回首页</NuxtLink>
      </div>
    </div>

    <!-- 状态 2：游戏中 -->
    <div v-else-if="gameState === 'playing'" class="game-container">
      <GameDinoGame
        @gameover="onGameOver"
        @exit="exitGame"
      />
    </div>

    <!-- 状态 3：游戏结束 -->
    <div v-else-if="gameState === 'gameover'" class="gameover-content">
      <h2 class="go-title">🎮 游戏结束</h2>
      <p class="go-score">最终得分：<strong>{{ finalScore }}</strong></p>
      <div class="go-actions">
        <button class="btn-primary" @click="restartGame">🔄 再来一局</button>
        <NuxtLink to="/" class="btn-outline">🏠 返回首页</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Catch-all 404 页面
 * 三种状态：idle（倒计时）→ playing（游戏）→ gameover（结束）
 * DinoGame 组件按需懒加载，减少首屏 JS 体积
 */
import type { GameState } from '~/types'

/** 断网小恐龙游戏组件（懒加载，仅在进入游戏时加载） */
const GameDinoGame = defineAsyncComponent(() => import('~/components/game/DinoGame.vue'))

definePageMeta({
  layout: false  // 404 页面不使用默认布局，实现沉浸式体验
})

useHead({
  title: '页面未找到 · 404'
})

const pageRef = ref<HTMLElement | null>(null)

/** 当前游戏状态 */
const gameState = ref<GameState>('idle')

/** 倒计时秒数 */
const countdown = ref(3)

/** 倒计时定时器 */
let countdownTimer: ReturnType<typeof setInterval> | null = null

/** 3 秒无操作定时器 */
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

  // 3 秒无操作自动跳转
  idleTimer = setTimeout(() => {
    clearTimer()
    navigateTo('/')
  }, 5300) // 比倒计时略多 300ms，确保动画完成
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
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary);
  outline: none;
  padding: 20px;
}

/* ========== 404 默认状态 ========== */
.not-found-content {
  text-align: center;
  max-width: 460px;
}

/* 狼爪子装饰 */
.paw-decoration {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
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

.paw-num {
  font-size: 5rem;
  font-weight: 900;
  color: var(--color-accent);
  line-height: 1;
  text-shadow: 3px 3px 0 var(--color-accent-bg);
}

/* 标题和描述 */
.nf-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 12px;
}

.nf-desc {
  font-size: 1.05rem;
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin-bottom: 32px;
}

/* ---------- 倒计时圆环 ---------- */
.nf-countdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
}

.countdown-ring {
  position: relative;
  width: 80px;
  height: 80px;
  margin-bottom: 12px;
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
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--color-accent);
}

.countdown-text {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* ---------- 操作按钮 ---------- */
.nf-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.or-hint {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

/* ========== 游戏容器 ========== */
.game-container {
  width: 100%;
  max-width: 800px;
}

/* ========== 游戏结束状态 ========== */
.gameover-content {
  text-align: center;
}

.go-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}

.go-score {
  font-size: 1.2rem;
  color: var(--color-text-secondary);
  margin-bottom: 32px;
}

.go-score strong {
  color: var(--color-accent);
  font-size: 2rem;
}

.go-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .paw-num {
    font-size: 3.5rem;
  }

  .nf-title {
    font-size: 1.3rem;
  }

  .game-container {
    max-width: 100%;
  }
}
</style>
