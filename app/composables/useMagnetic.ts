/**
 * ============================================================
 *  useMagnetic - 磁吸按钮动效（composable）
 *  - 鼠标靠近按钮时，按钮向指针方向轻微吸附，离开时回弹
 *  - 多元素共享单个 rAF 循环（模块级 Map 注册），静止后自动停帧
 *  - 位移有硬上限，避免按钮"跑丢"；回弹经 lerp 平滑归零
 *  - 仅指针精确设备且未开启动画减弱时生效；SSR 安全
 * ============================================================
 */

import type { ComponentPublicInstance } from 'vue'

interface MagneticState {
  el: HTMLElement
  strength: number
  maxOffset: number
  targetX: number
  targetY: number
  curX: number
  curY: number
  inside: boolean
  dirty: boolean
}

interface MagneticOptions {
  /** 吸附强度 0~1（相对元素中心到指针距离的跟随比例），默认 0.3 */
  strength?: number
  /** 位移上限（px），默认 6 */
  maxOffset?: number
}

const magStates = new Map<HTMLElement, MagneticState>()
let magRafId: number | null = null

const MAG_LERP = 0.2
const MAG_SETTLE_EPS = 0.1

function magLoop(): void {
  magRafId = null
  let hasDirty = false

  for (const st of magStates.values()) {
    if (!st.dirty) continue
    hasDirty = true

    const tx = st.inside ? st.targetX : 0
    const ty = st.inside ? st.targetY : 0
    st.curX += (tx - st.curX) * MAG_LERP
    st.curY += (ty - st.curY) * MAG_LERP

    if (!st.inside && Math.abs(st.curX) < MAG_SETTLE_EPS && Math.abs(st.curY) < MAG_SETTLE_EPS) {
      st.curX = 0
      st.curY = 0
      st.dirty = false
      st.el.style.transform = ''
      continue
    }

    st.el.style.transform = `translate(${st.curX.toFixed(2)}px, ${st.curY.toFixed(2)}px)`
  }

  if (hasDirty) magRafId = requestAnimationFrame(magLoop)
}

function magSchedule(): void {
  if (magRafId === null) magRafId = requestAnimationFrame(magLoop)
}

function magOnMove(e: PointerEvent, st: MagneticState): void {
  const rect = st.el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  let dx = (e.clientX - cx) * st.strength
  let dy = (e.clientY - cy) * st.strength
  const dist = Math.hypot(dx, dy)
  if (dist > st.maxOffset) {
    const k = st.maxOffset / dist
    dx *= k
    dy *= k
  }
  st.targetX = dx
  st.targetY = dy
  st.dirty = true
  magSchedule()
}

function magBind(el: HTMLElement | null, options: Required<MagneticOptions>): void {
  if (!el || typeof window === 'undefined') return
  if (magStates.has(el)) return
  if (!window.matchMedia('(pointer: fine)').matches) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const st: MagneticState = {
    el,
    strength: options.strength,
    maxOffset: options.maxOffset,
    targetX: 0,
    targetY: 0,
    curX: 0,
    curY: 0,
    inside: false,
    dirty: false
  }
  magStates.set(el, st)

  const moveHandler = (e: PointerEvent) => magOnMove(e, st)
  const enterHandler = () => {
    st.inside = true
    st.dirty = true
    magSchedule()
  }
  const leaveHandler = () => {
    st.inside = false
    st.dirty = true
    magSchedule()
  }
  el.addEventListener('pointermove', moveHandler)
  el.addEventListener('pointerenter', enterHandler)
  el.addEventListener('pointerleave', leaveHandler)

  // 事件解绑依赖卸载时函数 ref 收到 null 触发的统一清扫（见 bindRef），
  // 此时元素已从 DOM 断开，监听器随元素一起被 GC，无需逐个 remove
}

/**
 * 磁吸按钮 composable
 * 用法：<NuxtLink :ref="magnetic.bind"> —— 函数 ref 在挂载/卸载时自动收到元素或 null
 */
export function useMagnetic(options: MagneticOptions = {}) {
  const opts: Required<MagneticOptions> = {
    strength: options.strength ?? 0.3,
    maxOffset: options.maxOffset ?? 6
  }

  function bindRef(el: Element | ComponentPublicInstance | null): void {
    const target =
      el && '$el' in el ? ((el as ComponentPublicInstance).$el as HTMLElement) : (el as HTMLElement | null)
    if (target) magBind(target, opts)
    else if (el === null) {
      for (const key of magStates.keys()) {
        if (!key.isConnected) {
          magStates.delete(key)
          key.style.transform = ''
        }
      }
    }
  }

  return { bind: bindRef }
}
