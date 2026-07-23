/**
 * ============================================================
 *  DELETE /api/chat/history?userId=xxx&sessionId=yyy
 *  删除指定用户的指定会话
 *  若不传 sessionId 则删除该用户全部聊天记录
 * ============================================================
 */
import { adminDeleteUserChat, deleteUserSession } from '../../utils/chat-storage'

export default defineEventHandler(async (event) => {
  // CSRF 防护
  csrfProtection(event)

  const query = getQuery(event)
  const userId = query.userId as string
  const sessionId = query.sessionId as string | undefined

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: '缺少 userId 参数'
    })
  }

  if (sessionId) {
    // 删除单个会话
    deleteUserSession(userId, sessionId)
  } else {
    // 删除该用户全部记录（复用 chat-storage 的统一实现，含路径安全过滤）
    adminDeleteUserChat(userId)
  }

  return { success: true }
})
