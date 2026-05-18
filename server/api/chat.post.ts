/**
 * ============================================================
 *  雪年个人网站 - AI 聊天 API 路由
 *  Nitro Server 端代理 AI API 请求
 *  保护 API Key 不暴露给客户端
 *
 *  POST /api/chat
 *  请求体：{ messages: [{ role, content }], preset?: string, stream?: boolean }
 *
 *  非流式响应体：{ success: boolean, data: { content }, error?: string }
 *  流式响应：SSE 格式 (text/event-stream)
 *    事件类型：
 *    - chunk:  { type: "chunk", content: "..." }
 *    - done:   { type: "done" }
 *    - error:  { type: "error", message: "..." }
 *
 *  注意：callAI / callAIStream 从 server/utils/ai.ts 自动导入
 * ============================================================ */

export default defineEventHandler(async (event) => {
  // 仅允许 POST 请求
  if (event.method !== 'POST') {
    throw createError({
      statusCode: 405,
      message: '仅支持 POST 请求'
    })
  }

  try {
    const body = await readBody(event)
    const { messages, preset, stream } = body

    // 验证消息格式
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw createError({
        statusCode: 400,
        message: '请提供有效的消息列表'
      })
    }

    const mappedMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      contentParts: m.contentParts || m.parts
    }))

    // ========== 流式响应 ==========
    if (stream) {
      // 设置 SSE 响应头
      setHeader(event, 'Content-Type', 'text/event-stream')
      setHeader(event, 'Cache-Control', 'no-cache')
      setHeader(event, 'Connection', 'keep-alive')
      setHeader(event, 'X-Accel-Buffering', 'no') // 禁用 nginx 缓冲

      const res = event.node.res

      try {
        for await (const ev of callAIStream(mappedMessages, preset)) {
          const line = `data: ${JSON.stringify(ev)}\n\n`
          res.write(line)

          // 错误事件后立即结束
          if (ev.type === 'error') {
            break
          }
        }
      } catch (streamErr: any) {
        const errorLine = `data: ${JSON.stringify({ type: 'error', message: streamErr.message || 'AI 流式响应中断' })}\n\n`
        try { res.write(errorLine) } catch { /* 忽略 */ }
      }

      res.end()
      return
    }

    // ========== 非流式响应 ==========
    const content = await callAI(mappedMessages, preset)

    return {
      success: true,
      data: { content }
    }
  } catch (err: any) {
    console.error('AI 聊天 API 错误：', err)

    const statusCode = err.statusCode || 500
    const message = err.statusCode
      ? err.message
      : 'AI 服务暂时不可用，请稍后再试'

    throw createError({
      statusCode,
      message
    })
  }
})
