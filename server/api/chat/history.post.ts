/**
 * ============================================================
 *  POST /api/chat/history
 *  保存用户的聊天历史到服务器
 *  请求体：{ userId: string, sessions: [...], replace?: boolean }
 *  默认合并模式，replace=true 时完全替换
 * ============================================================
 */
import { saveUserChat, loadUserChat } from '../../utils/chat-storage'
import type { UserChatData } from '../../utils/chat-storage'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, sessions, replace } = body

  if (!userId || !Array.isArray(sessions)) {
    throw createError({
      statusCode: 400,
      message: '请提供有效的 userId 和 sessions'
    })
  }

  let data: UserChatData

  if (replace) {
    // 完全替换模式
    data = {
      userId,
      sessions,
      lastActiveAt: Date.now()
    }
  } else {
    // 合并模式：用客户端数据更新服务端数据
    const existing = loadUserChat(userId)
    if (existing) {
      // 合并会话：客户端有的用客户端，客户端没有的保留服务端
      const sessionMap = new Map(existing.sessions.map(s => [s.id, s]))
      for (const session of sessions) {
        sessionMap.set(session.id, session)
      }
      data = {
        userId,
        sessions: Array.from(sessionMap.values()),
        lastActiveAt: Date.now()
      }
    } else {
      data = {
        userId,
        sessions,
        lastActiveAt: Date.now()
      }
    }
  }

  saveUserChat(data)

  return { success: true }
})
