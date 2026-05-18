/**
 * GET /api/admin/check
 * 检查登录状态
 */
import { isAuthenticated } from '../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  return { authenticated: isAuthenticated(event) }
})
