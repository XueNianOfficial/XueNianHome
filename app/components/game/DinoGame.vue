<!--
============================================================
  雪年个人网站 - 断网小恐龙游戏（Canvas 实现）
  经典 Chrome Dino 玩法，狼角色皮肤替换
  空格/↑/点击画面 跳跃，躲避障碍物（骨头/树桩）
  分数递增，速度渐快，ESC 退出
  画面配色读取全局设计令牌（CSS 变量），亮/暗主题自适应
============================================================
-->
<template>
  <div class="dino-game card">
    <!-- 游戏信息栏（HUD）：得分 / 速度 / 退出 -->
    <div class="game-hud">
      <div class="hud-stats">
        <span class="hud-chip hud-chip-score">
          🏆 得分 <b class="hud-num">{{ score }}</b>
        </span>
        <span class="hud-chip">
          ⚡ 速度 <b class="hud-num">{{ Math.floor(speed) }}</b>
        </span>
      </div>
      <button type="button" class="btn-outline btn-sm game-exit-btn" @click="handleExit" title="退出游戏 (ESC)">
        ✕ 退出
      </button>
    </div>

    <!-- Canvas 画布：点击 / 触摸也可跳跃（移动端支持） -->
    <canvas
      ref="canvasRef"
      class="game-canvas"
      :width="canvasWidth"
      :height="canvasHeight"
      role="img"
      aria-label="小恐龙跑酷游戏画面"
      @click="handleTapJump"
      @touchstart.prevent="handleTapJump"
    ></canvas>

    <!-- 操作提示 -->
    <p class="game-tip">
      按 <kbd>空格</kbd> / <kbd>↑</kbd> 或点击画面跳跃 · 按 <kbd>ESC</kbd> 退出
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  DinoGame - Canvas 断网小恐龙游戏组件
 *  ------------------------------------------------------------
 *  游戏参数说明：
 *  - 重力加速度：0.6 px/frame
 *  - 初始速度：6 px/frame
 *  - 速度递增：每 100 分 +0.5
 *  - 障碍物间隔：100~200 帧（随机，随速度加快而缩短）
 *  - 帧率：约 60fps（使用 requestAnimationFrame）
 *
 *  配色说明：
 *  Canvas 无法直接使用 CSS 变量，因此通过 getComputedStyle
 *  读取设计令牌的计算值缓存为调色板；并用 MutationObserver
 *  监听 html.dark 类变化，主题切换时自动刷新配色。
 * ============================================================
 */
import type { GameObject } from '~/types'

const emit = defineEmits<{
  gameover: [score: number]
  exit: []
}>()

// ---------- Canvas 相关 ----------
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWidth = 800
const canvasHeight = 300

// ---------- 游戏状态 ----------
let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null
let gameRunning = false

/** 当前得分 */
const score = ref(0)
/** 当前游戏速度 */
const speed = ref(6)
/** 游戏是否结束 */
const isGameOver = ref(false)

// ---------- 主题调色板 ----------
/**
 * 画布配色全部来自 main.css 的设计令牌；
 * 初始值为亮色主题兜底（SSR / 读取失败时使用），
 * 挂载后会立即用真实计算值刷新。
 */
interface GamePalette {
  skyTop: string      // 天空渐变顶部
  skyBottom: string   // 天空渐变底部
  mountain: string    // 远山剪影
  ground: string      // 地面（雪地）填充
  groundLine: string  // 地面轮廓线
  stone: string       // 地面小石子
  boneFill: string    // 骨头主体
  boneShade: string   // 骨头内阴影
  stumpFill: string   // 树桩主体
  stumpRing: string   // 树桩年轮
  particleRgb: string // 粒子颜色（"r, g, b" 三元组，便于拼 rgba）
}

const palette = reactive<GamePalette>({
  skyTop: '#F7F9FC',
  skyBottom: '#EEF3F9',
  mountain: '#E2E8F0',
  ground: '#FFFFFF',
  groundLine: '#94A3B8',
  stone: '#94A3B8',
  boneFill: '#94A3B8',
  boneShade: '#FFFFFF',
  stumpFill: '#64748B',
  stumpRing: '#FFFFFF',
  particleRgb: '74, 144, 217'
})

