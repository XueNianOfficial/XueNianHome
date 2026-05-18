/**
 * GET /api/admin/chat/detail?userId=xxx
 * 管理员查看指定用户的详细聊天记录
 */
import { requireAuth } from '../../../utils/admin-auth'
import { loadUserChat } from '../../../utils/chat-storage'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const query = getQuery(event)
  const userId = query.userId as string

  if (!userId) {
    throw createError({ statusCode: 400, message: '缺少 userId' })
  }

  const data = loadUserChat(userId)

  return {
    success: true,
    data: data || null
  }
})
