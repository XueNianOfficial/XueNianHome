/**
 * ============================================================
 *  POST /api/admin/logout
 *  管理后台登出：销毁内存 session 并清除会话 cookie
 *  安全：requireAuth 鉴权 + csrfProtection 校验
 * ============================================================
 */
import { destroySession, requireAuth } from '../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  csrfProtection(event)
  destroySession(event)
  return { success: true }
})
