/**
 * ============================================================
 *  CSRF 防护工具
 *  使用 Double-Submit Cookie 模式：
 *  1. 服务端设置可读 Cookie（csrf_token）
 *  2. 客户端读取后放入 X-CSRF-Token 请求头
 *  3. 服务端校验 Cookie 与 Header 一致
 * ============================================================
 */
import { randomBytes } from 'node:crypto'

/** CSRF Token 字节长度 */
const TOKEN_BYTES = 32

/** Cookie 名称 */
const CSRF_COOKIE = 'csrf_token'

/** 请求头名称 */
const CSRF_HEADER = 'x-csrf-token'

/** 生成安全的 CSRF Token */
export function generateCsrfToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex')
}

/**
 * 为响应设置 CSRF Token Cookie
 * 注意：此 Cookie 不能设为 httpOnly，因为客户端 JS 需要读取它
 */
export function setCsrfCookie(event: any): void {
  // 仅在尚未设置时生成，避免每次请求都刷新
  const existing = getCookie(event, CSRF_COOKIE)
  if (existing) return

  const token = generateCsrfToken()
  setCookie(event, CSRF_COOKIE, token, {
    httpOnly: false,          // 客户端 JS 需要读取
    secure: isProductionEnv(),
    sameSite: 'strict',       // 严格同站，防止跨站携带
    path: '/',
    maxAge: 86400             // 24 小时
  })
}

/**
 * 校验 CSRF Token（Double-Submit Cookie 验证）
 * @returns true 表示校验通过
 */
export function validateCsrf(event: any): boolean {
  const cookieToken = getCookie(event, CSRF_COOKIE)
  const headerToken = getHeader(event, CSRF_HEADER)

  if (!cookieToken || !headerToken) return false

  // 常量时间比较，防止时序攻击
  if (cookieToken.length !== headerToken.length) return false

  let diff = 0
  for (let i = 0; i < cookieToken.length; i++) {
    diff |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i)
  }
  return diff === 0
}

/**
 * CSRF 保护中间件：对状态变更请求强制校验
 * @param event - H3 事件对象
 * @throws 403 错误（校验失败时）
 */
export function csrfProtection(event: any): void {
  // 仅对状态变更方法进行 CSRF 校验
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  if (safeMethods.includes(event.method)) return

  if (!validateCsrf(event)) {
    throw createError({
      statusCode: 403,
      message: 'CSRF 校验失败，请刷新页面后重试'
    })
  }
}

/** 是否为生产环境 */
function isProductionEnv(): boolean {
  return (globalThis as any).process?.env?.NODE_ENV === 'production'
}
