/**
 * GET /api/admin/check
 * 检查登录状态，返回当前用户信息
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
