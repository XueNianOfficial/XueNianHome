<!--
============================================================
  鼠标光晕 + 弹性丝带拖尾特效
  跟随鼠标的环境光晕与连续发光丝带拖尾，目前用于首页
============================================================
-->
<template>
  <!-- 触屏设备与「减弱动效」用户不渲染此特效（enabled 恒为 false） -->
  <div v-if="enabled" ref="fxRef" class="cursor-fx" :class="{ 'is-active': isActive }" aria-hidden="true">
    <!-- 大光晕：缓慢追随鼠标的环境光（DOM + CSS 渐变，自动跟随主题色） -->
    <div ref="glowRef" class="cursor-glow"></div>
    <!-- 丝带拖尾：Canvas 绘制的连续光带 -->
    <canvas ref="canvasRef" class="trail-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  CursorGlow - 鼠标光晕与弹性丝带拖尾特效组件
 *  - 拖尾：「弹性链」方案。一串节点逐节 lerp 跟随（头部追鼠标、
 *    每节追前一节），转弯自然圆滑、自带惯性；鼠标静止时各节
 *    继续向头部收敛——拖尾像「收进光点」般优雅收尾，
 *    而非旧版「时间戳过期剔除」那样整条凭空消失
 *  - 渲染：沿链条按弧长均匀重采样，逐个盖「软圆印章」
 *    （预渲染的径向渐变贴图，drawImage 绘制，性能极佳）；
 *    半径与透明度仅从头部向尾部平滑递减，无分段、无接缝，
 *    彻底消除旧版「逐段独立描边」的串珠式生硬感
 *  - 活跃度：由鼠标实时速度驱动，连续地在 0~1 间升降——
 *    移动即刻点亮，静止时余韵式渐隐（上升快、下降慢）
 *  - 点击反馈：mousedown 触发粒子爆发（径向速度 + 阻力 + 微重力）
 *    与扩散涟漪（accent 描边圆 8→72px 淡出）
 *  - 星光微粒：拖尾头部区域按概率洒出小光点（accent 向白混合 65%），
 *    正弦闪烁后熄灭，数量上限 30 粒；与点击特效共用独立 FX 通道，
 *    不受活跃度渐隐影响
 *  - 光晕：DOM 径向渐变 + lerp 追随，color-mix 取主题色
 *  - 丝带颜色从 --color-accent 读取，主题切换时重新生成贴图
 *  - 仅在「精确指针（鼠标）且未要求减弱动效」时启用
 * ============================================================
 */

/** 链条节点（拖尾骨架上的一个关节） */
interface ChainNode {
  x: number
  y: number
}

/** 点击爆发粒子 */
interface BurstParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  radius: number
}

/** 点击涟漪（扩散描边圆） */
interface Ripple {
  x: number
  y: number
  life: number
  maxLife: number
}

/** 拖尾头部洒出的星光微粒 */
interface Sparkle {
  x: number
  y: number
  life: number
  maxLife: number
  radius: number
  /** 闪烁相位（正弦驱动亮度） */
  phase: number
}

