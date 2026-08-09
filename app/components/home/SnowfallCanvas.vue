<template>
  <canvas
    v-if="enabled"
    ref="canvasRef"
    class="snowfall-canvas"
    aria-hidden="true"
  ></canvas>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  SnowfallCanvas - 首页 Hero 区雪花粒子画布
 *  - 3 层景深（远层小/慢/淡，近层大/快/实），预渲染软圆 sprite
 *    批量 drawImage，避免每帧径向渐变开销
 *  - 鼠标横向移动产生"风场"，雪花随风偏移（仅 pointer:fine）
 *  - 数量随容器宽度自适应（clamp 40~150），DPR 上限 2，
 *    resize 防抖 200ms，页面隐藏时暂停 rAF
 *  - 动画减弱模式下不渲染（v-if 直接不创建画布）
 * ============================================================
 */

interface Snowflake {
  x: number
  y: number
  r: number
  /** 下落速度 px/帧（60fps 基准） */
  vy: number
  /** 横向摆动相位/幅度 */
  phase: number
  sway: number
  /** 所属层级 0远 1中 2近 */
  layer: number
  alpha: number
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const enabled = ref(false)

let ctx: CanvasRenderingContext2D | null = null
let flakes: Snowflake[] = []
let rafId: number | null = null
let width = 0
let height = 0
let dpr = 1
/** 风场强度（-1 ~ 1，由鼠标横向速度驱动，逐帧衰减） */
let wind = 0
let windTarget = 0
let lastPointerX: number | null = null
let sprite: HTMLCanvasElement | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null
let running = false

/** 各层参数：半径、速度、透明度区间（远小慢淡 → 近大快实） */
const LAYERS = [
  { rMin: 0.6, rMax: 1.6, vMin: 0.25, vMax: 0.5, aMin: 0.25, aMax: 0.45, sway: 0.4 },
  { rMin: 1.4, rMax: 2.6, vMin: 0.5, vMax: 0.9, aMin: 0.45, aMax: 0.65, sway: 0.7 },
  { rMin: 2.4, rMax: 4.2, vMin: 0.9, vMax: 1.5, aMin: 0.65, aMax: 0.95, sway: 1.1 }
] as const

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** 预渲染白色软圆 sprite（所有雪花共用，靠 alpha/尺寸区分层次） */
function createSprite(): HTMLCanvasElement {
  const size = 32
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const sctx = c.getContext('2d')!
  const g = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 255, 255, 1)')
  g.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)')
  g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  sctx.fillStyle = g
  sctx.fillRect(0, 0, size, size)
  return c
}

function spawnFlakes(): void {
  const count = Math.round(Math.min(150, Math.max(40, width / 10)))
  flakes = []
  for (let i = 0; i < count; i++) {
    // 按面积均匀分配层级：远 45% 中 35% 近 20%
    const roll = Math.random()
    const layer = roll < 0.45 ? 0 : roll < 0.8 ? 1 : 2
    const cfg = LAYERS[layer]
    flakes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: rand(cfg.rMin, cfg.rMax),
      vy: rand(cfg.vMin, cfg.vMax),
      phase: Math.random() * Math.PI * 2,
      sway: cfg.sway,
      layer,
      alpha: rand(cfg.aMin, cfg.aMax)
    })
  }
}

function resize(): void {
  const canvas = canvasRef.value
  if (!canvas || !canvas.parentElement) return
  const rect = canvas.parentElement.getBoundingClientRect()
  dpr = Math.min(2, window.devicePixelRatio || 1)
  width = rect.width
  height = rect.height
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  spawnFlakes()
}

function tick(): void {
  rafId = null
  if (!running || !ctx || !sprite) return

  ctx.clearRect(0, 0, width, height)

  // 风场平滑逼近目标后自然衰减（风停雪归直落）
  wind += (windTarget - wind) * 0.06
  windTarget *= 0.96

  for (const f of flakes) {
    f.y += f.vy
    f.phase += 0.008 + f.layer * 0.004
    // 横向 = 正弦摆动 + 风场（近层受风影响更大）
    f.x += Math.sin(f.phase) * f.sway * 0.3 + wind * (0.4 + f.layer * 0.5)

    // 出界回收到底/侧边循环
    if (f.y > height + f.r) {
      f.y = -f.r
      f.x = Math.random() * width
    }
    if (f.x > width + f.r) f.x = -f.r
    else if (f.x < -f.r) f.x = width + f.r

    ctx.globalAlpha = f.alpha
    const size = f.r * 2
    ctx.drawImage(sprite, f.x - f.r, f.y - f.r, size, size)
  }
  ctx.globalAlpha = 1

  rafId = requestAnimationFrame(tick)
}

function start(): void {
  if (running) return
  running = true
  if (rafId === null) rafId = requestAnimationFrame(tick)
}

function stop(): void {
  running = false
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function onPointerMove(e: PointerEvent): void {
  if (lastPointerX !== null) {
    // 鼠标横向速度映射为风场目标强度，封顶 ±2.5
    const vx = e.clientX - lastPointerX
    windTarget = Math.max(-2.5, Math.min(2.5, windTarget + vx * 0.03))
  }
  lastPointerX = e.clientX
}

function onResize(): void {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    resizeTimer = null
    resize()
  }, 200)
}

function onVisibility(): void {
  if (document.hidden) stop()
  else start()
}

onMounted(async () => {
  // 动画减弱：不渲染画布（用户明确偏好静态）
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // 先置 enabled 让 v-if 渲染出画布，下一拍再取引用初始化
  enabled.value = true
  await nextTick()
  const canvas = canvasRef.value
  if (!canvas) return

  sprite = createSprite()
  resize()

  if (window.matchMedia('(pointer: fine)').matches) {
    canvas.parentElement?.addEventListener('pointermove', onPointerMove, { passive: true })
  }
  window.addEventListener('resize', onResize, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  start()
})

onUnmounted(() => {
  stop()
  const canvas = canvasRef.value
  canvas?.parentElement?.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('visibilitychange', onVisibility)
  if (resizeTimer) clearTimeout(resizeTimer)
})
</script>

<style scoped>
.snowfall-canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
</style>
