/**
 * ============================================================
 *  友链列表 API - GET /api/friends（公开）
 *  数据来自 server/data/friends.json，前端获取失败时回退静态数据
 * ============================================================
 */
import { loadFriends } from '../utils/friends-storage'

export default defineEventHandler(async () => {
  const friends = loadFriends()
  return { success: true, data: friends }
})