/** 链条节点数：越多拖尾越长、越飘逸 */
const TRAIL_NODES = 26
/** 头部跟随系数（0~1，越小惯性越明显） */
const HEAD_EASE = 0.35
/** 身体节点跟随前一节的系数（0~1，越小越 Q 弹） */
const BODY_EASE = 0.45
/** 沿链条弧长的印章间距（像素）：足够小以保证视觉连续 */
const STAMP_STEP = 3.5
/** 头部印章半径（像素），向尾部递减至接近 0 */
const HEAD_RADIUS = 7
/** 达到全亮所需的鼠标速度（像素/帧） */
const FULL_SPEED = 24
/** 活跃度每帧上升速率（移动即刻点亮） */
const ACTIVITY_UP = 0.28
/** 活跃度每帧下降速率（缓慢收尾，留有馀韵） */
const ACTIVITY_DOWN = 0.045
/** 光晕追随系数（0~1，越小越「慵懒」） */
const GLOW_EASE = 0.14
/** 鼠标静止多久后整体淡出（毫秒，主要影响光晕） */
const IDLE_TIMEOUT = 1400
/** 点击爆发粒子数 */
const BURST_COUNT = 14
/** 粒子每帧速度衰减（阻力系数） */
const BURST_DRAG = 0.92
/** 粒子微重力（每帧 vy 增量，让碎屑轻微下坠） */
const BURST_GRAVITY = 0.04
/** 涟漪扩散半径（起 → 止，像素）与持续帧数 */
const RIPPLE_R0 = 8
const RIPPLE_R1 = 72
const RIPPLE_LIFE = 36
/** 星光微粒：同时在场上限、拖尾头部盖章时的洒出概率 */
const SPARKLE_MAX = 30
const SPARKLE_CHANCE = 0.06
/** 星光颜色 = 主色向白混合比例 */
const SPARKLE_WHITE_MIX = 0.65
/** 窗口缩放防抖间隔（毫秒） */
const RESIZE_DEBOUNCE = 200

const enabled = ref(false)
const isActive = ref(false)
const glowRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

let rafId = 0
let idleTimer: ReturnType<typeof setTimeout> | undefined
/** 鼠标最新坐标 */
let mouseX = -100
let mouseY = -100
/** 光晕当前坐标（每帧 lerp 逼近鼠标） */
let glowX = -100
let glowY = -100
let hasMoved = false
/** 拖尾链条：nodes[0] 为头部（追鼠标），其余逐节跟随 */
const nodes: ChainNode[] = Array.from({ length: TRAIL_NODES }, () => ({ x: -100, y: -100 }))
/**
 * 活跃度（0~1）：丝带整体透明度乘子。
 * 由鼠标速度驱动，连续升降——这是「静止时渐隐而非消失」的关键
 */
let activity = 0
/** 本帧内鼠标事件的累计位移（每帧由 tick 消费并清零） */
let moveDist = 0
let ctx: CanvasRenderingContext2D | null = null
let glowEl: HTMLElement | null = null
/** 丝带颜色（从 CSS 变量读取，主题切换时由 MutationObserver 更新） */
let accentColor = '#4A90D9'
/** 软圆印章贴图（离屏画布，随主题色重新生成） */
let trailSprite: HTMLCanvasElement | null = null
let themeObserver: MutationObserver | null = null
/** 主色 RGB（涟漪描边、粒子混合用，随主题切换更新） */
let accentRgb: [number, number, number] = [74, 144, 217]
/** 星光颜色（主色向白混合后的 rgb() 字符串，随主题切换更新） */
let sparkleColor = 'rgb(208, 228, 251)'
/** 点击爆发粒子池 */
const bursts: BurstParticle[] = []
/** 涟漪池 */
const ripples: Ripple[] = []
/** 星光微粒池 */
const sparkles: Sparkle[] = []
/** resize 防抖计时器 */
let resizeTimer: ReturnType<typeof setTimeout> | undefined

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/** 读取主题主色（亮/暗主题的值不同，切换时重读） */
function readAccentColor(): void {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
  if (value) accentColor = value
  updateAccentDerived()
}

/** 主色变化后刷新派生量：RGB 三元组与星光混合色（主色 → 白 65%） */
function updateAccentDerived(): void {
  accentRgb = parseHexColor(accentColor)
  const mix = (c: number): number => Math.round(c + (255 - c) * SPARKLE_WHITE_MIX)
  sparkleColor = `rgb(${mix(accentRgb[0])}, ${mix(accentRgb[1])}, ${mix(accentRgb[2])})`
}

