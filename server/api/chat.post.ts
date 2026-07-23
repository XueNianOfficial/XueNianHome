/**
 * ============================================================
 *  雪年个人网站 - AI 聊天 API 路由
 *  Nitro Server 端代理 AI API 请求
 *  保护 API Key 不暴露给客户端
 *
 *  POST /api/chat
 *  请求体：{
 *    messages: [{ role, content, contentParts? }],
 *    preset?: string,            // 预设名称
 *    stream?: boolean,           // 是否 SSE 流式
 *    enableThinking?: boolean,   // 深度思考（需预设声明 supportsThinking）
 *    enableSearch?: boolean,     // 联网搜索（需预设声明 supportsWebSearch）
 *    customSystemPrompt?: string // 自定义系统提示词（需预设声明 allowCustomSystemPrompt）
 *  }
 *  三项附加能力由 resolveChatOptions 统一校验，预设未声明时静默降级关闭
 *
 *  非流式响应体：{ success: boolean, data: { content, usage?, reasoning?, searched? } }
 *  流式响应：SSE 格式 (text/event-stream)
 *    事件类型：
 *    - chunk:     { type: "chunk", content: "..." }     正文增量
 *    - reasoning: { type: "reasoning", content: "..." } 深度思考增量
 *    - search:    { type: "search", content: "..." }    联网搜索状态提示
 *    - done:      { type: "done", usage?: {...} }
 *    - error:     { type: "error", message: "..." }
 *
 *  注意：callAI / callAIStream / resolveChatOptions 从 server/utils/ai.ts 自动导入；
 *  每次请求都会经 request-log.ts 写入系统日志（完整消息 + API 输出，管理后台可查）
 * ============================================================
 */

export default defineEventHandler(async (event) => {
  // 仅允许 POST 请求
  if (event.method !== 'POST') {
    throw createError({
      statusCode: 405,
      message: '仅支持 POST 请求'
    })
  }

  // CSRF 防护
  csrfProtection(event)

  try {
    const body = await readBody(event)
    const { messages, preset, stream, enableThinking, enableSearch, customSystemPrompt } = body

    // 验证消息格式
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw createError({
        statusCode: 400,
        message: '请提供有效的消息列表'
      })
    }

    // 字段归一化：前端多模态消息既可能传 contentParts 也可能传 parts，
    // 统一映射为 contentParts 供 buildFullMessages 处理
    const mappedMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      contentParts: m.contentParts || m.parts
    }))

    // 校验附加能力开关（安全关键：预设未声明的能力一律静默关闭，
    // 防止伪造请求注入自定义系统提示词或触发付费功能）
    const options = resolveChatOptions(preset, { enableThinking, enableSearch, customSystemPrompt })

    // 请求日志公共字段（埋点见流式/非流式分支；model 为实际生效值）
    const logBase = {
      type: 'chat' as const,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : undefined,
      preset: typeof preset === 'string' && preset ? preset : '（默认）',
      model: getPresetConfig(preset).model,
      options: { enableThinking: options.enableThinking, enableSearch: options.enableSearch, customSystemPrompt: options.customSystemPrompt }
    }

    // ========== 流式响应 ==========
    if (stream) {
      // 设置 SSE 响应头
      setHeader(event, 'Content-Type', 'text/event-stream')
      setHeader(event, 'Cache-Control', 'no-cache')
      setHeader(event, 'Connection', 'keep-alive')
      setHeader(event, 'X-Accel-Buffering', 'no') // 禁用 nginx 缓冲

      const res = event.node.res
      const startTime = Date.now()

      // 聚合输出，供请求日志记录完整 API 输出
      let outContent = ''
      let outReasoning = ''
      let outUsage: unknown
      let outError: { message: string } | null = null

      try {
        for await (const ev of callAIStream(mappedMessages, preset, options)) {
          // SSE 帧格式：`data: <JSON>\n\n`（空行为帧分隔符），逐条写出不缓冲
          const line = `data: ${JSON.stringify(ev)}\n\n`
          res.write(line)

          // 旁路聚合（不影响下发内容）
          if (ev.type === 'chunk') outContent += ev.content || ''
          else if (ev.type === 'reasoning') outReasoning += ev.content || ''
          else if (ev.type === 'done') outUsage = ev.usage
          else if (ev.type === 'error') {
            outError = { message: ev.message || '未知错误' }
            break
          }
        }
      } catch (streamErr: any) {
        const errorLine = `data: ${JSON.stringify({ type: 'error', message: streamErr.message || 'AI 流式响应中断' })}\n\n`
        try { res.write(errorLine) } catch { /* 忽略 */ }
        outError = { message: streamErr.message || 'AI 流式响应中断' }
      }

      res.end()

      // 写请求日志（完整消息列表 + 聚合输出 / 错误）
      logRequest({
        ...logBase,
        time: new Date(startTime).toISOString(),
        request: mappedMessages,
        response: outError
          ? undefined
          : { content: outContent, reasoning: outReasoning || undefined, usage: outUsage },
        error: outError ?? undefined,
        durationMs: Date.now() - startTime
      })
      return
    }

    // ========== 非流式响应 ==========
    const startTime = Date.now()
    try {
      const { content, usage, reasoning, searched } = await callAI(mappedMessages, preset, options)

      logRequest({
        ...logBase,
        time: new Date(startTime).toISOString(),
        request: mappedMessages,
        response: { content, reasoning, usage, searched },
        durationMs: Date.now() - startTime
      })

      return {
        success: true,
        data: { content, usage, reasoning, searched }
      }
    } catch (callErr: any) {
      // 记录失败日志后原样抛出，由外层 catch 统一转为错误响应
      logRequest({
        ...logBase,
        time: new Date(startTime).toISOString(),
        request: mappedMessages,
        error: { statusCode: callErr?.statusCode, message: callErr?.message || 'AI 调用失败', detail: callErr?.data?.detail },
        durationMs: Date.now() - startTime
      })
      throw callErr
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
