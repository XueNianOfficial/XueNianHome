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

/** 尖括号标签过滤正则（去除 AI 输出的 <thinking> 等标签及内容） */
const ANGLE_BRACKET_PATTERN = /<[^>]+>([^<]*)<\/[^>]+>/g
const REMNANT_TAG_PATTERN = /<[^>]*>/g

/**
 * 去除 AI 输出中的尖括号标签及其内容（如 <thinking>...</thinking>）
 * 迭代移除最内层标签对，再清理残余孤立标签，最后合并多余空白
 */
function stripAngleBrackets(text: string): string {
  let result = text
  let prev = ''
  while (prev !== result) {
    prev = result
    result = result.replace(ANGLE_BRACKET_PATTERN, '')
  }
  result = result.replace(REMNANT_TAG_PATTERN, '')
  return result.replace(/\s{2,}/g, ' ').trim()
}

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
 * 过滤 parts 中 AI API 无法处理的图片 URL（仅保留 base64 data URL）
 * 防止服务端相对 URL（如 /images/chat/xxx.png）被发送到 AI API 导致报错
 */
function safeAIParts(parts?: ContentPart[]): ContentPart[] | undefined {
  if (!parts || parts.length === 0) return undefined
  const filtered = parts.filter(p => {
    if (p.type === 'image_url' && p.image_url?.url) {
      // 只保留 base64 data URL，丢弃服务端相对/绝对 URL
      return p.image_url.url.startsWith('data:')
    }
    return true // 保留非 image_url 类型的 part
  })
  return filtered.length > 0 ? filtered : undefined
}

// ==================== 模块级响应式状态（单例，所有组件共享） ====================

/** 用户唯一标识（持久化到 localStorage，用于服务端存储） */
const userId = ref<string>('')

/** 所有会话列表 */
const sessions = ref<ChatSession[]>([])

/** 当前活跃会话 ID */
const activeSessionId = ref<string>('')

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

/** 默认配置是否支持视觉 */
const defaultSupportsVision = ref(false)

/** 默认配置是否支持音频 */
const defaultSupportsAudio = ref(false)

/** 是否已完成客户端初始化 */
let initialized = false

// ==================== 模块级工具函数（操作模块级状态） ====================

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

function saveActiveSessionId() {
  if (import.meta.server) return
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId.value)
  } catch { /* 忽略 */ }
}

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

function loadActiveSessionId(): string {
  if (import.meta.server) return ''
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY) || ''
  } catch {
    return ''
  }
}

/**
 * useChat - 聊天功能 Composable（单例模式）
 * 所有组件共享同一份模块级响应式状态
 * @returns 聊天相关的所有状态和方法
 */