/** 解析 #rgb / #rrggbb 颜色为 [r, g, b]，解析失败时回退默认主色 */
function parseHexColor(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const num = Number.parseInt(h, 16)
  if (h.length !== 6 || Number.isNaN(num)) return [74, 144, 217]
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

/**
 * 生成软圆印章贴图：中心实、边缘透明的径向渐变圆。
 * 每帧只需 drawImage 盖章，避免反复创建径向渐变的开销；
 * 主题切换后调用一次重新生成即可
 */
function buildTrailSprite(): void {
  const SIZE = 64
  const sprite = document.createElement('canvas')
  sprite.width = SIZE
  sprite.height = SIZE
  const sctx = sprite.getContext('2d')
  if (!sctx) return
  const [r, g, b] = parseHexColor(accentColor)
  const half = SIZE / 2
  const gradient = sctx.createRadialGradient(half, half, 0, half, half, half)
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`)
  gradient.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.55)`)
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  sctx.fillStyle = gradient
  sctx.fillRect(0, 0, SIZE, SIZE)
  trailSprite = sprite
}

/** 适配高分屏：按 devicePixelRatio 放大画布并同步变换坐标系 */
function resizeCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function onMouseMove(e: MouseEvent): void {
  const nx = e.clientX
  const ny = e.clientY

  if (!hasMoved) {
    // 首次移动：光晕与链条整体归位，避免从屏幕角落拉出一条长线
    hasMoved = true
    glowX = nx
    glowY = ny
    for (const node of nodes) {
      node.x = nx
      node.y = ny
    }
  } else {
    // 累计本帧位移，供 tick 换算活跃度
    moveDist += Math.hypot(nx - mouseX, ny - mouseY)
  }

  mouseX = nx
  mouseY = ny
  // 移动期间保持显示，静止 IDLE_TIMEOUT 后整体淡出（主要收光晕）
  isActive.value = true
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    isActive.value = false
  }, IDLE_TIMEOUT)
}

/**
 * 更新链条与活跃度（每帧）：
 * - 活跃度向「本帧速度换算的目标值」连续逼近，上升快、下降慢
 * - 头部 lerp 追鼠标，身体逐节 lerp 追前一节；
 *   鼠标静止时各节持续收敛，拖尾逐节缩短直至收进头部
 */
function updateChain(): void {
  const target = Math.min(1, moveDist / FULL_SPEED)
  moveDist = 0
  activity += (target - activity) * (target > activity ? ACTIVITY_UP : ACTIVITY_DOWN)
  if (activity < 0.003) activity = 0

  const head = nodes[0]
  head.x = lerp(head.x, mouseX, HEAD_EASE)
  head.y = lerp(head.y, mouseY, HEAD_EASE)
  for (let i = 1; i < nodes.length; i++) {
    nodes[i].x = lerp(nodes[i].x, nodes[i - 1].x, BODY_EASE)
    nodes[i].y = lerp(nodes[i].y, nodes[i - 1].y, BODY_EASE)
  }
}

/**
 * 在 (x, y) 处盖一枚软圆印章。
 * u 为弧长位置（0 头部 → 1 尾部），半径与透明度随之平滑递减；
 * 画两层：大而淡的外层柔光 + 小而实的内层核心
 */
function stamp(x: number, y: number, u: number): void {
  if (!ctx || !trailSprite) return
  const fade = 1 - u
  const radius = HEAD_RADIUS * Math.pow(fade, 0.75) + 0.3
  const baseAlpha = 0.5 * Math.pow(fade, 1.15) * activity
  if (radius < 0.3 || baseAlpha < 0.008) return

  // 外层柔光
  const outer = radius * 2.6
  ctx.globalAlpha = baseAlpha * 0.32
  ctx.drawImage(trailSprite, x - outer, y - outer, outer * 2, outer * 2)
  // 内层核心
  ctx.globalAlpha = baseAlpha
  ctx.drawImage(trailSprite, x - radius, y - radius, radius * 2, radius * 2)

  // 拖尾头部区域按概率洒出星光微粒（正弦闪烁后自然熄灭，有场上限）
  if (activity > 0.3 && u < 0.25 && sparkles.length < SPARKLE_MAX && Math.random() < SPARKLE_CHANCE) {
    sparkles.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      life: 0,
      maxLife: 40 + Math.random() * 40,
      radius: 0.8 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2
    })
  }
}

