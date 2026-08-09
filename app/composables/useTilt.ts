/**
 * ============================================================
 *  useTilt - 鼠标 3D 倾斜 + 眩光动效（composable）
 *  - 多元素共享单个 rAF 循环（模块级 Map 注册），仅在有元素
 *    待更新时转动，元素全部静止后自动停帧
 *  - 每帧 lerp 平滑逼近目标姿态；停止后清除内联 transform，
 *    归还给 CSS hover 过渡，避免两处 transform 打架
 *  - 同步写入 --glare-x/--glare-y CSS 变量，配合卡片 ::after
 *    伪元素渲染跟随鼠标的径向眩光
 *  - 仅指针精确设备（pointer: fine）且未开启动画减弱时生效；
 *    SSR 安全（window 访问延迟到绑定时）
 * ============================================================
 */

import type { ComponentPublicInstance } from 'vue'

/** 单个元素的倾斜状态 */
interface TiltState {
  el: HTMLElement
  maxTilt: number
  lift: number
  scale: number
  targetX: number
  targetY: number
  curX: number
  curY: number
  /** 鼠标是否在元素内（控制是否回正） */
  inside: boolean
  /** 是否还有待应用的姿态变化 */
  dirty: boolean
}

interface TiltOptions {
  /** 最大倾斜角度（度），默认 7 */
  maxTilt?: number
  /** 悬停上浮距离（px），默认 5 */
  lift?: number
  /** 悬停放大比例，默认 1.02 */
  scale?: number
}

/** 元素 -> 倾斜状态 */
const states = new Map<HTMLElement, TiltState>()
let rafId: number | null = null

/** 每帧 lerp 系数：越大跟手越快（0.18 ≈ 轻快且无明显抖动） */
const LERP = 0.18
/** 姿态/位移小于该阈值视为已静止 */
const SETTLE_EPS = 0.02

function tiltLoop(): void {
  rafId = null
  let hasDirty = false

  for (const st of states.values()) {
    if (!st.dirty) continue
    hasDirty = true

    const tx = st.inside ? st.targetX : 0
    const ty = st.inside ? st.targetY : 0
    st.curX += (tx - st.curX) * LERP
    st.curY += (ty - st.curY) * LERP

    if (Math.abs(st.curX) < SETTLE_EPS && Math.abs(st.curY) < SETTLE_EPS && !st.inside) {
      // 已回正：清除内联 transform，交还 CSS hover
      st.curX = 0
      st.curY = 0
      st.dirty = false
      st.el.style.transform = ''
      continue
    }

    const rotY = st.curX * st.maxTilt
    const rotX = -st.curY * st.maxTilt
    const lift = st.inside ? st.lift : 0
    const scale = st.inside ? st.scale : 1
    st.el.style.transform =
      `perspective(900px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)` +
      ` translateY(${(-lift).toFixed(2)}px) scale(${scale})`
  }

  if (hasDirty) rafId = requestAnimationFrame(tiltLoop)
}

function schedule(): void {
  if (rafId === null) rafId = requestAnimationFrame(tiltLoop)
}

function onMove(e: PointerEvent, st: TiltState): void {
  const rect = st.el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1 // -1 ~ 1
  const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
  st.targetX = Math.max(-1, Math.min(1, nx))
  st.targetY = Math.max(-1, Math.min(1, ny))
  // 眩光位置（百分比，供 ::after radial-gradient 使用）
  st.el.style.setProperty('--glare-x', `${(((e.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`)
  st.el.style.setProperty('--glare-y', `${(((e.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`)
  st.dirty = true
  schedule()
}

function onEnter(st: TiltState): void {
  st.inside = true
  st.dirty = true
  schedule()
}

function onLeave(st: TiltState): void {
  st.inside = false
  st.dirty = true
  schedule()
}

function unbind(el: HTMLElement): void {
  const st = states.get(el)
  if (!st) return
  states.delete(el)
  el.style.transform = ''
  el.style.removeProperty('--glare-x')
  el.style.removeProperty('--glare-y')
}

function bind(el: HTMLElement | null, options: Required<TiltOptions>): void {
  if (!el || typeof window === 'undefined') return
  if (states.has(el)) return
  if (!window.matchMedia('(pointer: fine)').matches) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const st: TiltState = {
    el,
    maxTilt: options.maxTilt,
    lift: options.lift,
    scale: options.scale,
    targetX: 0,
    targetY: 0,
    curX: 0,
    curY: 0,
    inside: false,
    dirty: false
  }
  states.set(el, st)

  const moveHandler = (e: PointerEvent) => onMove(e, st)
  const enterHandler = () => onEnter(st)
  const leaveHandler = () => onLeave(st)
  el.addEventListener('pointermove', moveHandler)
  el.addEventListener('pointerenter', enterHandler)
  el.addEventListener('pointerleave', leaveHandler)

  // 事件解绑依赖卸载时函数 ref 收到 null 触发的统一清扫（见 bindRef），
  // 此时元素已从 DOM 断开，监听器随元素一起被 GC，无需逐个 remove
}

/**
 * 3D 倾斜 composable
 * 用法：<div :ref="tilt.bind"> —— 函数 ref 在挂载/卸载时自动收到元素或 null
 */
export function useTilt(options: TiltOptions = {}) {
  const opts: Required<TiltOptions> = {
    maxTilt: options.maxTilt ?? 7,
    lift: options.lift ?? 5,
    scale: options.scale ?? 1.02
  }

  function bindRef(el: Element | ComponentPublicInstance | null): void {
    // 组件 ref 取根元素；普通元素直接用
    const target =
      el && '$el' in el ? ((el as ComponentPublicInstance).$el as HTMLElement) : (el as HTMLElement | null)
    if (target) bind(target, opts)
    else if (el === null) {
      // 卸载阶段：清理所有已断开连接的元素
      for (const key of states.keys()) {
        if (!key.isConnected) unbind(key)
      }
    }
  }

  return { bind: bindRef }
}
