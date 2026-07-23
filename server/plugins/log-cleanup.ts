/**
 * ============================================================
 *  Nitro 服务端插件 - 启动请求日志定时清理
 *  服务器启动时自动开始定期清理过期日志（7 天保留期）
 * ============================================================
 */
import { startLogCleanupTimer } from '../utils/request-log'

export default defineNitroPlugin(() => {
  console.log('[请求日志] 启动定时清理任务（7 天过期）')
  startLogCleanupTimer()
})
