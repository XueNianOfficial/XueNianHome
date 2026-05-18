/**
 * ============================================================
 *  Nitro 服务端插件 - 启动聊天记录定时清理
 *  在服务器启动时自动开始定期清理过期聊天记录
 * ============================================================
 */
import { startChatCleanupTimer } from '../utils/chat-storage'

export default defineNitroPlugin(() => {
  console.log('[聊天存储] 启动定时清理任务（7 天过期）')
  startChatCleanupTimer()
})
