/**
 * ============================================================
 *  雪年个人网站 - 主题管理 Composable（独立实现）
 *  管理亮色/暗色主题切换，使用 localStorage 持久化
 *  纯 Vue API 实现，无需外部依赖
 * ============================================================
 */

/** localStorage 存储键 */
const STORAGE_KEY = 'xuenian-theme'

/** 全局单例状态 */
const isDark = ref<boolean>(false)

/** 是否已初始化 */
let initialized = false

/** matchMedia 监听器引用（用于后续清理） */
let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null

/**
 * 全局主题 Composable
 * @returns isDark - 当前是否为暗色模式（响应式 ref）
 * @returns toggleTheme - 切换主题的函数
 */
export function useTheme() {
  /**
   * 初始化主题（仅执行一次）
   * 优先级：localStorage > 系统偏好 > 默认亮色
   */
  function initTheme() {
    if (initialized || typeof window === 'undefined') return
    initialized = true

    const stored = localStorage.getItem(STORAGE_KEY)

    if (stored === 'dark') {
      isDark.value = true
    } else if (stored === 'light') {
      isDark.value = false
    } else {
      // 跟随系统偏好
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }

    applyTheme()

    // 监听系统主题变化（保存引用以便清理）
    mediaQueryListener = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        isDark.value = e.matches
        applyTheme()
      }
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mediaQueryListener)
  }

  /**
   * 应用主题到 DOM（在 html 元素上添加/移除 'dark' 类）
   */
  function applyTheme() {
    if (typeof document === 'undefined') return
    const html = document.documentElement

    if (isDark.value) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  /**
   * 切换亮色/暗色主题
   */
  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  // 自动初始化
  initTheme()

  return {
    isDark,
    toggleTheme
  }
}
