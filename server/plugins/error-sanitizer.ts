/**
 * ============================================================
 *  全局错误净化插件
 *  生产环境：隐藏堆栈跟踪和内部路径，只返回通用错误消息
 *  开发环境：保留详细错误信息便于调试
 *
 *  重要：此插件在 h3 序列化错误响应之前运行，
 *  通过修改 error 对象属性来控制最终输出的 JSON 内容
 * ============================================================
 */

/** 生产环境中需要从错误响应中删除的字段 */
const STRIP_FIELDS = ['stack', 'url', 'statusMessage', 'data', 'cause', 'fileName', 'lineNumber']

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, context) => {
    const isProduction = process.env.NODE_ENV === 'production'

    if (!isProduction) {
      // 开发环境：保留完整错误信息，便于调试
      return
    }

    // ========== 生产环境：净化错误信息 ==========

    // 移除敏感的响应字段
    for (const field of STRIP_FIELDS) {
      if (field in error) {
        delete (error as any)[field]
      }
    }

    // 对于服务端内部错误（5xx），隐藏具体原因
    const statusCode = (error as any).statusCode
    if (!statusCode || statusCode >= 500) {
      ;(error as any).statusCode = 500
      ;(error as any).message = '服务器内部错误，请稍后重试'
    }

    // 记录原始错误到服务端日志（仅保留 message，不记录堆栈以保护日志安全）
    console.error('[Security]', new Date().toISOString(), '-', error.message || 'Unknown error')
  })
})
