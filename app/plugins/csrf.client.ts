/**
 * ============================================================
 *  CSRF Token 客户端插件
 *  自动从 Cookie 读取 CSRF Token 并附加到所有 POST/DELETE 请求
 *  与 server/utils/csrf.ts 的 Double-Submit Cookie 模式配合
 * ============================================================
 */

export default defineNuxtPlugin({
  name: 'csrf-protection',
  setup() {
    /**
     * 从 Cookie 中读取指定名称的值
     */
    function getCookieValue(name: string): string | null {
      if (typeof document === 'undefined') return null
      const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
      return match ? decodeURIComponent(match[1]!) : null
    }

    // 使用 Proxy 安全地拦截 $fetch，附加 CSRF Token
    const origFetch = globalThis.$fetch
    if (origFetch && !(origFetch as any).__csrfPatched) {
      const wrappedFetch = function (request: any, options?: any) {
        const opts = { ...options }
        opts.headers = { ...opts.headers }

        // 仅对状态变更方法添加 CSRF Token
        const method = (opts.method || 'GET').toUpperCase()
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const token = getCookieValue('csrf_token')
          if (token && !opts.headers['x-csrf-token']) {
            opts.headers['x-csrf-token'] = token
          }
        }

        return origFetch(request, opts)
      }
      ;(wrappedFetch as any).__csrfPatched = true
      globalThis.$fetch = wrappedFetch as typeof globalThis.$fetch
    }
  }
})
