/**
 * ============================================================
 *  CSRF Token 客户端插件
 *  使用 Proxy 拦截 $fetch，安全附加 CSRF Token
 *  保留 ofetch 的所有原生属性（.create, .raw, .native 等）
 * ============================================================
 */

export default defineNuxtPlugin({
  name: 'csrf-protection',
  setup() {
    function getCookieValue(name: string): string | null {
      if (typeof document === 'undefined') return null
      const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
      return match ? decodeURIComponent(match[1]!) : null
    }

    const origFetch = globalThis.$fetch as any
    if (!origFetch || origFetch.__csrfPatched) return

    const wrappedFetch = new Proxy(origFetch, {
      apply(_target, _thisArg, args: [any, any?]) {
        const [request, options] = args
        const opts = { ...options }
        opts.headers = { ...opts.headers }

        const method = (opts.method || 'GET').toUpperCase()
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const token = getCookieValue('csrf_token')
          if (token && !opts.headers['x-csrf-token']) {
            opts.headers['x-csrf-token'] = token
          }
        }

        return origFetch(request, opts)
      },
      get(target: any, prop: string | symbol, receiver: any) {
        return Reflect.get(target, prop, receiver)
      }
    })

    wrappedFetch.__csrfPatched = true
    globalThis.$fetch = wrappedFetch as typeof globalThis.$fetch
  }
})
