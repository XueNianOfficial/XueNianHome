/**
 * GET /api/admin/chat/list
 * 管理员获取所有用户聊天概览（需登录）
 */
import { requireAuth } from '../../../utils/admin-auth'
import { listAllUserChats, getChatStorageSize } from '../../../utils/chat-storage'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const users = listAllUserChats()
  const totalSize = getChatStorageSize()
  return {
    success: true,
    data: {
      users,
      totalUsers: users.length,
      totalMessages: users.reduce((s, u) => s + u.messageCount, 0),
      totalSize,
      totalSizeFormatted: formatBytes(totalSize)
    }
  }
})

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
