/**
 * ============================================================
 *  友链管理列表 API - GET /api/admin/friends/list（需管理员登录）
 * ============================================================
 */
import { requireAuth } from '../../../utils/admin-auth'
import { loadFriends } from '../../../utils/friends-storage'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const friends = loadFriends()
  return { success: true, data: friends }
})
