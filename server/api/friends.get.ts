/**
 * GET /api/friends
 * 公开 API - 获取友链列表
 */
import { loadFriends } from '../utils/friends-storage'

export default defineEventHandler(async () => {
  const friends = loadFriends()
  return { success: true, data: friends }
})
