/**
 * ============================================================
 *  管理后台鉴权工具
 *  基于 cookie + 签名 token 的会话管理
 *  包含登录速率限制（防暴力破解）
 *  支持多账号 — 实际密码验证委托给 admin-accounts.ts
 * ============================================================
 */

import { randomBytes } from 'node:crypto'
import { authenticateUser, ensureDefaultAccount, type AdminAccount } from './admin-accounts'

/** session token 有效期 24 小时 */
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000

/** 登录速率限制 */
const LOGIN_WINDOW_MS = 15 * 60 * 1000     // 统计窗口：15 分钟
const MAX_LOGIN_ATTEMPTS = 5               // 最大尝试次数
const LOCKOUT_DURATION_MS = 15 * 60 * 1000  // 锁定时间：15 分钟

/** 会话信息 */
interface SessionInfo {
  username: string
  displayName: string
  createdAt: number
}

/** 登录尝试记录（IP+用户名 → 尝试记录） */
interface LoginRecord {
  count: number
  firstAttempt: number
  lockedUntil: number
}

/** 内存中的 session 表（简单实现，重启后清空） */
const sessions = new Map<string, SessionInfo>()

/** 登录尝试记录 */
const loginAttempts = new Map<string, LoginRecord>()

// ========== 初始化：确保至少有一个管理员账号 ==========
ensureDefaultAccount()

// ====================================================================
//  内部工具
// ====================================================================

/** 生成安全的随机 token */
function generateToken(): string {
  return randomBytes(32).toString('hex')
}

/** 获取客户端 IP（考虑代理转发） */
export function getClientIP(event: any): string {
  const xForwardedFor = getHeader(event, 'x-forwarded-for')
  if (xForwardedFor) {
    return String(xForwardedFor).split(',')[0]!.trim()
  }
  return event.node?.req?.socket?.remoteAddress || 'unknown'
}

/** 生成登录尝试的 key */
function getAttemptKey(ip: string, username: string): string {
  return `${ip}:${username}`
}

/** 是否为生产环境 */
function isProductionEnv(): boolean {
  return (globalThis as any).process?.env?.NODE_ENV === 'production'
}

// ====================================================================
//  登录速率限制
// ====================================================================

/**
 * 检查登录频率限制（按 IP + 用户名组合）
 */
export function checkLoginRateLimit(event: any, username: string): { allowed: boolean; reason?: string } {
  const ip = getClientIP(event)
  const key = getAttemptKey(ip, username)
  const now = Date.now()
  const record = loginAttempts.get(key)

  if (!record) return { allowed: true }

  // 在锁定期内
  if (record.lockedUntil > now) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000)
    return {
      allowed: false,
      reason: `登录尝试过于频繁，请在 ${remainingMinutes} 分钟后重试`
    }
  }

  // 窗口过期
  if (now - record.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key)
    return { allowed: true }
  }

  // 超过最大尝试次数
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS
    return {
      allowed: false,
      reason: `登录尝试过于频繁，请在 ${LOCKOUT_DURATION_MS / 60000} 分钟后重试`
    }
  }

  return { allowed: true }
}

/** 记录一次登录失败 */
export function recordLoginFailure(event: any, username: string): void {
  const ip = getClientIP(event)
  const key = getAttemptKey(ip, username)
  const now = Date.now()
  const record = loginAttempts.get(key)

  if (!record || now - record.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now, lockedUntil: 0 })
  } else {
    record.count++
    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS
    }
  }
}

/** 重置登录尝试记录（登录成功后调用） */
export function resetLoginAttempts(event: any, username: string): void {
  const ip = getClientIP(event)
  const key = getAttemptKey(ip, username)
  loginAttempts.delete(key)
}

// ====================================================================
//  会话管理
// ====================================================================

/**
 * 验证凭据，成功则创建 session 并设置 cookie
 * @returns 账号信息（成功）或 null（失败）
 */
export async function loginAndCreateSession(event: any, username: string, password: string): Promise<AdminAccount | null> {
  const account = authenticateUser(username, password)
  if (!account) return null

  const token = generateToken()
  sessions.set(token, {
    username: account.username,
    displayName: account.displayName,
    createdAt: Date.now()
  })

  cleanExpiredSessions()

  setCookie(event, 'admin_token', token, {
    httpOnly: true,
    secure: isProductionEnv(),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE / 1000
  })

  return account
}

/**
 * 获取当前登录用户信息
 * @returns SessionInfo 或 null
 */
export function getCurrentUser(event: any): SessionInfo | null {
  const token = getCookie(event, 'admin_token')
  if (!token) return null

  const session = sessions.get(token)
  if (!session) return null

  // 检查过期
  if (Date.now() - session.createdAt > SESSION_MAX_AGE) {
    sessions.delete(token)
    return null
  }

  return session
}

/**
 * 验证当前请求是否已登录
 */
export function isAuthenticated(event: any): boolean {
  return getCurrentUser(event) !== null
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
export function requireAuth(event: any): SessionInfo {
  const user = getCurrentUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未登录或登录已过期'
    })
  }
  return user
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
  // 同时清理过期的登录尝试记录
  for (const [key, record] of loginAttempts) {
    if (now - record.firstAttempt > LOGIN_WINDOW_MS && now > record.lockedUntil) {
      loginAttempts.delete(key)
    }
  }
}
