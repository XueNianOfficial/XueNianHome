/**
 * ============================================================
 *  全局安全中间件
 *  1. 添加安全响应头（CSP, HSTS, X-Frame-Options 等）
 *  2. 限制 HTTP 方法（仅允许 GET/POST/HEAD/OPTIONS）
 *  3. 移除框架指纹（X-Powered-By）
 * ============================================================
 */

/** 允许的 HTTP 方法白名单 */
const ALLOWED_METHODS = new Set(['GET', 'POST', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
  // ========== 1. 限制 HTTP 方法 ==========
  if (!ALLOWED_METHODS.has(event.method)) {
    setResponseStatus(event, 405)
    setHeader(event, 'Allow', [...ALLOWED_METHODS].join(', '))
    return { error: 'Method Not Allowed' }
  }

  // ========== 2. 移除框架标识 ==========
  // 将 X-Powered-By 设为空值以隐藏 Nuxt 标识
  // 注：Nuxt/Nitro 可能在中件间之后设置该头，建议 nginx 端使用
  //     proxy_hide_header X-Powered-By; 作为双重保障
  setHeader(event, 'X-Powered-By', '')

  // ========== 3. 安全响应头 ==========
  const isProduction = process.env.NODE_ENV === 'production'

  // Content-Security-Policy
  // 允许同源资源 + 必要的内联样式/脚本（Nuxt SSR 需要）
  setHeader(event, 'Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",           // Nuxt hydration 需要内联脚本
    "style-src 'self' 'unsafe-inline'",             // Vue SFC 样式需要内联样式
    "img-src 'self' data: blob:",                   // 图片 + data URI + blob (canvas)
    "font-src 'self'",
    "connect-src 'self'",                           // API 请求
    "frame-ancestors 'none'",                        // 禁止被 iframe 嵌入
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '))

  // X-Content-Type-Options：禁止 MIME 嗅探
  setHeader(event, 'X-Content-Type-Options', 'nosniff')

  // X-Frame-Options：禁止被嵌入 iframe（兜底）
  setHeader(event, 'X-Frame-Options', 'DENY')

  // Referrer-Policy
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions-Policy：限制浏览器 API 权限
  setHeader(event, 'Permissions-Policy', [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()'
  ].join(', '))

  // Cross-Origin 隔离策略
  setHeader(event, 'Cross-Origin-Resource-Policy', 'same-origin')
  setHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')
  setHeader(event, 'Cross-Origin-Embedder-Policy', 'unsafe-none')

  // HSTS（仅生产环境启用，避免本地开发问题）
  if (isProduction) {
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
})
