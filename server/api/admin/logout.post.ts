/**
 * POST /api/admin/logout
 * 管理后台登出
 */
import { destroySession, requireAuth } from '../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  destroySession(event)
  return { success: true }
})
