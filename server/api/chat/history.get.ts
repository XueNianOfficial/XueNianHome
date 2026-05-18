/**
 * ============================================================
 *  GET /api/chat/history?userId=xxx
 *  加载指定用户的聊天历史（自动清理过期内容）
 * ============================================================
 */
import { loadUserChat } from '../../utils/chat-storage'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userId = query.userId as string

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: '缺少 userId 参数'
    })
  }

  const data = loadUserChat(userId)

  return {
    success: true,
    data: data ? {
      userId: data.userId,
      sessions: data.sessions
    } : {
      userId,
      sessions: []
    }
  }
})
