/**
 * POST /api/admin/login
 * 管理后台登录
 */
import { verifyPassword, createSession } from '../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  const { password } = await readBody(event)

  if (!password || !verifyPassword(password)) {
    throw createError({ statusCode: 401, message: '密码错误' })
  }

  await createSession(event)
  return { success: true }
})
