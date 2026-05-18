/**
 * ============================================================
 *  雪年个人网站 - AI 聊天 Composable（多会话版 + 流式传输）
 *  管理聊天状态：多会话、消息列表、流式发送消息、图片/音频
 *  调用服务端 /api/chat 接口（支持 SSE 流式响应）
 *  聊天记录同步至服务器，7 天自动过期
 * ============================================================
 */

import type { ChatMessage, ChatRole, ChatPreset, ChatSession, ContentPart } from '~/types'

/** localStorage 键名 */
const SESSIONS_KEY = 'xuenian_chat_sessions'
const ACTIVE_SESSION_KEY = 'xuenian_active_session'
const USER_ID_KEY = 'xuenian_user_id'

/** localStorage 写入防抖延迟（ms） */
const SAVE_DEBOUNCE_MS = 300

/** 气泡发出间隔范围（ms） */
const BUBBLE_DELAY_MIN = 1000
const BUBBLE_DELAY_MAX = 2000

/** 用于拆分气泡的标点符号正则（匹配连续标点） */
const SENTENCE_PATTERN = /([^。？！～！？]+)([。？！～！？]+)/g

/** 从 Cookie 读取 CSRF Token */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]!) : null
}

/** 为 fetch options 添加 CSRF 头（状态变更方法） */
function withCsrf(options: RequestInit = {}): RequestInit {
  const method = (options.method || 'GET').toUpperCase()
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const token = getCsrfToken()
    if (token) {
      options.headers = {
        ...options.headers,
        'x-csrf-token': token
      }
    }
  }
  return options
}

/**
 * 按标点符号拆分文本，连续标点合并为一个气泡
 * 例："你好！这个是测试。。。然后呢～"→["你好！","这个是测试。。。","然后呢～"]
 * @returns completed - 已完成气泡列表，remaining - 未完成尾部文本
 */
function splitByPunctuation(text: string): { completed: string[]; remaining: string } {
  const completed: string[] = []
  let lastEnd = 0
  let remaining = text

  // 重置 lastIndex
  SENTENCE_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = SENTENCE_PATTERN.exec(text)) !== null) {
    // 正文 + 连续标点 = 一个气泡
    completed.push(match[0])
    lastEnd = match.index + match[0].length
  }

  if (lastEnd > 0) {
    remaining = text.slice(lastEnd)
  }

  return { completed, remaining }
}

/**
 * useChat - 聊天功能 Composable（单例模式）
 * @returns 聊天相关的所有状态和方法
 */
