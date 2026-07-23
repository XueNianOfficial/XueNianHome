/**
 * ============================================================
 *  雪年个人网站 - 全局 Toast 轻提示 Composable
 *  - 模块级单例状态，全站任意组件均可调用 useToast() 弹出提示
 *  - 配套的渲染组件为 components/common/AppToast.vue
 *    （已在 layouts/default.vue 中全局挂载）
 *  - 支持 success / error / info 三种类型，自动定时消失
 * ============================================================
 */

/** Toast 类型：成功（绿）/ 错误（红）/ 信息（蓝） */
export type ToastType = 'success' | 'error' | 'info'

/** 单条 Toast 数据结构 */
export interface ToastItem {
  /** 唯一 ID（自增生成，用于列表渲染 key 与手动移除） */
  id: number
  /** 提示类型 */
  type: ToastType
  /** 提示文本内容 */
  message: string
}

/** 全局 Toast 列表（模块级单例，跨组件共享） */
const toasts = ref<ToastItem[]>([])

/** 自增 ID 计数器 */
let nextId = 1

/** 默认展示时长（毫秒） */
const DEFAULT_DURATION = 3000

/**
 * 全局 Toast 提示
 * @returns toasts - 当前 Toast 列表（供 AppToast 组件渲染）
 * @returns showToast - 弹出一条提示
 * @returns success / error / info - 各类型的便捷方法
 */
export function useToast() {
  /**
   * 弹出一条 Toast 提示
   * @param message 提示文本
   * @param type 提示类型，默认 info
   * @param duration 展示时长（毫秒），默认 3000；传 0 则不自动消失
   */
  function showToast(message: string, type: ToastType = 'info', duration = DEFAULT_DURATION) {
    const id = nextId++
    toasts.value.push({ id, type, message })

    // 到点自动移除（duration 为 0 时需手动关闭，本项目暂用不到）
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }

  /** 根据 ID 移除一条 Toast（点击关闭时调用） */
  function removeToast(id: number) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  return {
    toasts: readonly(toasts),
    showToast,
    removeToast,
    /** 便捷方法：绿色成功提示 */
    success: (message: string, duration?: number) => showToast(message, 'success', duration),
    /** 便捷方法：红色错误提示 */
    error: (message: string, duration?: number) => showToast(message, 'error', duration),
    /** 便捷方法：蓝色信息提示 */
    info: (message: string, duration?: number) => showToast(message, 'info', duration)
  }
}
