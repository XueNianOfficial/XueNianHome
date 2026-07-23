/**
 * ============================================================
 *  POST /api/admin/chat/delete
 *  管理员删除指定用户聊天记录或会话
 *  请求体：{ userId: string, sessionId?: string }
 *  安全：requireAuth 鉴权 + csrfProtection 校验；
 *        userId 拼路径由 chat-storage 内部统一过滤（防路径遍历）
 * ============================================================
 */
import { requireAuth } from '../../../utils/admin-auth'
import { adminDeleteUserChat, deleteUserSession, loadUserChat } from '../../../utils/chat-storage'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  csrfProtection(event)
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