export function useChat() {
  /** 用户唯一标识（持久化到 localStorage，用于服务端存储） */
  const userId = ref<string>(loadUserId())

  /** 所有会话列表 */
  const sessions = ref<ChatSession[]>(loadSessions())

  /** 当前活跃会话 ID */
  const activeSessionId = ref<string>(loadActiveSessionId())

  /** 是否正在加载 AI 回复 */
  const isLoading = ref(false)

  /** 流式传输中尚未完成句子的文本（用于显示"思考中"） */
  const streamingContent = ref('')

  /** 待发出的气泡队列（带延迟逐个发射） */
  const bubbleQueue = ref<string[]>([])

  /** 气泡队列是否正在处理 */
  let bubbleProcessing = false

  /** 取消当前队列处理的哨兵 */
  let bubbleCancelToken = 0

  /** 错误信息 */
  const error = ref<string | null>(null)

  /** 可用预设列表 */
  const presets = ref<ChatPreset[]>([])

  /** 预设是否已加载 */
  const presetsLoaded = ref(false)

  /** 正在编辑的消息 ID */
  const editingMessageId = ref<string | null>(null)

  /** 待发送的图片（base64 data URLs） */
  const pendingImages = ref<string[]>([])

  /** localStorage 写入防抖定时器 */
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

  /** 当前活跃会话 */
  const activeSession = computed(() => {
    return sessions.value.find(s => s.id === activeSessionId.value) || null
  })

  /** 当前活跃会话的消息列表 */
  const messages = computed({
    get: () => activeSession.value?.messages || [],
    set: (val: ChatMessage[]) => {
      const session = sessions.value.find(s => s.id === activeSessionId.value)
      if (session) {
        session.messages = val
        session.lastActiveAt = Date.now()
        saveSessions()
      }
    }
  })

  /** 当前选中的预设名称 */
  const currentPreset = computed({
    get: () => activeSession.value?.preset || '',
    set: (val: string) => {
      const session = sessions.value.find(s => s.id === activeSessionId.value)
      if (session) {
        session.preset = val
        session.lastActiveAt = Date.now()
        saveSessions()
      }
    }
  })

  /** 默认配置是否支持视觉 */
  const defaultSupportsVision = ref(false)

  /** 默认配置是否支持音频 */
  const defaultSupportsAudio = ref(false)

  /** 当前预设支持视觉 */
  const supportsVision = computed(() => {
    if (!currentPreset.value) return defaultSupportsVision.value
    const preset = presets.value.find(p => p.name === currentPreset.value)
    return preset?.supportsVision || false
  })

  /** 当前预设支持音频 */
  const supportsAudio = computed(() => {
    if (!currentPreset.value) return defaultSupportsAudio.value
    const preset = presets.value.find(p => p.name === currentPreset.value)
    return preset?.supportsAudio || false
  })

  /** 是否有记忆 */
  const hasMemory = computed(() => messages.value.length > 0)

  // ==================== 用户标识 ====================

  function loadUserId(): string {
    if (import.meta.server) return ''
    try {
      let id = localStorage.getItem(USER_ID_KEY)
      if (!id) {
        id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        localStorage.setItem(USER_ID_KEY, id)
      }
      return id
    } catch {
      return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    }
  }

  // ==================== 会话管理 ====================

  function loadSessions(): ChatSession[] {
    if (import.meta.server) return []
    try {
      const saved = localStorage.getItem(SESSIONS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch { /* 忽略 */ }
    return []
  }

  /**
   * 保存会话到 localStorage（防抖 300ms，避免频繁写入）
   */
  function saveSessions() {
    if (import.meta.server) return
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer)
    saveDebounceTimer = setTimeout(() => {
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.value))
      } catch { /* 忽略存储满等异常 */ }
    }, SAVE_DEBOUNCE_MS)
  }

  /**
   * 立即刷新待写入的会话数据（页面卸载/关闭时调用）
   */
  function flushSessions() {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer)
      saveDebounceTimer = null
    }
    if (import.meta.server) return
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.value))
    } catch { /* 忽略 */ }
  }

  function loadActiveSessionId(): string {
    if (import.meta.server) return ''
    try {
      return localStorage.getItem(ACTIVE_SESSION_KEY) || ''
    } catch {
      return ''
    }
  }

  function saveActiveSessionId() {
    if (import.meta.server) return
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId.value)
    } catch { /* 忽略 */ }
  }

  // ==================== 服务端同步 ====================

  /**
   * 从服务器加载聊天历史（与 localStorage 合并）
   */
  async function loadFromServer() {
    if (import.meta.server) return
    try {
      const response = await $fetch<{ success: boolean; data: { userId: string; sessions: ChatSession[] } }>(
        `/api/chat/history?userId=${encodeURIComponent(userId.value)}`
      )
      if (response.success && response.data && response.data.sessions.length > 0) {
        const serverSessions = response.data.sessions

        // 合并：服务器端的数据优先（更新消息内容），但保留本地独有的会话
        const localMap = new Map(sessions.value.map(s => [s.id, s]))
        for (const ss of serverSessions) {
          const local = localMap.get(ss.id)
          if (local) {
            // 服务器端的消息更新（更多或更新），使用服务器端数据
            if (ss.messages.length >= local.messages.length) {
              local.messages = ss.messages
              local.lastActiveAt = ss.lastActiveAt
              local.name = ss.name
            }
          } else {
            // 服务器端有但本地没有的会话
            sessions.value.push(ss)
          }
        }
        saveSessions()
      }
    } catch {
      // 服务器不可用时不影响本地使用
    }
  }

  /**
   * 同步当前会话到服务器
   */
  async function syncToServer() {
    if (import.meta.server) return
    try {
      await $fetch('/api/chat/history', {
        method: 'POST',
        body: {
          userId: userId.value,
          sessions: sessions.value.map(s => ({
            id: s.id,
            name: s.name,
            messages: s.messages,
            preset: s.preset,
            createdAt: s.createdAt,
            lastActiveAt: s.lastActiveAt
          })),
          replace: true
        }
      })
    } catch {
      // 静默失败
    }
  }

  /** 创建新会话 */
  function createSession(name?: string): string {
    const id = generateId()
    const session: ChatSession = {
      id,
      name: name || `对话 ${sessions.value.length + 1}`,
      messages: [],
      preset: currentPreset.value || '',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    }
    sessions.value.push(session)
    activeSessionId.value = id
    saveSessions()
    saveActiveSessionId()
    return id
  }

  /** 切换会话 */
  function switchSession(sessionId: string) {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      activeSessionId.value = sessionId
      session.lastActiveAt = Date.now()
      saveSessions()
      saveActiveSessionId()
    }
  }

  /** 删除会话 */
  async function deleteSession(sessionId: string) {
    const idx = sessions.value.findIndex(s => s.id === sessionId)
    if (idx === -1) return
    sessions.value.splice(idx, 1)
    if (activeSessionId.value === sessionId) {
      if (sessions.value.length > 0) {
        const last = sessions.value[sessions.value.length - 1]
        if (last) activeSessionId.value = last.id
      } else {
        activeSessionId.value = ''
      }
    }
    saveSessions()
    saveActiveSessionId()

    // 同步删除到服务器
    if (!import.meta.server) {
      try {
        await $fetch(`/api/chat/history?userId=${encodeURIComponent(userId.value)}&sessionId=${encodeURIComponent(sessionId)}`, {
          method: 'DELETE'
        })
      } catch { /* 忽略 */ }
    }
  }

  /** 重命名会话 */
  function renameSession(sessionId: string, newName: string) {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session && newName.trim()) {
      session.name = newName.trim()
      session.lastActiveAt = Date.now()
      saveSessions()
    }
  }

  /** 清除当前会话记忆 */
  function clearMemory() {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (session) {
      session.messages = []
      session.lastActiveAt = Date.now()
      error.value = null
      streamingContent.value = ''
      pendingImages.value = []
      saveSessions()
    }
  }

  // ==================== 预设管理 ====================

  async function loadPresets() {
    if (presetsLoaded.value) return
    try {
      const response = await $fetch<{ success: boolean; data: { presets: ChatPreset[]; defaultModel: string; defaultSupportsVision?: boolean; defaultSupportsAudio?: boolean } }>('/api/presets')
      if (response.success && response.data) {
        presets.value = response.data.presets
        defaultSupportsVision.value = response.data.defaultSupportsVision || false
        defaultSupportsAudio.value = response.data.defaultSupportsAudio || false
      }
    } catch {
      // 预设加载失败不影响聊天功能
    }
    presetsLoaded.value = true
  }

  function selectPreset(name: string) {
    currentPreset.value = name
  }

  // ==================== 图片管理 ====================

  function addPendingImage(dataUrl: string) {
    pendingImages.value.push(dataUrl)
  }

  function removePendingImage(index: number) {
    pendingImages.value.splice(index, 1)
  }

  function clearPendingImages() {
    pendingImages.value = []
  }

  // ==================== 流式消息发送 ====================

  /**
   * 将已完成气泡加入队列并启动延迟发射
   */
  function enqueueBubbles(bubbles: string[], session: ChatSession) {
    if (bubbles.length === 0) return
    bubbleQueue.value.push(...bubbles)

    if (!bubbleProcessing) {
      bubbleProcessing = true
      bubbleCancelToken++
      const token = bubbleCancelToken
      processBubbleQueue(session, token)
    }
  }

  /**
   * 逐个发出队列中的气泡，每个间隔 1~2s
   */
  async function processBubbleQueue(session: ChatSession, token: number) {
    while (bubbleQueue.value.length > 0 && token === bubbleCancelToken) {
      const bubble = bubbleQueue.value.shift()!
      const aiBubble: ChatMessage = {
        id: generateId(),
        role: 'assistant' as ChatRole,
        content: bubble,
        timestamp: Date.now()
      }
      session.messages.push(aiBubble)
      session.lastActiveAt = Date.now()
      saveSessions()

      if (bubbleQueue.value.length > 0) {
        const delay = BUBBLE_DELAY_MIN + Math.random() * (BUBBLE_DELAY_MAX - BUBBLE_DELAY_MIN)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    if (token === bubbleCancelToken) {
      bubbleProcessing = false
    }
  }

  /**
   * 清空气泡队列（新消息发送时）
   */
  function flushBubbleQueue(session: ChatSession) {
    bubbleCancelToken++ // 取消正在进行的处理
    // 立即将所有排队气泡插入消息列表
    while (bubbleQueue.value.length > 0) {
      const bubble = bubbleQueue.value.shift()!
      session.messages.push({
        id: generateId(),
        role: 'assistant' as ChatRole,
        content: bubble,
        timestamp: Date.now()
      })
    }
    bubbleProcessing = false
  }

  /**
   * 等待气泡队列全部发射完毕（带超时）
   */
  async function waitForBubbleQueue(timeoutMs: number) {
    const start = Date.now()
    while (bubbleProcessing && bubbleQueue.value.length > 0) {
      if (Date.now() - start > timeoutMs) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  /**
   * 流式发送消息到 AI
   * 使用 SSE 接收 AI 回复，按标点符号拆分气泡
   * @param content - 用户输入的消息内容
   */
  async function sendMessage(content: string) {
    if (!content.trim() || isLoading.value) return

    if (!activeSessionId.value) {
      createSession()
    }

    const parts: ContentPart[] = pendingImages.value.map(dataUrl => ({
      type: 'image_url' as const,
      image_url: { url: dataUrl, detail: 'auto' as const }
    }))

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user' as ChatRole,
      content: content.trim(),
      parts: parts.length > 0 ? parts : undefined,
      timestamp: Date.now()
    }

    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session) return

    session.messages.push(userMessage)
    session.lastActiveAt = Date.now()
    clearPendingImages()
    saveSessions()

    isLoading.value = true
    streamingContent.value = ''
    error.value = null

    // 构建请求消息列表（包含新加入的用户消息）
    const requestMessages = session.messages.map(m => ({
      role: m.role,
      content: m.content,
      parts: m.parts
    }))

    try {
      const response = await fetch('/api/chat', withCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: requestMessages,
          preset: session.preset || undefined,
          stream: true
        })
      }))

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        error.value = (errData as any).message || `请求失败 (${response.status})`
        isLoading.value = false
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        error.value = '无法读取 AI 响应流'
        isLoading.value = false
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let streamDone = false

      while (!streamDone) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const dataStr = trimmed.slice(5).trim()
          if (!dataStr) continue

          try {
            const event = JSON.parse(dataStr)

            if (event.type === 'chunk' && event.content) {
              streamingContent.value += event.content as string

              // 按标点拆分已完成的气泡 → 入队等待发射
              const { completed, remaining } = splitByPunctuation(streamingContent.value)
              enqueueBubbles(completed, session)
              streamingContent.value = remaining
              session.lastActiveAt = Date.now()
            } else if (event.type === 'done') {
              streamDone = true
            } else if (event.type === 'error') {
              error.value = event.message || 'AI 回复出错'
              streamDone = true
            }
          } catch {
            // 忽略解析失败的事件
          }
        }

        saveSessions()
      }

      // 处理 buffer 中剩余的数据
      if (buffer.trim()) {
        const trimmed = buffer.trim()
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim()
          if (dataStr && dataStr !== '[DONE]') {
            try {
              const event = JSON.parse(dataStr)
              if (event.type === 'chunk' && event.content) {
                streamingContent.value += event.content as string
              }
            } catch { /* 忽略 */ }
          }
        }
      }

      // 流结束后，将剩余文本入队并清空队列
      if (streamingContent.value.trim()) {
        enqueueBubbles([streamingContent.value.trim()], session)
      }
      // 等待所有气泡发射完毕（最多等待 30s）
      await waitForBubbleQueue(30000)

      streamingContent.value = ''
      session.lastActiveAt = Date.now()
      saveSessions()

      // 异步同步到服务器
      syncToServer()
    } catch (e: any) {
      console.error('AI 聊天请求失败：', e)
      if (!error.value) {
        error.value = e?.message || '网络请求失败，请检查 API 配置'
      }
    } finally {
      isLoading.value = false
      streamingContent.value = ''
      bubbleQueue.value = []
      bubbleCancelToken++
      bubbleProcessing = false
      saveSessions()
    }
  }

  // ==================== 消息编辑 ====================

  function startEdit(messageId: string) {
    editingMessageId.value = messageId
  }

  function cancelEdit() {
    editingMessageId.value = null
  }

  async function saveEdit(messageId: string, newContent: string) {
    if (!newContent.trim()) return

    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session) return

    const idx = session.messages.findIndex(m => m.id === messageId)
    if (idx === -1) return

    const msg = session.messages[idx]
    if (!msg) return

    msg.content = newContent.trim()
    msg.edited = true
    msg.timestamp = Date.now()
    session.messages.splice(idx + 1)
    session.lastActiveAt = Date.now()
    saveSessions()

    editingMessageId.value = null
    await sendMessageAfterEdit()
  }

  /**
   * 编辑后重新发送（流式）
   */
  async function sendMessageAfterEdit() {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session || session.messages.length === 0) return

    isLoading.value = true
    streamingContent.value = ''
    error.value = null

    const requestMessages = session.messages.map(m => ({
      role: m.role,
      content: m.content,
      parts: m.parts
    }))

    try {
      const response = await fetch('/api/chat', withCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: requestMessages,
          preset: session.preset || undefined,
          stream: true
        })
      }))

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        error.value = (errData as any).message || `请求失败 (${response.status})`
        isLoading.value = false
        return
      }
      // --- 第二个 fetch ---

      const reader = response.body?.getReader()
      if (!reader) {
        error.value = '无法读取 AI 响应流'
        isLoading.value = false
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let streamDone = false

      while (!streamDone) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const dataStr = trimmed.slice(5).trim()
          if (!dataStr) continue

          try {
            const event = JSON.parse(dataStr)

            if (event.type === 'chunk' && event.content) {
              streamingContent.value += event.content as string

              const { completed, remaining } = splitByPunctuation(streamingContent.value)
              enqueueBubbles(completed, session)
              streamingContent.value = remaining
              session.lastActiveAt = Date.now()
            } else if (event.type === 'done') {
              streamDone = true
            } else if (event.type === 'error') {
              error.value = event.message || 'AI 回复出错'
              streamDone = true
            }
          } catch { /* 忽略 */ }
        }

        saveSessions()
      }

      // 处理剩余 buffer 数据
      if (buffer.trim()) {
        const trimmed = buffer.trim()
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim()
          if (dataStr && dataStr !== '[DONE]') {
            try {
              const event = JSON.parse(dataStr)
              if (event.type === 'chunk' && event.content) {
                streamingContent.value += event.content as string
              }
            } catch { /* 忽略 */ }
          }
        }
      }

      if (streamingContent.value.trim()) {
        enqueueBubbles([streamingContent.value.trim()], session)
      }
      await waitForBubbleQueue(30000)

      streamingContent.value = ''
      session.lastActiveAt = Date.now()
      saveSessions()

      syncToServer()
    } catch (e: any) {
      console.error('AI 聊天请求失败：', e)
      if (!error.value) {
        error.value = e?.message || '网络请求失败，请检查 API 配置'
      }
    } finally {
      isLoading.value = false
      streamingContent.value = ''
      bubbleQueue.value = []
      bubbleCancelToken++
      bubbleProcessing = false
      saveSessions()
    }
  }

  // ==================== 工具函数 ====================

  function clearError() {
    error.value = null
  }

  function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  // ==================== 初始化 ====================

  // 初始化默认会话
  if (!import.meta.server && sessions.value.length === 0) {
    const id = generateId()
    sessions.value.push({
      id,
      name: '新对话',
      messages: [],
      preset: '',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    })
    activeSessionId.value = id
    saveSessions()
    saveActiveSessionId()
  }

  if (!import.meta.server && activeSessionId.value && !sessions.value.find(s => s.id === activeSessionId.value)) {
    const firstSession = sessions.value[0]
    if (firstSession) {
      activeSessionId.value = firstSession.id
    }
  }

  // SSR 安全的服务器同步初始化
  if (!import.meta.server) {
    // 异步从服务器加载历史记录
    loadFromServer()
    // 页面卸载前刷新 localStorage 并同步到服务器
    window.addEventListener('beforeunload', () => {
    flushSessions()
    // 使用 fetch + keepalive 替代 sendBeacon，以支持 CSRF 头
    const body = JSON.stringify({
      userId: userId.value,
      sessions: sessions.value.map(s => ({
        id: s.id,
        name: s.name,
        messages: s.messages,
        preset: s.preset,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt
      })),
      replace: true
    })
    fetch('/api/chat/history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getCsrfToken() ? { 'x-csrf-token': getCsrfToken()! } : {})
      },
      body,
      keepalive: true
    }).catch(() => { /* 页面卸载，忽略错误 */ })
  })
  }

  // ==================== 返回 ====================

  return {
    userId,
    sessions,
    activeSessionId,
    activeSession,
    messages,
    isLoading,
    streamingContent,
    error,
    presets,
    currentPreset,
    presetsLoaded,
    supportsVision,
    supportsAudio,
    editingMessageId,
    hasMemory,
    pendingImages,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    sendMessage,
    clearError,
    clearMemory,
    loadPresets,
    selectPreset,
    startEdit,
    cancelEdit,
    saveEdit,
    addPendingImage,
    removePendingImage,
    clearPendingImages,
    flushSessions,
    syncToServer
  }
}
