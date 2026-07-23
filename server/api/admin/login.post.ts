/**
 * ============================================================
 *  POST /api/admin/login
 *  管理后台登录（用户名 + 密码）
 *  安全：csrfProtection 校验 + 登录限速（IP+用户名，15 分钟 5 次失败锁 15 分钟）
 *        + scrypt 密码校验 + 内存 session（24h）
 *  注意：本端点本身不需要 requireAuth（未登录才能登录）
 * ============================================================
 */
import {
  loginAndCreateSession,
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginAttempts
} from '../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  // 仅允许 POST 请求
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, message: '仅支持 POST 请求' })
  }

  // CSRF 防护（登录页内联脚本会从 csrf_token cookie 取值并附带请求头）
  csrfProtection(event)

  const { username, password } = await readBody(event)

  // 参数校验
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    throw createError({ statusCode: 400, message: '请输入用户名' })
  }
  if (!password || typeof password !== 'string' || password.length === 0) {
    throw createError({ statusCode: 400, message: '请输入密码' })
  }

  const cleanUsername = username.trim().toLowerCase()

  // 登录速率限制检查
  const rateCheck = checkLoginRateLimit(event, cleanUsername)
  if (!rateCheck.allowed) {
    throw createError({ statusCode: 429, message: rateCheck.reason })
  }

  // 验证凭据并创建会话
  const account = await loginAndCreateSession(event, cleanUsername, password)

  if (!account) {
    recordLoginFailure(event, cleanUsername)
    throw createError({ statusCode: 401, message: '用户名或密码错误' })
  }

  // 登录成功，重置失败计数
  resetLoginAttempts(event, cleanUsername)

  return {
    success: true,
    user: {
      username: account.username,
      displayName: account.displayName
    }
  }
})
