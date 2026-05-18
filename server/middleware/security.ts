/**
 * ============================================================
 *  全局安全中间件
 *  1. 生成/刷新 CSRF Token（双 Cookie 提交模式）
 *  2. 添加安全响应头（CSP, HSTS, X-Frame-Options 等）
 *  3. 限制 HTTP 方法（仅允许 GET/POST/HEAD/OPTIONS）
 *  4. 移除框架指纹（X-Powered-By）
 * ============================================================
 */

import { setCsrfCookie } from '../utils/csrf'

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
  // 双重保障：先在此中间件设空，再通过 nitro 配置彻底移除
  setHeader(event, 'X-Powered-By', '')

  // ========== 3. CSRF Token 设置 ==========
  // 使用 double-submit cookie 模式：cookie 中存 token，JS 读取后放入请求头
  setCsrfCookie(event)

  // ========== 4. 安全响应头 ==========
  const isProduction = process.env.NODE_ENV === 'production'

  // Content-Security-Policy
  // Nuxt SSR 需要 unsafe-inline（内联样式/脚本由 Vue SFC 和 hydration 产生）
  // 注意：启用 nonce 需要全栈支持注入 nonce 属性到每个内联标签，Nuxt 默认不支持
  setHeader(event, 'Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",           // Nuxt hydration 需要内联脚本
    "style-src 'self' 'unsafe-inline'",             // Vue SFC 样式需要内联样式
    "img-src 'self' data: blob: https:",          // 允许 HTTPS 远程图片（IPX 已限制）
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