/** 读取某个 CSS 自定义属性的计算值，读取失败时回退到 fallback */
function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** 把 #rgb / #rrggbb / rgb() 颜色解析为 "r, g, b" 三元组（用于 canvas rgba()） */
function toRgbTriplet(color: string, fallback: string): string {
  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('')
    }
    const num = parseInt(hex, 16)
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
  }
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgbMatch) {
    return `${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}`
  }
  return fallback
}

/** 从当前主题刷新画布调色板 */
function refreshPalette() {
  palette.skyTop = cssVar('--color-bg-primary', palette.skyTop)
  palette.skyBottom = cssVar('--color-bg-tertiary', palette.skyBottom)
  palette.mountain = cssVar('--color-border', palette.mountain)
  palette.ground = cssVar('--color-bg-secondary', palette.ground)
  palette.groundLine = cssVar('--color-text-muted', palette.groundLine)
  palette.stone = cssVar('--color-text-muted', palette.stone)
  palette.boneFill = cssVar('--color-text-muted', palette.boneFill)
  palette.boneShade = cssVar('--color-bg-secondary', palette.boneShade)
  palette.stumpFill = cssVar('--color-text-secondary', palette.stumpFill)
  palette.stumpRing = cssVar('--color-bg-secondary', palette.stumpRing)
  palette.particleRgb = toRgbTriplet(cssVar('--color-accent', '#4A90D9'), palette.particleRgb)
}

/** 监听 html.dark 类切换，主题变化时自动刷新调色板 */
let themeObserver: MutationObserver | null = null

// ---------- 玩家（狼角色） ----------
const player = reactive({
  x: 80,
  y: 200,         // 地面高度
  width: 40,
  height: 50,
  vy: 0,           // 垂直速度
  isJumping: false,
  isDucking: false // 预留字段：趴下动作（当前未实现，重置时需归位）
})

const GRAVITY = 0.6
const JUMP_FORCE = -12
const GROUND_Y = 200  // 地面 Y 坐标

// ---------- 障碍物 ----------
interface Obstacle extends GameObject {
  type: 'bone' | 'stump'  // 骨头 或 树桩
  active: boolean
}

const obstacles: Obstacle[] = []
let obstacleTimer = 0
const OBSTACLE_INTERVAL_MIN = 100  // 最小间隔帧数
const OBSTACLE_INTERVAL_MAX = 200  // 最大间隔帧数
let nextObstacleFrame = 100

// ---------- 地面滚动 ----------
let groundOffset = 0

// ---------- 粒子特效 ----------
interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number
}
const particles: Particle[] = []

// ---------- 游戏循环 ----------

/** 启动游戏 */
function startGame() {
  if (gameRunning) return
  gameRunning = true
  isGameOver.value = false
  score.value = 0
  speed.value = 6
  player.y = GROUND_Y
  player.vy = 0
  player.isJumping = false
  player.isDucking = false
  obstacles.length = 0
  particles.length = 0
  obstacleTimer = 0
  nextObstacleFrame = 80
  groundOffset = 0

  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  if (!ctx) return

  gameLoop()
}

/** 主游戏循环 */
function gameLoop() {
  if (!gameRunning || !ctx || !canvasRef.value) return

  update()
  render()
  animationId = requestAnimationFrame(gameLoop)
}

