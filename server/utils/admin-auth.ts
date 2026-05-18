/**
 * ============================================================
 *  管理后台鉴权工具
 *  基于 cookie + 签名 token 的简单鉴权
 * ============================================================
 */
import { createHash, randomBytes } from 'node:crypto'

/** session token 有效期 24 小时 */
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000

/** 内存中的 session 表（简单实现，重启后清空） */
const sessions = new Map<string, { createdAt: number }>()

/**
 * 生成安全的随机 token
 */
function generateToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * 验证密码
 */
export function verifyPassword(password: string): boolean {
  const config = useRuntimeConfig()
  const adminPassword = config.adminPassword as string
  if (!adminPassword) return false
  return password === adminPassword
}

/**
 * 创建 session，设置 cookie
 */
export async function createSession(event: any): Promise<void> {
  const token = generateToken()
  sessions.set(token, { createdAt: Date.now() })

  // 清理过期 session
  cleanExpiredSessions()

  setCookie(event, 'admin_token', token, {
    httpOnly: true,
    secure: false, // 本地开发关闭，生产请设为 true
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE / 1000
  })
}

/**
 * 验证当前请求是否已登录
 */
export function isAuthenticated(event: any): boolean {
  const token = getCookie(event, 'admin_token')
  if (!token) return false

  const session = sessions.get(token)
  if (!session) return false

  // 检查是否过期
  if (Date.now() - session.createdAt > SESSION_MAX_AGE) {
    sessions.delete(token)
    return false
  }

  return true
}

/**
 * 销毁 session
 */
export function destroySession(event: any): void {
  const token = getCookie(event, 'admin_token')
  if (token) sessions.delete(token)
  deleteCookie(event, 'admin_token', { path: '/' })
}

/**
 * 鉴权中间件：未登录返回 401
 */
export function requireAuth(event: any): void {
  if (!isAuthenticated(event)) {
    throw createError({
      statusCode: 401,
      message: '未登录或登录已过期'
    })
  }
}

/**
 * 清理过期 session
 */
function cleanExpiredSessions() {
  const now = Date.now()
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_MAX_AGE) {
      sessions.delete(token)
    }
  }
}
