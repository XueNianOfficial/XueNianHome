/**
 * ============================================================
 *  登录状态检查 API - GET /api/admin/check
 *  返回当前管理员用户信息（未登录返回 authenticated: false）
 * ============================================================
 */
import { getCurrentUser } from '../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  const user = getCurrentUser(event)
  if (user) {
    return {
      authenticated: true,
      user: {
        username: user.username,
        displayName: user.displayName
      }
    }
  }
  return { authenticated: false }
})