/** 更新游戏逻辑 */
function update() {
  if (isGameOver.value) return

  // 玩家物理
  if (player.isJumping) {
    player.vy += GRAVITY
    player.y += player.vy
    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y
      player.vy = 0
      player.isJumping = false
      // 落地粒子
      spawnParticles(player.x + player.width / 2, GROUND_Y + player.height, 5)
    }
  }

  // 分数和速度递增
  score.value++
  if (score.value % 100 === 0) {
    speed.value += 0.5
  }

  // 生成障碍物
  obstacleTimer++
  if (obstacleTimer >= nextObstacleFrame) {
    spawnObstacle()
    obstacleTimer = 0
    nextObstacleFrame = OBSTACLE_INTERVAL_MIN +
      Math.floor(Math.random() * (OBSTACLE_INTERVAL_MAX - OBSTACLE_INTERVAL_MIN))
    // 速度越快，间隔越小
    nextObstacleFrame = Math.max(50, nextObstacleFrame - Math.floor(speed.value * 3))
  }

  // 移动和移除障碍物
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i]
    obs.x -= speed.value * 0.8
    if (obs.x + obs.width < 0) {
      obstacles.splice(i, 1)
    }
  }

  // 碰撞检测
  const playerHitBox = {
    x: player.x + 5,
    y: player.y + 5,
    width: player.width - 10,
    height: player.height - 10
  }

  for (const obs of obstacles) {
    if (!obs.active) continue
    if (checkCollision(playerHitBox, obs)) {
      endGame()
      return
    }
  }

  // 更新粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.1
    p.life--
    if (p.life <= 0) {
      particles.splice(i, 1)
    }
  }

  // 地面滚动
  groundOffset = (groundOffset + speed.value * 0.8) % 40
}

