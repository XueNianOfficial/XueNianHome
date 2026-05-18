/**
 * POST /api/admin/chat/delete
 * 管理员删除指定用户聊天记录或会话
 * 请求体：{ userId: string, sessionId?: string }
 */
import { requireAuth } from '../../../utils/admin-auth'
import { adminDeleteUserChat, deleteUserSession, loadUserChat } from '../../../utils/chat-storage'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const body = await readBody(event)
  const { userId, sessionId } = body

  if (!userId) {
    throw createError({ statusCode: 400, message: '缺少 userId' })
  }

  if (sessionId) {
    // 删除单个会话
    deleteUserSession(userId, sessionId)
  } else {
    // 删除整个用户
    adminDeleteUserChat(userId)
  }

  return { success: true }
})