export function useChat() {
  // 确保客户端只初始化一次
  if (!import.meta.server && !initialized) {
    initState()
  }

  // ==================== 计算属性 ====================

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

  /** 当前预设头像（为空时使用默认头像） */
  const currentPresetAvatar = computed(() => {
    if (!currentPreset.value) return ''
    const preset = presets.value.find(p => p.name === currentPreset.value)
    return preset?.avatar || ''
  })

  /** 是否有记忆 */
  const hasMemory = computed(() => messages.value.length > 0)

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

  /**
   * 上传待发送的 base64 图片到服务器，返回 URL 列表
   * 目的：避免 base64 图片存入聊天记录 JSON，防止 localStorage/服务端存储失败
   * @returns 成功上传的图片 URL 数组；失败则返回空数组（降级为不保留图片到历史）
   */
  async function uploadPendingImages(): Promise<string[]> {
    if (pendingImages.value.length === 0) return []

    // 分离 base64 和已有 URL
    const base64Images = pendingImages.value.filter(img => img.startsWith('data:'))
    const existingUrls = pendingImages.value.filter(img => !img.startsWith('data:'))

    if (base64Images.length === 0) {
      return existingUrls
    }

    // 逐张上传，收集成功的 URL
    const uploadedUrls: string[] = []
    for (const img of base64Images) {
      try {
        const response = await $fetch<{ success: boolean; urls: string[] }>('/api/chat/upload', {
          method: 'POST',
          body: { images: [img] }
        })
        if (response.success && response.urls.length > 0) {
          uploadedUrls.push(response.urls[0]!)
        }
      } catch (e) {
        console.warn('聊天图片上传失败，该图片将不保留到历史记录：', e)
      }
    }

    return [...existingUrls, ...uploadedUrls]
  }

  /**
   * 将指定消息的 base64 图片 parts 替换为服务端轻量 URL
   * 在 AI 响应完成后异步调用，不阻塞用户交互
   */
  async function swapMessageImagesToUrls(messageId: string, base64Parts: ContentPart[]) {
    if (base64Parts.length === 0) return

    // 提取 base64 data URL
    const base64Urls = base64Parts
      .filter(p => p.type === 'image_url' && p.image_url?.url?.startsWith('data:'))
      .map(p => p.image_url!.url)

    if (base64Urls.length === 0) return

    // 上传到服务器，获取轻量 URL
    const uploadedUrls: string[] = []
    for (const img of base64Urls) {
      try {
        const response = await $fetch<{ success: boolean; urls: string[] }>('/api/chat/upload', {
          method: 'POST',
          body: { images: [img] }
        })
        if (response.success && response.urls.length > 0) {
          uploadedUrls.push(response.urls[0]!)
        }
      } catch {
        // 静默失败，保留原始 base64（虽然大，但至少不丢数据）
      }
    }

    if (uploadedUrls.length === 0) return

    // 找到消息并替换 parts
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session) return
    const msg = session.messages.find(m => m.id === messageId)
    if (!msg || !msg.parts) return

    // 用服务端 URL 替换对应的 base64 URL
    let urlIdx = 0
    for (const part of msg.parts) {
      if (part.type === 'image_url' && part.image_url?.url?.startsWith('data:') && urlIdx < uploadedUrls.length) {
        part.image_url.url = uploadedUrls[urlIdx]!
        urlIdx++
      }
    }

    saveSessions()
    syncToServer()
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

    // 保存一份 parts 副本，用于 AI 响应后异步上传换取轻量 URL
    const hasImages = parts.length > 0
    const partsCopy: ContentPart[] = hasImages
      ? parts.map(p => ({
          type: p.type,
          image_url: p.image_url ? { url: p.image_url.url, detail: p.image_url.detail } : undefined
        } as ContentPart))
      : []

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user' as ChatRole,
      content: content.trim(),
      parts: hasImages ? parts : undefined,
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

    // 构建请求消息列表：若当前预设不支持视觉，则完全剥离图片 parts
    const visionSupported = supportsVision.value
    const requestMessages = session.messages.map(m => ({
      role: m.role,
      content: m.content,
      parts: visionSupported ? safeAIParts(m.parts) : undefined
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

              // 过滤 AI 输出的尖括号标签（如 <thinking>），再按标点拆分气泡
              const filtered = stripAngleBrackets(streamingContent.value)
              const { completed, remaining } = splitByPunctuation(filtered)
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

      // 流结束后，过滤剩余文本并入队
      const finalFiltered1 = stripAngleBrackets(streamingContent.value)
      if (finalFiltered1) {
        enqueueBubbles([finalFiltered1], session)
      }
      // 等待所有气泡发射完毕（最多等待 30s）
      await waitForBubbleQueue(30000)

      streamingContent.value = ''
      session.lastActiveAt = Date.now()
      saveSessions()

      // AI 响应完成后，将消息中的 base64 图片异步替换为服务端轻量 URL
      if (hasImages) {
        swapMessageImagesToUrls(userMessage.id, partsCopy)
      }

      // 异步同步到服务器
      syncToServer()
    } catch (e: any) {
      console.error('AI 聊天请求失败：', e)
      if (!error.value) {
        error.value = e?.message || '网络请求失败，请检查 API 配置'
      }
      // 即使失败也尝试替换图片（避免 base64 撑爆存储）
      if (hasImages) {
        swapMessageImagesToUrls(userMessage.id, partsCopy)
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
   * 仅保存编辑内容，不截断后续消息，不重新发送
   */
  function saveEditOnly(messageId: string, newContent: string) {
    if (!newContent.trim()) return

    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session) return

    const msg = session.messages.find(m => m.id === messageId)
    if (!msg) return

    msg.content = newContent.trim()
    msg.edited = true
    msg.timestamp = Date.now()
    session.lastActiveAt = Date.now()
    saveSessions()

    editingMessageId.value = null
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

    // 检查当前预设是否支持视觉，如不支持则完全剥离图片 parts
    const visionSupported = supportsVision.value
    const requestMessages = session.messages.map(m => ({
      role: m.role,
      content: m.content,
      parts: visionSupported ? safeAIParts(m.parts) : undefined
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

              const filtered = stripAngleBrackets(streamingContent.value)
              const { completed, remaining } = splitByPunctuation(filtered)
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

      const finalFiltered2 = stripAngleBrackets(streamingContent.value)
      if (finalFiltered2) {
        enqueueBubbles([finalFiltered2], session)
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

  /**
   * 客户端初始化（仅执行一次）
   * 从 localStorage 加载数据，创建默认会话，设置服务器同步和卸载处理
   */
  function initState() {
    initialized = true

    userId.value = loadUserId()
    sessions.value = loadSessions()
    activeSessionId.value = loadActiveSessionId()

    // 初始化默认会话
    if (sessions.value.length === 0) {
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

    // 验证活跃会话有效性
    if (activeSessionId.value && !sessions.value.find(s => s.id === activeSessionId.value)) {
      const firstSession = sessions.value[0]
      if (firstSession) {
        activeSessionId.value = firstSession.id
      }
    }

    // 异步从服务器加载历史记录
    loadFromServer()

    // 页面卸载前刷新 localStorage 并同步到服务器
    window.addEventListener('beforeunload', () => {
      flushSessions()
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
    currentPresetAvatar,
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
    saveEditOnly,
    addPendingImage,
    removePendingImage,
    clearPendingImages,
    flushSessions,
    syncToServer
  }
}