/** 渲染游戏画面 */
function render() {
  if (!ctx || !canvasRef.value) return
  const w = canvasWidth
  const h = canvasHeight

  // 清空画布
  ctx.clearRect(0, 0, w, h)

  // 背景：天空渐变（取自主题背景层级，雪地氛围）
  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, palette.skyTop)
  gradient.addColorStop(0.7, palette.skyBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  // 远山（装饰，随地面极缓慢移动制造视差）
  ctx.fillStyle = palette.mountain
  ctx.beginPath()
  ctx.moveTo(0, GROUND_Y + 50)
  for (let x = 0; x <= w; x += 60) {
    ctx.lineTo(x, GROUND_Y + 50 + Math.sin(x * 0.02 + groundOffset * 0.01) * 30)
  }
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()

  // 地面
  ctx.fillStyle = palette.ground
  ctx.fillRect(0, GROUND_Y + player.height, w, h - GROUND_Y - player.height)

  // 地面轮廓线
  ctx.strokeStyle = palette.groundLine
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, GROUND_Y + player.height)
  ctx.lineTo(w, GROUND_Y + player.height)
  ctx.stroke()

  // 地面小石子（随速度滚动）
  ctx.fillStyle = palette.stone
  for (let x = -groundOffset; x < w; x += 40) {
    ctx.beginPath()
    ctx.arc(x, GROUND_Y + player.height + 8, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x + 18, GROUND_Y + player.height + 6, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // 绘制障碍物
  for (const obs of obstacles) {
    if (!obs.active) continue
    drawObstacle(ctx, obs)
  }

  // 绘制玩家（狼角色）
  drawPlayer(ctx)

  // 绘制粒子（品牌强调色，透明度随生命周期衰减）
  for (const p of particles) {
    ctx.fillStyle = `rgba(${palette.particleRgb}, ${p.life / p.maxLife})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 绘制狼角色 */
function drawPlayer(ctx: CanvasRenderingContext2D) {
  const x = player.x
  const y = player.y
  const w = player.width
  const h = player.height

  ctx.save()

  // 身体颜色（狼灰蓝色，与品牌蓝色系协调，亮暗主题下均清晰）
  const bodyColor = '#7B8CA3'
  const bellyColor = '#D5DDE5'
  const earColor = '#5C6D80'

  // --- 身体 ---
  ctx.fillStyle = bodyColor
  roundRect(ctx, x, y + 10, w, h - 15, 8)
  ctx.fill()

  // 肚皮
  ctx.fillStyle = bellyColor
  roundRect(ctx, x + 6, y + 18, w - 12, h - 28, 6)
  ctx.fill()

  // --- 头部 ---
  ctx.fillStyle = bodyColor
  ctx.beginPath()
  ctx.arc(x + w / 2, y + 6, 16, 0, Math.PI * 2)
  ctx.fill()

  // 口鼻部
  ctx.fillStyle = bellyColor
  ctx.beginPath()
  ctx.ellipse(x + w / 2 + 4, y + 10, 8, 6, 0, 0, Math.PI * 2)
  ctx.fill()

  // 鼻子
  ctx.fillStyle = '#3D4F5F'
  ctx.beginPath()
  ctx.arc(x + w / 2 + 9, y + 8, 3, 0, Math.PI * 2)
  ctx.fill()

  // --- 耳朵 ---
  // 左耳
  ctx.fillStyle = earColor
  ctx.beginPath()
  ctx.moveTo(x + w / 2 - 12, y - 2)
  ctx.lineTo(x + w / 2 - 18, y - 18)
  ctx.lineTo(x + w / 2 - 4, y - 4)
  ctx.fill()

  // 右耳
  ctx.beginPath()
  ctx.moveTo(x + w / 2 + 12, y - 2)
  ctx.lineTo(x + w / 2 + 18, y - 18)
  ctx.lineTo(x + w / 2 + 4, y - 4)
  ctx.fill()

  // 耳内
  ctx.fillStyle = '#A0B0C0'
  ctx.beginPath()
  ctx.moveTo(x + w / 2 - 10, y - 1)
  ctx.lineTo(x + w / 2 - 15, y - 14)
  ctx.lineTo(x + w / 2 - 4, y - 3)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + w / 2 + 10, y - 1)
  ctx.lineTo(x + w / 2 + 15, y - 14)
  ctx.lineTo(x + w / 2 + 4, y - 3)
  ctx.fill()

  // --- 眼睛 ---
  ctx.fillStyle = '#1F2937'
  ctx.beginPath()
  ctx.arc(x + w / 2 - 4, y + 4, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + w / 2 + 8, y + 4, 3, 0, Math.PI * 2)
  ctx.fill()

  // 眼睛高光
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(x + w / 2 - 3, y + 3, 1.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + w / 2 + 9, y + 3, 1.2, 0, Math.PI * 2)
  ctx.fill()

  // --- 尾巴 ---
  ctx.fillStyle = bodyColor
  ctx.beginPath()
  ctx.moveTo(x - 4, y + 24)
  ctx.quadraticCurveTo(x - 20, y + 14, x - 14, y - 2)
  ctx.quadraticCurveTo(x - 6, y - 6, x - 4, y + 6)
  ctx.fill()

  // 尾巴尖（白色）
  ctx.fillStyle = bellyColor
  ctx.beginPath()
  ctx.arc(x - 14, y - 2, 6, 0, Math.PI * 2)
  ctx.fill()

  // --- 腿（带跑步动画） ---
  ctx.fillStyle = bodyColor
  const legPhase = score.value % 20 < 10 ? 0 : 3
  // 前腿
  ctx.fillRect(x + 6, y + h - 14, 8, 14 - legPhase)
  // 后腿
  ctx.fillRect(x + w - 14, y + h - 14, 8, 14 + legPhase)

  // 跳跃时腿收起
  if (player.isJumping) {
    ctx.fillStyle = bodyColor
    ctx.fillRect(x + 6, y + h - 10, 8, 10)
    ctx.fillRect(x + w - 14, y + h - 8, 8, 8)
  }

  ctx.restore()
}

/** 绘制障碍物 */
function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
  if (obs.type === 'bone') {
    // 绘制骨头（主体 + 两端圆头）
    ctx.fillStyle = palette.boneFill
    ctx.fillRect(obs.x, obs.y + 4, obs.width, obs.height - 8)
    ctx.beginPath()
    ctx.arc(obs.x, obs.y + obs.height / 2, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(obs.x + obs.width, obs.y + obs.height / 2, 8, 0, Math.PI * 2)
    ctx.fill()
    // 中部镂空高光，增加立体感
    ctx.fillStyle = palette.boneShade
    ctx.fillRect(obs.x, obs.y + 8, obs.width, obs.height - 16)
  } else {
    // 绘制树桩
    ctx.fillStyle = palette.stumpFill
    roundRect(ctx, obs.x, obs.y, obs.width, obs.height, 6)
    ctx.fill()
    // 年轮（镂空色，双主题下均与树桩主体形成对比）
    ctx.strokeStyle = palette.stumpRing
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 3, 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 3, 3, 0, Math.PI * 2)
    ctx.stroke()
  }
}

/** 生成障碍物 */
function spawnObstacle() {
  const types: Obstacle['type'][] = ['bone', 'stump']
  const type = types[Math.floor(Math.random() * types.length)]
  const isBone = type === 'bone'

  const obs: Obstacle = {
    x: canvasWidth + 20,
    y: GROUND_Y + player.height - (isBone ? 30 : 40),
    width: isBone ? 30 : 20,
    height: isBone ? 20 : 40,
    type,
    active: true
  }
  obstacles.push(obs)
}

/** 碰撞检测（AABB 矩形碰撞） */
function checkCollision(a: { x: number; y: number; width: number; height: number },
                        b: { x: number; y: number; width: number; height: number }): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/** 生成粒子 */
function spawnParticles(x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: -Math.random() * 4 - 2,
      life: 20 + Math.floor(Math.random() * 10),
      maxLife: 30,
      size: 2 + Math.random() * 3
    })
  }
}

/** 游戏结束 */
function endGame() {
  gameRunning = false
  isGameOver.value = true
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  emit('gameover', score.value)
}

/** 退出游戏 */
function handleExit() {
  gameRunning = false
  isGameOver.value = true
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  emit('exit')
}

/** 执行跳跃（仅当角色在地面上时有效） */
function jump() {
  if (!gameRunning || isGameOver.value) return
  if (!player.isJumping) {
    player.vy = JUMP_FORCE
    player.isJumping = true
  }
}

/** 点击 / 触摸画布跳跃（移动端支持） */
function handleTapJump() {
  jump()
}

/** 处理键盘输入 */
function handleControlKey(e: KeyboardEvent) {
  if (!gameRunning || isGameOver.value) return

  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    e.preventDefault()
    jump()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    handleExit()
  }
}

/** 辅助：圆角矩形 */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number,
                   w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// 生命周期
onMounted(() => {
  // 用当前主题的计算值刷新调色板，并监听后续主题切换
  refreshPalette()
  themeObserver = new MutationObserver(refreshPalette)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })

  window.addEventListener('keydown', handleControlKey)
  startGame()
})

onUnmounted(() => {
  themeObserver?.disconnect()
  themeObserver = null
  window.removeEventListener('keydown', handleControlKey)
  gameRunning = false
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
})

// 暴露到模板给移动端使用
defineExpose({ startGame, handleExit })
</script>

<style scoped>
/* ---------- 游戏容器（叠加全局 .card 工具类） ---------- */
.dino-game {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

/* ---------- HUD 信息栏 ---------- */
.game-hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
}

.hud-stats {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* 数据徽章：胶囊形小标签，数字用等宽字体避免跳动 */
.hud-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px 10px;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.hud-chip-score {
  color: var(--color-accent);
  background: var(--color-accent-bg);
  border-color: transparent;
}

.hud-num {
  font-family: var(--font-mono);
  font-weight: 700;
  /* 等宽数字 + 固定最小宽度，分数增长时布局不抖动 */
  min-width: 3ch;
  text-align: right;
}

.game-exit-btn {
  flex-shrink: 0;
}

/* ---------- Canvas 画布 ---------- */
.game-canvas {
  display: block;
  width: 100%;
  max-width: 800px;
  height: auto;
  cursor: pointer;
  /* 移动端禁用双击缩放与触摸滚动，保证连点跳跃手感 */
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* ---------- 操作提示 ---------- */
.game-tip {
  text-align: center;
  padding: var(--space-3) var(--space-4);
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border);
}

.game-tip kbd {
  display: inline-block;
  padding: 1px 6px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-bottom-width: 2px;
  border-radius: var(--radius-sm);
  font-size: 0.9em;
  font-family: var(--font-mono);
  color: var(--color-text-secondary);
  line-height: 1.4;
}
</style>
