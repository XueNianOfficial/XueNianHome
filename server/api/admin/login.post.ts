/**
 * POST /api/admin/login
 * 管理后台登录（用户名+密码，含速率限制）
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