/**
 * 绘制丝带拖尾（每帧）：
 * - 第一遍遍历链条求总弧长（衰减基准）
 * - 第二遍沿弧长按 STAMP_STEP 均匀重采样盖章——
 *   无论链条拉伸还是收缩，印章间距恒定，宽度曲线稳定不抖动
 */
function drawTrail(): void {
  if (!ctx || !trailSprite) return
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  if (activity <= 0) return

  // 第一遍：链条总弧长
  let total = 0
  for (let i = 1; i < nodes.length; i++) {
    total += Math.hypot(nodes[i].x - nodes[i - 1].x, nodes[i].y - nodes[i - 1].y)
  }
  if (total < 1) return

  // 第二遍：沿弧长均匀盖章
  let s = 0 // 已走过的弧长
  let gap = 0 // 距上一枚印章的弧长
  let px = nodes[0].x
  let py = nodes[0].y
  stamp(px, py, 0)
  for (let i = 1; i < nodes.length; i++) {
    const nx = nodes[i].x
    const ny = nodes[i].y
    let segLen = Math.hypot(nx - px, ny - py)
    // 段内按固定间距补印章（印章点成为新的段内起点）
    while (gap + segLen >= STAMP_STEP) {
      const need = STAMP_STEP - gap
      const ratio = need / segLen
      px += (nx - px) * ratio
      py += (ny - py) * ratio
      segLen -= need
      s += STAMP_STEP
      stamp(px, py, s / total)
      gap = 0
    }
    gap += segLen
    s += segLen
    px = nx
    py = ny
  }
  ctx.globalAlpha = 1
}

/** 点击：在指针处生成一圈爆发粒子 + 一道扩散涟漪，并刷新整体淡出计时 */
function onMouseDown(e: MouseEvent): void {
  for (let i = 0; i < BURST_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1.5 + Math.random() * 3
    bursts.push({
      x: e.clientX,
      y: e.clientY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 40 + Math.random() * 30,
      radius: 1 + Math.random() * 1.6
    })
  }
  ripples.push({ x: e.clientX, y: e.clientY, life: 0, maxLife: RIPPLE_LIFE })

  // 点击也算一次「活动」：保持特效容器可见
  isActive.value = true
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    isActive.value = false
  }, IDLE_TIMEOUT)
}

/** 推进点击粒子 / 涟漪 / 星光微粒的生命周期（独立于拖尾活跃度） */
function updateFX(): void {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const p = bursts[i]
    p.vx *= BURST_DRAG
    p.vy = p.vy * BURST_DRAG + BURST_GRAVITY
    p.x += p.vx
    p.y += p.vy
    p.life++
    if (p.life >= p.maxLife) bursts.splice(i, 1)
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].life++
    if (ripples[i].life >= ripples[i].maxLife) ripples.splice(i, 1)
  }
  for (let i = sparkles.length - 1; i >= 0; i--) {
    sparkles[i].life++
    if (sparkles[i].life >= sparkles[i].maxLife) sparkles.splice(i, 1)
  }
}

