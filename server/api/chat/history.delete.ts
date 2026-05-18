/**
 * ============================================================
 *  DELETE /api/chat/history?userId=xxx&sessionId=yyy
 *  删除指定用户的指定会话
 *  若不传 sessionId 则删除该用户全部聊天记录
 * ============================================================
 */
import { deleteUserSession } from '../../utils/chat-storage'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
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
    // 删除该用户全部记录
    const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filePath = join(process.cwd(), 'server/data/chat', `${safeId}.json`)
    if (existsSync(filePath)) {
      try { unlinkSync(filePath) } catch { /* 忽略 */ }
    }
  }

  return { success: true }
})
