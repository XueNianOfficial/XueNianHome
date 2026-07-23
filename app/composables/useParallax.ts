/**
 * ============================================================
 *  useParallax - 滚动视差 composable
 *  - 页面内所有视差元素共享一个 rAF 循环与 layers 集合，
 *    避免每个实例各自监听 scroll / 各自开动画帧
 *  - speed > 0：元素移动慢于页面滚动（远景纵深感）
 *    speed < 0：元素反向轻漂（近景漂浮感）
 *  - 用户要求减弱动效时不注册，元素保持原位
 *  - 每帧只写 transform（合成器属性），不触发回流
 * ============================================================
 */

interface ParallaxLayer {
  el: HTMLElement
  speed: number
}

/** 全局视差层集合（仅客户端 onMounted 后才会有元素，SSR 下恒为空） */
const layers = new Set<ParallaxLayer>()
let rafId = 0

/** 视差主循环：按元素中心与视口中心的偏移量折算位移 */
function parallaxTick(): void {
  const viewportCenter = window.innerHeight / 2
  for (const layer of layers) {
    const rect = layer.el.getBoundingClientRect()
    const elementCenter = rect.top + rect.height / 2
    // 元素在视口正中时位移为 0，偏离越远位移越大
    const offset = (elementCenter - viewportCenter) * layer.speed
    layer.el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`
  }
  rafId = requestAnimationFrame(parallaxTick)
}

/**
 * 注册一个滚动视差元素
 * @param speed 视差系数，绝对值建议 0.04 ~ 0.15，过大会有眩晕感
 * @returns 绑定到模板元素上的 ref
 */
export function useParallax(speed = 0.08) {
  const el = ref<HTMLElement | null>(null)
  let layer: ParallaxLayer | null = null

  onMounted(() => {
    if (!el.value) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    layer = { el: el.value, speed }
    layers.add(layer)
    // 第一个视差元素注册时才启动共享循环
    if (!rafId) rafId = requestAnimationFrame(parallaxTick)
  })

  onUnmounted(() => {
    if (layer) {
      layers.delete(layer)
      layer = null
    }
    // 没有视差元素时停掉共享循环
    if (layers.size === 0 && rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  })

  return el
}