/** 绘制点击粒子 / 涟漪 / 星光微粒（在拖尾之后叠加，复用其柔圆贴图） */
function drawFX(): void {
  if (!ctx) return

  // 涟漪：accent 描边圆从 RIPPLE_R0 扩散到 RIPPLE_R1 并淡出
  for (const r of ripples) {
    const t = r.life / r.maxLife
    const radius = RIPPLE_R0 + (RIPPLE_R1 - RIPPLE_R0) * t
    ctx.strokeStyle = `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, ${(0.5 * (1 - t)).toFixed(3)})`
    ctx.lineWidth = 2 * (1 - t) + 0.5
    ctx.beginPath()
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  // 爆发粒子：盖柔圆印章，发光质感与拖尾统一
  if (trailSprite) {
    for (const p of bursts) {
      const t = p.life / p.maxLife
      ctx.globalAlpha = 0.8 * (1 - t)
      ctx.drawImage(trailSprite, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2)
    }
    ctx.globalAlpha = 1
  }

  // 星光微粒：正弦闪烁的小亮点
  if (sparkles.length > 0) {
    ctx.fillStyle = sparkleColor
    for (const s of sparkles) {
      const t = s.life / s.maxLife
      const twinkle = 0.5 + 0.5 * Math.sin(s.phase + s.life * 0.35)
      ctx.globalAlpha = (1 - t) * twinkle * 0.9
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

/** resize 防抖：窗口连续变化时只在停顿后重建画布 */
function onResizeDebounced(): void {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(resizeCanvas, RESIZE_DEBOUNCE)
}

/** 动画主循环：更新光晕位置、推进链条并重绘丝带与 FX 叠加层 */
function tick(): void {
  glowX = lerp(glowX, mouseX, GLOW_EASE)
  glowY = lerp(glowY, mouseY, GLOW_EASE)
  if (glowEl) {
    glowEl.style.transform = `translate3d(${glowX}px, ${glowY}px, 0) translate(-50%, -50%)`
  }
  updateChain()
  drawTrail()
  updateFX()
  drawFX()
  rafId = requestAnimationFrame(tick)
}

/** 页面切到后台时暂停动画循环，回到前台再继续（省电、避免后台空转） */
function onVisibilityChange(): void {
  if (document.hidden) {
    cancelAnimationFrame(rafId)
  } else {
    rafId = requestAnimationFrame(tick)
  }
}

onMounted(() => {
  // 仅在鼠标设备 + 用户未要求减弱动效时启用
  const finePointer = window.matchMedia('(pointer: fine)').matches
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!finePointer || reducedMotion) return

  enabled.value = true

  // v-if 切换后等 DOM 渲染完成，再初始化画布并启动循环
  nextTick(() => {
    glowEl = glowRef.value
    const canvas = canvasRef.value
    if (!canvas) return
    ctx = canvas.getContext('2d')
    if (!ctx) return

    readAccentColor()
    buildTrailSprite()
    resizeCanvas()

    // 主题切换会改变根元素 class / data-theme，届时重读主色并重建贴图
    themeObserver = new MutationObserver(() => {
      readAccentColor()
      buildTrailSprite()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style']
    })

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mousedown', onMouseDown, { passive: true })
    window.addEventListener('resize', onResizeDebounced, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    rafId = requestAnimationFrame(tick)
  })
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  clearTimeout(idleTimer)
  clearTimeout(resizeTimer)
  themeObserver?.disconnect()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mousedown', onMouseDown)
  window.removeEventListener('resize', onResizeDebounced)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped>
/* ---------- 特效容器：覆盖全屏但不拦截任何交互 ---------- */
.cursor-fx {
  position: fixed;
  inset: 0;
  /* 低于导航/弹窗/通知（--z-header=100），不干扰任何交互 UI */
  z-index: calc(var(--z-header) - 40);
  pointer-events: none;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.cursor-fx.is-active {
  opacity: 1;
}

/* ---------- 鼠标光晕：accent 色径向渐变柔光 ---------- */
.cursor-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 480px;
  height: 480px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--color-accent) 15%, transparent) 0%,
    color-mix(in srgb, var(--color-accent) 6%, transparent) 40%,
    transparent 70%
  );
  /* 初始藏在屏外，首次 mousemove 时归位 */
  transform: translate3d(-100px, -100px, 0) translate(-50%, -50%);
  will-change: transform;
}

/* ---------- 丝带画布：铺满容器，尺寸由 JS 按 DPR 设置 ---------- */
.trail-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
