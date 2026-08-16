/**
 * ============================================================
 *  雪年个人网站 - AI 聊天 Composable（多会话版 + SSE 流式传输）
 *  ------------------------------------------------------------
 *  全站聊天功能的唯一状态源，采用模块级单例（所有组件共享）：
 *  - 多会话管理：localStorage 持久化 + 服务端历史同步（7 天过期）
 *  - SSE 流式接收 AI 回复，按标点拆分为多个气泡延迟逐个放出
 *  - 多预设切换、多模态图片上传（仅 supportsVision 预设）
 *  - 深度思考（reasoning 流式预览 + 可折叠思考过程）、联网搜索状态标记
 *  - AI 画图模式（火山方舟 seedream，/api/chat/draw）、提示词模板快捷短语
 *  - 智能体自主画图：服务端在系统提示词注入 [DRAW] 标记协议，
 *    流中解析 AI 输出的 [DRAW]画面描述[/DRAW] 并自动出图插入会话
 *  - 消息编辑重发、Token 用量统计、消息数上限与滚动窗口模式
 *  - XSS 防护：stripAngleBrackets 过滤 AI 输出中的 HTML 标签
 *    （服务端 server/utils/ai.ts 有一份对应实现，客户端这份不可删）
 *
 *  服务端契约（只读，不可变更）：
 *  - POST /api/chat        SSE 事件：chunk / reasoning / search / done(usage) / error
 *  - POST /api/chat/draw   AI 画图：prompt → 落盘图片 URL
 *  - GET  /api/presets     预设名称与能力标记（含默认配置继承后的有效值）、
 *                          画图开关、提示词模板（不含密钥）
 *  - POST /api/chat/upload 图片 base64 → 服务端 URL
 *  - GET/POST/DELETE /api/chat/history  会话历史（按 userId 存储）
 * ============================================================
 */

import type { ChatMessage, ChatRole, ChatPreset, ChatSession, ContentPart, PresetsResponse, PromptTemplate } from '~/types'

// ==================== 常量配置 ====================

/** localStorage 键名：会话列表 */
const SESSIONS_KEY = 'xuenian_chat_sessions'
/** localStorage 键名：当前活跃会话 ID */
const ACTIVE_SESSION_KEY = 'xuenian_active_session'
/** localStorage 键名：用户唯一标识（服务端历史按此 ID 存储） */
const USER_ID_KEY = 'xuenian_user_id'

/** localStorage 写入防抖延迟（ms），避免流式过程中频繁写盘 */
const SAVE_DEBOUNCE_MS = 300

/** 气泡放出间隔范围（ms）：模拟真人连续发多条消息的效果 */
const BUBBLE_DELAY_MIN = 1000
const BUBBLE_DELAY_MAX = 2000

/** 单会话消息数量警告阈值（达到后显示提示横幅） */
const MESSAGE_WARN_LIMIT = 800
/** 单会话消息数量硬上限（达到后阻断发送，除非启用滚动窗口） */
const MESSAGE_MAX_LIMIT = 1000

/** 滚动窗口模式：仅保留最近 N 条消息作为 AI 上下文 */
const SLIDING_WINDOW_SIZE = 400

/** 等待气泡队列全部放出的超时时间（ms） */
const BUBBLE_QUEUE_TIMEOUT_MS = 30000

/** 用于拆分气泡的标点符号正则（正文 + 连续标点为一个气泡） */
const SENTENCE_PATTERN = /([^。？！～！？]+)([。？！～！？]+)/g

/** 尖括号标签过滤正则（去除 AI 输出的 <thinking> 等标签及内容） */
const ANGLE_BRACKET_PATTERN = /<[^>]+>([^<]*)<\/[^>]+>/g
/** 残余孤立标签正则（配对标签清除后兜底清理） */
const REMNANT_TAG_PATTERN = /<[^>]*>/g

/** 自主画图标记正则（AI 回复中的 [DRAW]画面描述[/DRAW]，大小写不敏感） */
const DRAW_MARKER_PATTERN = /\[DRAW]([\s\S]*?)\[\/DRAW]/gi
/** 带参考图提示的画图标记：[DRAW:ref=xn]...[/DRAW]、[DRAW:ref=img]...[/DRAW] 等 */
const DRAW_REF_PATTERN = /\[DRAW:ref=(\w+)]([\s\S]*?)\[\/DRAW]/gi
/** 画图开标记的半截前缀正则（如 "["、"[DR"，匹配流边界被拆开的标记头部） */
const DRAW_PREFIX_PATTERN = /\[(?:d(?:r(?:a(?:w)?)?)?)?$/i
/** 一次回复中自主画图的最大张数（防模型失控刷画图配额） */
const MAX_AUTO_DRAWS_PER_REPLY = 2

/** 参考图提示标记 → 实际收集策略的映射 */
type RefHint = 'xn' | 'img' | 'all' | null

/** 解析后的画图条目 */
interface DrawEntry {
  prompt: string
  refHint: RefHint
}

/** 预设列表前端缓存有效期（ms）：过期后进入聊天页会重新拉取 /api/presets */
const PRESETS_CACHE_TTL_MS = 30_000

// ==================== 纯工具函数（不依赖响应式状态） ====================

/**
 * 去除 AI 输出中的尖括号标签及其内容（如 <thinking>...</thinking>）
 * 迭代移除最内层标签对，再清理残余孤立标签，最后合并多余空白。
 * 这是客户端 XSS 过滤的核心，任何 AI 文本进消息列表前都必须经过它。
 */
export function stripAngleBrackets(text: string): string {
  let result = text
  let prev = ''
  // 循环剥离嵌套标签对，直到没有可替换的为止
  while (prev !== result) {
    prev = result
    result = result.replace(ANGLE_BRACKET_PATTERN, '')
  }
  result = result.replace(REMNANT_TAG_PATTERN, '')
  return result.replace(/\s{2,}/g, ' ').trim()
}

/**
 * 从 Cookie 读取 CSRF Token（Double-Submit Cookie 方案）
 * 注意：SSE 流式请求使用原生 fetch，不在 csrf.client.ts 的 $fetch
 * 代理范围内，因此需要手动附加 x-csrf-token 头。
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]!) : null
}

/** 为原生 fetch 的 options 附加 CSRF 头（仅状态变更方法需要） */
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
 * 按标点符号拆分文本，连续标点并入前一个气泡
 * 例："你好！这个是测试。。。然后呢～" → ["你好！", "这个是测试。。。", "然后呢～"]
 * @returns completed - 已完成气泡列表；remaining - 未结束的尾部文本
 */
function splitByPunctuation(text: string): { completed: string[]; remaining: string } {
  const completed: string[] = []
  let lastEnd = 0
  let remaining = text

  // 正则为全局匹配，复用前必须重置 lastIndex
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
 * 从 AI 输出中剥离自主画图标记
 * 支持两种格式：
 *   [DRAW]画面描述[/DRAW]          — 无参考图提示（AI 自主决定不需要参考）
 *   [DRAW:ref=xn]画面描述[/DRAW]   — AI 认为应该用雪年立绘做参考
 *   [DRAW:ref=img]画面描述[/DRAW]  — AI 认为应该用用户图片做参考
 *   [DRAW:ref=all]画面描述[/DRAW]  — AI 认为两者都需要
 *
 * - 完整标记：提取画面描述到 entries，标记本身从文本中删除
 * - 未闭合的 [DRAW]...（流式传输中标记被拆到后续 chunk）：
 *   从标记起到末尾整体放入 holdback 暂存，待后续内容补齐后再处理；
 *   流结束时由调用方丢弃 holdback（半截标记不是给用户看的文本）
 * @returns clean - 可展示文本；entries - 收集到的画图条目；holdback - 暂存的半截标记尾部
 */
function extractDrawMarkers(text: string): { clean: string; entries: DrawEntry[]; holdback: string } {
  const entries: DrawEntry[] = []

  // 先提取带 ref 提示的标记 [DRAW:ref=xxx]...[/DRAW]
  let clean = text.replace(DRAW_REF_PATTERN, (_match, refHint: string, inner: string) => {
    const prompt = inner.trim()
    if (prompt) {
      const hint = (['xn', 'img', 'all'].includes(refHint) ? refHint : null) as RefHint
      entries.push({ prompt, refHint: hint })
    }
    return ''
  })
  DRAW_REF_PATTERN.lastIndex = 0

  // 再提取无 ref 的普通标记 [DRAW]...[/DRAW]
  clean = clean.replace(DRAW_MARKER_PATTERN, (_match, inner) => {
    const prompt = String(inner).trim()
    if (prompt) entries.push({ prompt, refHint: null })
    return ''
  })
  DRAW_MARKER_PATTERN.lastIndex = 0

  let holdback = ''
  // 未闭合开标记：从标记起到末尾整体暂存（闭合标签跨 chunk 时同样被覆盖）
  const openIdx = clean.toUpperCase().indexOf('[DRAW')
  if (openIdx !== -1) {
    holdback = clean.slice(openIdx)
    clean = clean.slice(0, openIdx)
  }
  // 末尾恰为开标记的半截前缀（"["、"[DR" 等）：一并暂存，避免预览闪现碎片
  const prefixMatch = clean.match(DRAW_PREFIX_PATTERN)
  if (prefixMatch) {
    holdback = prefixMatch[0] + holdback
    clean = clean.slice(0, -prefixMatch[0].length)
  }
  return { clean, entries, holdback }
}

/**
 * 过滤 parts 中 AI API 无法处理的图片 URL（仅保留 base64 data URL）
 * 防止服务端相对 URL（如 /images/chat/xxx.png）被原样发给 AI API 导致报错。
 * 已换成服务端 URL 的历史图片不随上下文发送，仅作本地展示。
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

/** 用户唯一标识（持久化到 localStorage，服务端历史按此 ID 存储） */
const userId = ref<string>('')

/** 全部会话列表 */
const sessions = ref<ChatSession[]>([])

/** 当前活跃会话 ID */
const activeSessionId = ref<string>('')

/** 是否正在等待/接收 AI 回复 */
const isLoading = ref(false)

/** 是否正在等待 AI 作画（手动 /draw 或回复内 [DRAW] 自主画图期间为 true） */
const isDrawing = ref(false)

/** 作画已等待秒数（每秒自增，供加载提示展示进度感） */
const drawElapsed = ref(0)

/** 作画计时器（1s 步进） */
let drawClockTimer: ReturnType<typeof setInterval> | undefined

/** 开始作画计时：isDrawing 置位并启动秒表 */
function startDrawClock(): void {
  isDrawing.value = true
  drawElapsed.value = 0
  clearInterval(drawClockTimer)
  drawClockTimer = setInterval(() => {
    drawElapsed.value++
  }, 1000)
}

/** 结束作画计时（多次并发画图时以最后一次收尾为准，简单可靠） */
function stopDrawClock(): void {
  isDrawing.value = false
  drawElapsed.value = 0
  clearInterval(drawClockTimer)
  drawClockTimer = undefined
}

/** 流式传输中尚未凑成完整句子的文本（用于流式预览光标气泡） */
const streamingContent = ref('')

/** 画图标记专用原始文本缓冲区（独立于显示管道，不受 stripAngleBrackets/断句影响） */
let rawDrawBuffer = ''

/** 待放出的气泡队列（按 1~2s 间隔逐个发射） */
const bubbleQueue = ref<string[]>([])

/** 气泡队列是否正在处理中 */
let bubbleProcessing = false

/** 取消当前队列处理的哨兵（递增即作废旧的处理循环） */
let bubbleCancelToken = 0

/** 当前错误信息（请求失败 / 流内 error 事件） */
const error = ref<string | null>(null)

/** 可用的 AI 预设列表（来自 /api/presets） */
const presets = ref<ChatPreset[]>([])

/** 预设列表是否已加载过（避免重复请求） */
const presetsLoaded = ref(false)

/** 预设列表最近一次加载成功的时间戳（配合 PRESETS_CACHE_TTL_MS 做过期刷新） */
let presetsLoadedAt = 0

/** 正在编辑的消息 ID（全局同一时刻只允许编辑一条） */
const editingMessageId = ref<string | null>(null)

/** 待发送的图片（base64 data URLs，发送时随消息上传） */
const pendingImages = ref<string[]>([])

/** localStorage 写入防抖定时器 */
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

/** 默认配置（无预设时）是否支持视觉输入 */
const defaultSupportsVision = ref(false)

/** 默认配置（无预设时）是否支持音频输入 */
const defaultSupportsAudio = ref(false)

/** 默认配置（无预设时）是否支持深度思考 */
const defaultSupportsThinking = ref(false)

/** 默认配置（无预设时）是否支持联网搜索 */
const defaultSupportsWebSearch = ref(false)

/** 默认配置（无预设时）是否允许用户自定义系统提示词 */
const defaultAllowCustomSystemPrompt = ref(false)

/** AI 画图是否已配置（驱动画图模式入口显隐） */
const imageGenEnabled = ref(false)

/** 提示词模板列表（聊天欢迎页快捷短语，来自 /api/presets） */
const promptTemplates = ref<PromptTemplate[]>([])

/** 流式传输中累积的深度思考内容（用于「思考中」实时预览） */
const streamingReasoning = ref('')

/** 本次流式回复是否经过联网搜索（done 后写入最后一条 AI 消息） */
const streamSearched = ref(false)

/** 当前回复中收集到的自主画图条目（[DRAW] / [DRAW:ref=xxx] 标记协议，流结束后统一出图） */
const pendingAutoDraws = ref<DrawEntry[]>([])

/** 是否处于画图模式（发送的消息将作为画面描述调用 AI 画图） */
const drawMode = ref(false)

/** 是否已完成客户端初始化（保证只初始化一次） */
let initialized = false

// ==================== 模块级存储工具（localStorage 读写） ====================

/** 保存会话列表到 localStorage（防抖 300ms） */
function saveSessions() {
  if (import.meta.server) return
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer)
  saveDebounceTimer = setTimeout(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.value))
    } catch { /* 忽略存储满等异常 */ }
  }, SAVE_DEBOUNCE_MS)
}

/** 立即写入待保存的会话数据（页面卸载前调用，防止防抖期间丢数据） */
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

/** 保存当前活跃会话 ID 到 localStorage */
function saveActiveSessionId() {
  if (import.meta.server) return
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId.value)
  } catch { /* 忽略 */ }
}

/** 生成消息/会话/用户唯一 ID */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** 读取（或首次生成）用户唯一标识 */
function loadUserId(): string {
  if (import.meta.server) return ''
  try {
    let id = localStorage.getItem(USER_ID_KEY)
    if (!id) {
      id = generateId()
      localStorage.setItem(USER_ID_KEY, id)
    }
    return id
  } catch {
    // localStorage 不可用（隐私模式等）时退回内存 ID
    return generateId()
  }
}

/** 从 localStorage 恢复会话列表 */
function loadSessions(): ChatSession[] {
  if (import.meta.server) return []
  try {
    const saved = localStorage.getItem(SESSIONS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* 忽略损坏数据 */ }
  return []
}

/** 从 localStorage 恢复活跃会话 ID */
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
 */
export function useChat() {
  // 客户端首次调用时执行一次性初始化（SSR 阶段跳过）
  if (!import.meta.server && !initialized) {
    initState()
  }

  // ==================== 计算属性 ====================

  /** 当前活跃会话对象 */
  const activeSession = computed(() => {
    return sessions.value.find(s => s.id === activeSessionId.value) || null
  })

  /** 当前会话的消息列表（可写：写回时同步刷新活跃时间并持久化） */
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

  /** 当前会话选中的预设名称（可写：写回会话并持久化） */
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

  /** 当前预设是否支持视觉（图片）输入；无预设时看默认配置 */
  const supportsVision = computed(() => {
    if (!currentPreset.value) return defaultSupportsVision.value
    const preset = presets.value.find(p => p.name === currentPreset.value)
    return preset?.supportsVision || false
  })

  /** 当前预设是否支持音频输入；无预设时看默认配置 */
  const supportsAudio = computed(() => {
    if (!currentPreset.value) return defaultSupportsAudio.value
    const preset = presets.value.find(p => p.name === currentPreset.value)
    return preset?.supportsAudio || false
  })

  /** 当前预设是否支持深度思考；无预设时看默认配置 */
  const supportsThinking = computed(() => {
    if (!currentPreset.value) return defaultSupportsThinking.value
    const preset = presets.value.find(p => p.name === currentPreset.value)
    return preset?.supportsThinking || false
  })

  /** 当前预设是否支持联网搜索；无预设时看默认配置 */
  const supportsWebSearch = computed(() => {
    if (!currentPreset.value) return defaultSupportsWebSearch.value
    const preset = presets.value.find(p => p.name === currentPreset.value)
    return preset?.supportsWebSearch || false
  })

  /** 当前预设是否允许用户自定义系统提示词；无预设时看默认配置 */
  const allowCustomSystemPrompt = computed(() => {
    if (!currentPreset.value) return defaultAllowCustomSystemPrompt.value
    const preset = presets.value.find(p => p.name === currentPreset.value)
    return preset?.allowCustomSystemPrompt || false
  })

  /** 当前预设的 AI 头像（无预设或无头像时返回空串，组件层回退默认头像） */
  const currentPresetAvatar = computed(() => {
    if (!currentPreset.value) return ''
    const preset = presets.value.find(p => p.name === currentPreset.value)
    return preset?.avatar || ''
  })

  /** 当前会话是否有聊天记录（控制「清除记忆」按钮显隐） */
  const hasMemory = computed(() => messages.value.length > 0)

  /** 消息数是否达到警告阈值（800 条，显示提示横幅） */
  const messageLimitWarning = computed(() => messages.value.length >= MESSAGE_WARN_LIMIT && messages.value.length < MESSAGE_MAX_LIMIT)

  /** 消息数是否达到硬上限（1000 条） */
  const messageLimitReached = computed(() => messages.value.length >= MESSAGE_MAX_LIMIT)

  /** 当前会话是否已启用滚动窗口模式（裁剪旧消息继续对话） */
  const slidingWindowActive = computed(() => activeSession.value?.slidingWindow === true)

  /** 是否阻断发送（达到硬上限且未启用滚动窗口） */
  const sendBlocked = computed(() => messageLimitReached.value && !slidingWindowActive.value)

  /** 当前会话累计 token 用量（从各条 AI 消息上实时汇总） */
  const sessionTokenUsage = computed(() => {
    const msgs = activeSession.value?.messages || []
    let input = 0
    let output = 0
    let total = 0
    for (const m of msgs) {
      if (m.tokenUsage) {
        input += m.tokenUsage.input || 0
        output += m.tokenUsage.output || 0
        total += m.tokenUsage.total || 0
      }
    }
    return { input, output, total }
  })

  /**
   * 流式进行中的实时预览文本（已过滤标签）
   * 供输入指示区展示「正在输出」的光标气泡；
   * 画图标记与未闭合的半截标记尾部一并隐藏（只读剥离，不触发收集）
   */
  const streamingPreview = computed(() => extractDrawMarkers(stripAngleBrackets(streamingContent.value)).clean)

  // ==================== 服务端历史同步 ====================

  /** 从服务器加载聊天历史并与本地合并（服务端数据在消息更多/更新时优先） */
  async function loadFromServer() {
    if (import.meta.server) return
    try {
      const response = await $fetch<{ success: boolean; data: { userId: string; sessions: ChatSession[] } }>(
        `/api/chat/history?userId=${encodeURIComponent(userId.value)}`
      )
      if (response.success && response.data && response.data.sessions.length > 0) {
        const serverSessions = response.data.sessions

        // 合并策略：服务端消息更多或一样多时采用服务端数据；保留本地独有会话
        const localMap = new Map(sessions.value.map(s => [s.id, s]))
        for (const ss of serverSessions) {
          const local = localMap.get(ss.id)
          if (local) {
            if (ss.messages.length >= local.messages.length) {
              local.messages = ss.messages
              local.lastActiveAt = ss.lastActiveAt
              local.name = ss.name
            }
          } else {
            // 服务端有但本地没有的会话（如换设备后恢复）
            sessions.value.push(ss)
          }
        }
        saveSessions()
      }
    } catch {
      // 服务器不可用时不影响本地使用
    }
  }

  /** 将全部会话整体同步到服务器（replace 模式，静默失败） */
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
            lastActiveAt: s.lastActiveAt,
            enableThinking: s.enableThinking,
            enableSearch: s.enableSearch,
            customSystemPrompt: s.customSystemPrompt
          })),
          replace: true
        }
      })
    } catch {
      // 静默失败，本地已有数据
    }
  }

  // ==================== 会话管理 ====================

  /** 创建新会话并切换为活跃会话，返回新会话 ID */
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

  /** 切换到指定会话 */
  function switchSession(sessionId: string) {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      activeSessionId.value = sessionId
      session.lastActiveAt = Date.now()
      saveSessions()
      saveActiveSessionId()
    }
  }

  /** 删除会话（同时同步删除服务端历史） */
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

    // 同步删除服务端历史（失败静默）
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

  /** 清空当前会话的全部消息（「清除记忆」），并重置相关状态 */
  function clearMemory() {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (session) {
      session.messages = []
      session.lastActiveAt = Date.now()
      error.value = null
      streamingContent.value = ''
      streamingReasoning.value = ''
      streamSearched.value = false
      pendingAutoDraws.value = []
      pendingImages.value = []
      saveSessions()
    }
  }

  // ==================== 预设管理 ====================

  /** 加载 AI 预设列表（30 秒内缓存；失败不影响聊天主流程） */
  async function loadPresets() {
    // 带 TTL 的缓存：管理后台改完设置后，聊天页再次进入时能及时拿到新能力开关
    if (presetsLoaded.value && Date.now() - presetsLoadedAt < PRESETS_CACHE_TTL_MS) return
    try {
      const response = await $fetch<PresetsResponse>('/api/presets')
      if (response.success && response.data) {
        presets.value = response.data.presets
        defaultSupportsVision.value = response.data.defaultSupportsVision || false
        defaultSupportsAudio.value = response.data.defaultSupportsAudio || false
        defaultSupportsThinking.value = response.data.defaultSupportsThinking || false
        defaultSupportsWebSearch.value = response.data.defaultSupportsWebSearch || false
        defaultAllowCustomSystemPrompt.value = response.data.defaultAllowCustomSystemPrompt || false
        imageGenEnabled.value = response.data.imageGenEnabled || false
        promptTemplates.value = response.data.promptTemplates || []
        presetsLoadedAt = Date.now()
      }
    } catch {
      // 预设加载失败时使用默认配置
    }
    presetsLoaded.value = true
  }

  /** 切换当前会话使用的预设 */
  function selectPreset(name: string) {
    currentPreset.value = name
  }

  // ==================== 待发送图片管理 ====================

  /** 添加一张待发送图片（base64 data URL） */
  function addPendingImage(dataUrl: string) {
    pendingImages.value.push(dataUrl)
  }

  /** 按索引移除一张待发送图片 */
  function removePendingImage(index: number) {
    pendingImages.value.splice(index, 1)
  }

  /** 清空全部待发送图片 */
  function clearPendingImages() {
    pendingImages.value = []
  }

  /**
   * 将指定消息中的 base64 图片 parts 替换为服务端轻量 URL
   * 在 AI 响应完成后异步调用（不阻塞用户交互），避免 base64 撑爆
   * localStorage / 服务端历史 JSON。上传失败的图片保留原始 base64。
   */
  async function swapMessageImagesToUrls(messageId: string, base64Parts: ContentPart[]) {
    if (base64Parts.length === 0) return

    // 提取需要上传的 base64 data URL
    const base64Urls = base64Parts
      .filter(p => p.type === 'image_url' && p.image_url?.url?.startsWith('data:'))
      .map(p => p.image_url!.url)

    if (base64Urls.length === 0) return

    // 逐张上传到服务器，收集成功的轻量 URL
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
        // 静默失败，保留原始 base64（虽然体积大，但至少不丢数据）
      }
    }

    if (uploadedUrls.length === 0) return

    // 找到消息并按顺序替换 parts 中的 base64 URL
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session) return
    const msg = session.messages.find(m => m.id === messageId)
    if (!msg || !msg.parts) return

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

  // ==================== 气泡队列（流式内容分段延迟放出） ====================

  /** 将已完成的气泡加入队列，并启动（或复用进行中的）延迟发射 */
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

  /** 逐个放出队列中的气泡，每个间隔 1~2 秒（模拟真人连发效果） */
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

  /** 等待气泡队列全部放出（带超时保护，防止异常情况下永久挂起） */
  async function waitForBubbleQueue(timeoutMs: number) {
    const start = Date.now()
    while (bubbleProcessing && bubbleQueue.value.length > 0) {
      if (Date.now() - start > timeoutMs) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // ==================== 流式消息发送 ====================

  /**
   * 构建发送给 AI 的上下文消息列表
   * - 启用滚动窗口时仅取最近 SLIDING_WINDOW_SIZE 条
   * - 当前预设不支持视觉时剥离全部图片 parts
   * - 支持视觉时也仅保留 base64 图片（见 safeAIParts）
   */
  function buildRequestMessages(session: ChatSession) {
    const visionSupported = supportsVision.value
    let contextMessages = session.messages
    if (slidingWindowActive.value && contextMessages.length > SLIDING_WINDOW_SIZE) {
      contextMessages = contextMessages.slice(-SLIDING_WINDOW_SIZE)
    }
    return contextMessages.map(m => ({
      role: m.role,
      content: m.content,
      parts: visionSupported ? safeAIParts(m.parts) : undefined
    }))
  }

  /**
   * 从 SSE 流中读取 AI 回复并按标点拆分气泡
   * 这是 sendMessage / sendMessageAfterEdit 共用的核心读取循环。
   * @returns 流式 done 事件回传的 token 用量（可能为空）
   */
  async function consumeStream(
    response: Response,
    session: ChatSession
  ): Promise<{ input: number; output: number; total: number } | undefined> {
    const reader = response.body?.getReader()
    if (!reader) {
      error.value = '无法读取 AI 响应流'
      return undefined
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let streamDone = false
    let streamUsage: { input: number; output: number; total: number } | undefined

    /** 处理单条 SSE data 载荷（JSON 事件） */
    const handleEventData = (dataStr: string) => {
      if (!dataStr || dataStr === '[DONE]') return
      try {
        const event = JSON.parse(dataStr)

        if (event.type === 'chunk' && event.content) {
          const chunkText = event.content as string

          // ====== 画图标记提取（独立管道，使用原始文本，不受断句/过滤影响） ======
          rawDrawBuffer += chunkText
          const { entries: drawEntries, holdback: drawHoldback } = extractDrawMarkers(rawDrawBuffer)
          if (drawEntries.length > 0) {
            pendingAutoDraws.value.push(...drawEntries)
          }
          rawDrawBuffer = drawHoldback // 仅保留未闭合的半截标记

          // ====== 显示文本管道（过滤 + 断句拆气泡） ======
          streamingContent.value += chunkText
          const filtered = stripAngleBrackets(streamingContent.value)
          // 从显示文本中也剥离画图标记（避免 [DRAW] 标签显示在气泡中）
          const { clean: displayClean } = extractDrawMarkers(filtered)
          const { completed, remaining } = splitByPunctuation(displayClean)
          enqueueBubbles(completed, session)
          streamingContent.value = remaining
          session.lastActiveAt = Date.now()
        } else if (event.type === 'reasoning' && event.content) {
          // 深度思考增量：原样累积（纯文本，组件渲染时转义，不过滤尖括号）
          streamingReasoning.value += event.content as string
        } else if (event.type === 'search') {
          // 联网搜索状态提示：仅置标记，搜索提示文案由组件层展示
          streamSearched.value = true
        } else if (event.type === 'done') {
          streamDone = true
          if (event.usage) {
            streamUsage = event.usage
          }
        } else if (event.type === 'error') {
          error.value = event.message || 'AI 回复出错'
          streamDone = true
        }
      } catch {
        // 忽略解析失败的事件（半截 JSON 等）
      }
    }

    // 逐行读取 SSE（data: {...}\n\n 格式）
    while (!streamDone) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        handleEventData(trimmed.slice(5).trim())
      }

      saveSessions()
    }

    // 处理流结束时 buffer 中残留的最后一条数据
    if (buffer.trim()) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data:')) {
        handleEventData(trimmed.slice(5).trim())
      }
    }

    // 流结束：rawDrawBuffer 中可能还有未闭合的半截标记，流已结束直接丢弃；
    // 最后尝试提取可能被遗漏的完整标记
    const { entries: finalEntries } = extractDrawMarkers(rawDrawBuffer)
    if (finalEntries.length > 0) {
      pendingAutoDraws.value.push(...finalEntries)
    }
    rawDrawBuffer = ''

    // 显示文本：未凑成完整句子的残余作为最后一个气泡入队
    // （同样剥离画图标记，避免残留标签显示在气泡中）
    const { clean: finalClean } = extractDrawMarkers(stripAngleBrackets(streamingContent.value))
    if (finalClean) {
      enqueueBubbles([finalClean], session)
    }
    // 等待所有气泡放出完毕（最多 30s）
    await waitForBubbleQueue(BUBBLE_QUEUE_TIMEOUT_MS)

    // 将 token 用量附加到当前会话最后一条 AI 消息
    if (streamUsage && session.messages.length > 0) {
      const lastMsg = session.messages[session.messages.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.tokenUsage = streamUsage
      }
    }

    // 深度思考过程与联网搜索标记同样附加到最后一条 AI 消息
    // （多气泡回复时思考内容归属于整条回复，挂在最后一个气泡上展示）
    if ((streamingReasoning.value || streamSearched.value) && session.messages.length > 0) {
      const lastMsg = session.messages[session.messages.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        if (streamingReasoning.value.trim()) {
          lastMsg.reasoning = streamingReasoning.value
        }
        if (streamSearched.value) {
          lastMsg.searched = true
        }
      }
    }

    // 文本气泡全部放出后执行智能体自主画图（[DRAW] 标记收集到的画面描述）
    // 放在 token 用量/思考过程挂载之后，避免这些元数据挂到图片消息上；
    // 此时 isLoading 仍为 true，加载指示自然覆盖画图等待时间
    await executeAutoDraws(session)

    streamingContent.value = ''
    streamingReasoning.value = ''
    streamSearched.value = false
    session.lastActiveAt = Date.now()
    saveSessions()

    return streamUsage
  }

  /**
   * 从会话全部历史消息中收集用户上传的图片 URL
   * - base64 data URL（尚未 swapToUrls 的新消息）
   * - 服务端图片路径（已 swap 的历史消息，如 /images/chat/xxx.png）
   *
   * 安全考量：服务端 draw 端点对 /images/ 路径有路径遍历防护，
   * 仅读取 public/images/ 下的文件，不会泄露系统文件。
   */
  function collectSessionImages(session: ChatSession): string[] {
    const images: string[] = []
    for (const msg of session.messages) {
      if (msg.role !== 'user' || !msg.parts || msg.parts.length === 0) continue
      for (const part of msg.parts) {
        if (part.type !== 'image_url' || !part.image_url?.url) continue
        const url = part.image_url.url
        // base64 data URL（新消息）或服务端路径（历史消息）
        if (url.startsWith('data:image/') || url.startsWith('/images/')) {
          images.push(url)
        }
      }
    }
    return images
  }

  /**
   * 根据 AI 的 ref 提示 + 会话历史，智能解析参考图列表
   * @param refHint - AI 在 [DRAW:ref=xxx] 中给出的提示
   * @param session - 当前会话（用于收集用户图片）
   * @param prompt - 画图提示词（兜底关键词检测）
   * @returns 参考图列表（base64 data URL 或 /images/ 服务端路径）
   */
  function resolveRefImages(refHint: RefHint, session: ChatSession, prompt: string): string[] {
    const refs: string[] = []
    const wantXn = refHint === 'xn' || refHint === 'all'
    const wantImg = refHint === 'img' || refHint === 'all'

    // AI 未给提示时，兜底用关键词检测雪年 + 自动收集全部用户图片
    const fallback = refHint === null

    // 雪年立绘：AI 明确要求 OR 兜底检测到关键词
    if (wantXn || (fallback && XUENIAN_PATTERN.test(prompt))) {
      refs.push('/images/立绘.png')
    }

    // 用户图片：AI 明确要求 OR 兜底自动收集全部历史图片
    if (wantImg || fallback) {
      const sessionImgs = collectSessionImages(session)
      for (const img of sessionImgs) {
        refs.push(img)
      }
    }

    return refs
  }

  /**
   * 执行智能体自主画图：将流中收集到的 [DRAW] / [DRAW:ref=xxx] 标记逐张出图，
   * 成功的图片作为 AI 图片消息插入会话（与手动画图共用服务端限速配额）
   *
   * 参考图解析策略（AI 自主决定，系统辅助）：
   * - [DRAW:ref=xn]  → AI 判定应使用雪年立绘做角色参考
   * - [DRAW:ref=img] → AI 判定应使用用户历史图片做风格参考
   * - [DRAW:ref=all] → 两者都需要
   * - [DRAW]         → AI 未指定，系统兜底：关键词检测 + 自动收集全历史图片
   *
   * 用户图片收集范围：会话全部历史消息（不限于本轮），
   * 同时支持 base64 data URL（新上传）和服务端路径（已持久化的历史图）
   */
  async function executeAutoDraws(session: ChatSession) {
    // 去重（按 prompt 文本）+ 条数上限（防模型失控刷配额），随后清空收集槽
    const seen = new Set<string>()
    const entries: DrawEntry[] = []
    for (const entry of pendingAutoDraws.value) {
      const key = entry.prompt.replace(/\s+/g, ' ').trim()
      if (key && !seen.has(key)) {
        seen.add(key)
        entries.push({ prompt: key, refHint: entry.refHint })
      }
    }
    const limited = entries.slice(0, MAX_AUTO_DRAWS_PER_REPLY)
    pendingAutoDraws.value = []

    // 自主画图可能连续多张：整个循环期间保持作画计时
    if (limited.length > 0) startDrawClock()
    try {
      for (const { prompt, refHint } of limited) {
        const refImages = resolveRefImages(refHint, session, prompt)

        const imageUrl = await requestDrawUrl(prompt.slice(0, 500), session.id, refImages.length > 0 ? refImages : undefined)
        if (imageUrl) {
          const refNote = refImages.length > 0 ? `（已参考 ${refImages.length} 张图片）` : ''
          session.messages.push({
            id: generateId(),
            role: 'assistant' as ChatRole,
            content: `画好啦～这是咱画的「${prompt}」：${refNote}`,
            parts: [{ type: 'image_url' as const, image_url: { url: imageUrl } }],
            timestamp: Date.now()
          })
          session.lastActiveAt = Date.now()
          saveSessions()
        } else if (!error.value) {
          error.value = drawErrorMessage ? `自主画图失败：${drawErrorMessage}` : '自主画图失败，请稍后再试'
        }
      }
    } finally {
      stopDrawClock()
    }
  }

  /** 流式请求结束后的统一收尾（成功/失败都会执行） */
  function finalizeStreamState() {
    isLoading.value = false
    streamingContent.value = ''
    rawDrawBuffer = ''
    streamingReasoning.value = ''
    streamSearched.value = false
    pendingAutoDraws.value = []
    bubbleQueue.value = []
    bubbleCancelToken++ // 作废旧的气泡处理循环
    bubbleProcessing = false
    saveSessions()
  }

  /** 流式请求开始前的统一状态重置（sendMessage / sendMessageAfterEdit 共用） */
  function beginStreamState() {
    isLoading.value = true
    streamingContent.value = ''
    rawDrawBuffer = ''
    streamingReasoning.value = ''
    streamSearched.value = false
    error.value = null
  }

  /** 发起 /api/chat 流式请求（sendMessage / sendMessageAfterEdit 共用） */
  function requestChatStream(session: ChatSession): Promise<Response> {
    return fetch('/api/chat', withCsrf({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: buildRequestMessages(session),
        preset: session.preset || undefined,
        stream: true,
        // 会话级能力开关（服务端 resolveChatOptions 会按预设能力二次校验）
        enableThinking: session.enableThinking === true,
        enableSearch: session.enableSearch === true,
        customSystemPrompt: session.customSystemPrompt || undefined
      })
    }))
  }

  /**
   * 发送用户消息并以 SSE 流式接收 AI 回复
   * 画图模式下改为调用 drawImage（消息内容作为画面描述）
   * @param content - 用户输入的文本内容
   */
  async function sendMessage(content: string) {
    if (!content.trim() || isLoading.value) return

    // 画图模式：走 /api/chat/draw，不进入聊天流式流程
    if (drawMode.value) {
      return drawImage(content)
    }

    // 达到消息硬上限且未启用滚动窗口时阻断
    if (sendBlocked.value) {
      error.value = `当前会话已达到 ${MESSAGE_MAX_LIMIT} 条消息上限，请创建新对话或启用滚动窗口模式继续聊天。`
      return
    }

    if (!activeSessionId.value) {
      createSession()
    }

    // 待发送图片转为多模态 parts
    const parts: ContentPart[] = pendingImages.value.map(dataUrl => ({
      type: 'image_url' as const,
      image_url: { url: dataUrl, detail: 'auto' as const }
    }))

    // 保留一份 parts 副本，用于 AI 响应后异步上传换取轻量 URL
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

    beginStreamState()

    try {
      const response = await requestChatStream(session)

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        error.value = (errData as any).message || `请求失败 (${response.status})`
        isLoading.value = false
        return
      }

      await consumeStream(response, session)

      // AI 响应完成后，异步将消息中的 base64 图片替换为服务端轻量 URL
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
      finalizeStreamState()
    }
  }

  // ==================== 消息编辑与重发 ====================

  /** 进入指定消息的编辑模式 */
  function startEdit(messageId: string) {
    editingMessageId.value = messageId
  }

  /** 退出编辑模式 */
  function cancelEdit() {
    editingMessageId.value = null
  }

  /**
   * 保存编辑并截断该消息之后的全部消息，然后重新请求 AI 回复
   * （「保存并重发」：以编辑后的内容为最新一条用户消息重新生成）
   */
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
    // 截断后续消息：编辑点之后的内容全部废弃
    session.messages.splice(idx + 1)
    session.lastActiveAt = Date.now()
    saveSessions()

    editingMessageId.value = null
    await sendMessageAfterEdit()
  }

  /** 仅保存编辑内容（不截断后续消息，不重新请求 AI） */
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
   * 基于当前会话已有的消息列表重新请求 AI 回复（流式）
   * 用途：编辑重发 / 请求失败后的「重试」（不新增用户消息）
   */
  async function sendMessageAfterEdit() {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session || session.messages.length === 0) return

    // 达到消息硬上限且未启用滚动窗口时阻断（与 sendMessage 同一判断）
    if (sendBlocked.value) {
      error.value = `当前会话已达到 ${MESSAGE_MAX_LIMIT} 条消息上限，请创建新对话或启用滚动窗口模式继续聊天。`
      return
    }

    beginStreamState()

    try {
      const response = await requestChatStream(session)

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        error.value = (errData as any).message || `请求失败 (${response.status})`
        isLoading.value = false
        return
      }

      await consumeStream(response, session)

      // 异步同步到服务器
      syncToServer()
    } catch (e: any) {
      console.error('AI 聊天请求失败：', e)
      if (!error.value) {
        error.value = e?.message || '网络请求失败，请检查 API 配置'
      }
    } finally {
      finalizeStreamState()
    }
  }

  // ==================== 其他工具 ====================

  /**
   * 激活当前会话的滚动窗口模式
   * 超过消息上限后，仅保留最近 SLIDING_WINDOW_SIZE 条消息发送给 AI；
   * 早期消息仍保留在本地但不会作为上下文传给 AI。
   */
  function activateSlidingWindow() {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session) return
    session.slidingWindow = true
    session.lastActiveAt = Date.now()
    saveSessions()
  }

  // ==================== 会话级能力开关（深度思考 / 联网搜索 / 自定义提示词 / 画图） ====================

  /** 切换当前会话的深度思考开关（仅预设支持时生效，UI 层已按能力显隐） */
  function toggleThinking() {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session) return
    session.enableThinking = !session.enableThinking
    session.lastActiveAt = Date.now()
    saveSessions()
  }

  /** 切换当前会话的联网搜索开关 */
  function toggleSearch() {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session) return
    session.enableSearch = !session.enableSearch
    session.lastActiveAt = Date.now()
    saveSessions()
  }

  /** 设置当前会话的自定义系统提示词（空串视为清除；服务端发送前二次校验） */
  function setCustomSystemPrompt(prompt: string) {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session) return
    const trimmed = prompt.trim()
    session.customSystemPrompt = trimmed || undefined
    session.lastActiveAt = Date.now()
    saveSessions()
  }

  /** 切换画图模式（开启时发送的消息将作为画面描述调用 AI 画图） */
  function toggleDrawMode() {
    drawMode.value = !drawMode.value
  }

  /** 最近一次画图请求失败的错误信息（requestDrawUrl 侧写，drawImage 读取展示） */
  let drawErrorMessage: string | null = null

  /**
   * 请求服务端 AI 画图接口，成功返回落盘后的图片 URL，失败返回 null
   * 手动画图（drawImage）与智能体自主画图（executeAutoDraws）共用；
   * 服务端有 CSRF 校验 + 每 IP 限速 + prompt 长度限制；
   * sessionId 仅用于服务端日志关联同一次会话
   *
   * @param prompt - 画面描述
   * @param sessionId - 可选，会话 ID 用于日志关联
   * @param referenceImages - 可选，参考图片列表（base64 data URL 或服务端相对路径）
   *
   * 注意：服务端为长连接保活会提前下发 200 响应头，生成阶段的成功/失败
   * 以响应体 success 字段表达（失败时带中文 message）；校验类错误
   * （400/429/405）仍是 HTTP 错误，走 catch 分支
   */
  async function requestDrawUrl(prompt: string, sessionId?: string, referenceImages?: string[]): Promise<string | null> {
    try {
      const response = await $fetch<{ success: boolean; data?: { url: string }; message?: string }>('/api/chat/draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getCsrfToken() ? { 'x-csrf-token': getCsrfToken()! } : {})
        },
        body: { prompt, sessionId, ...(referenceImages?.length ? { referenceImages } : {}) }
      })
      if (response.success && response.data?.url) return response.data.url
      // 生成阶段失败：200 响应体中的 message 即服务端给出的具体原因
      drawErrorMessage = response?.message || null
      return null
    } catch (e: any) {
      console.error('AI 画图请求失败：', e)
      drawErrorMessage = e?.data?.message || e?.message || null
      return null
    }
  }

  /** 雪年角色关键词正则（兜底检测，AI 未给 ref 提示时使用） */
  const XUENIAN_PATTERN = /雪年|XueNian|xuenian/

  /**
   * AI 画图：把画面描述发到 /api/chat/draw，生成的图片以 AI 消息形式插入会话
   *
   * 参考图收集策略（与 AI 自主画图一致）：
   * - 提示词命中「雪年」→ 自动附加 /images/立绘.png
   * - 用户上传的图片（pendingImages）+ 历史消息中的图片 → 全部作为参考
   * - 参考图以 base64 data URL 或服务端相对路径传递，
   *   服务端自动解析 /images/ 开头的路径为本地文件
   *
   * @param content - 用户输入的画面描述
   */
  async function drawImage(content: string) {
    const prompt = content.trim()
    if (!prompt || isLoading.value) return

    if (!activeSessionId.value) {
      createSession()
    }

    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (!session) return

    // 收集参考图片
    const refImages: string[] = []

    // 雪年关键词兜底检测 → 自动附加立绘
    if (XUENIAN_PATTERN.test(prompt)) {
      refImages.push('/images/立绘.png')
    }

    // 用户上传的图片（pendingImages）+ 历史消息中全部图片
    for (const img of pendingImages.value) {
      if (img.startsWith('data:image/')) {
        refImages.push(img)
      }
    }
    // 同时扫描历史消息中的图片（已持久化的）
    for (const img of collectSessionImages(session)) {
      if (!refImages.includes(img)) {
        refImages.push(img)
      }
    }

    // 用户消息（画面描述 + 参考图标记）
    const hasRefs = refImages.length > 0
    const userContent = hasRefs
      ? `🎨 ${prompt}（参考图 ${refImages.length} 张）`
      : `🎨 ${prompt}`
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user' as ChatRole,
      content: userContent,
      timestamp: Date.now()
    }
    session.messages.push(userMessage)
    session.lastActiveAt = Date.now()
    clearPendingImages()
    saveSessions()

    isLoading.value = true
    error.value = null
    drawErrorMessage = null
    startDrawClock()

    const imageUrl = await requestDrawUrl(prompt, session.id, refImages.length > 0 ? refImages : undefined)
    if (imageUrl) {
      // AI 消息：文本说明 + 图片 part（复用多模态渲染管线）
      const aiMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant' as ChatRole,
        content: hasRefs ? `参考了 ${refImages.length} 张图来画「${prompt}」～怎么样？` : `画好啦～这是咱画的「${prompt}」：`,
        parts: [{ type: 'image_url', image_url: { url: imageUrl } }],
        timestamp: Date.now()
      }
      session.messages.push(aiMessage)
      session.lastActiveAt = Date.now()
      saveSessions()
      syncToServer()
    } else {
      error.value = drawErrorMessage || '画图失败，请稍后重试'
    }
    stopDrawClock()
    isLoading.value = false
  }

  /** 清除当前错误信息 */
  function clearError() {
    error.value = null
  }

  // ==================== 初始化 ====================

  /**
   * 客户端一次性初始化：
   * 恢复 localStorage 数据 → 确保至少有一个会话 → 后台同步服务端历史
   * → 注册页面卸载时的兜底保存与同步
   */
  function initState() {
    initialized = true

    userId.value = loadUserId()
    sessions.value = loadSessions()
    activeSessionId.value = loadActiveSessionId()

    // 首次使用：创建默认会话
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

    // 校验活跃会话仍然有效（本地数据可能被手动清过）
    if (activeSessionId.value && !sessions.value.find(s => s.id === activeSessionId.value)) {
      const firstSession = sessions.value[0]
      if (firstSession) {
        activeSessionId.value = firstSession.id
      }
    }

    // 后台异步合并服务端历史（7 天有效期）
    loadFromServer()

    // 页面卸载前：立即写入 localStorage，并用 keepalive 请求兜底同步服务端
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
          lastActiveAt: s.lastActiveAt,
          enableThinking: s.enableThinking,
          enableSearch: s.enableSearch,
          customSystemPrompt: s.customSystemPrompt
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
      }).catch(() => { /* 页面卸载中，忽略错误 */ })
    })
  }

  // ==================== 对外暴露 ====================

  return {
    // 状态
    userId,
    sessions,
    activeSessionId,
    activeSession,
    messages,
    isLoading,
    isDrawing,
    drawElapsed,
    streamingContent,
    streamingPreview,
    streamingReasoning,
    streamSearched,
    error,
    presets,
    currentPreset,
    currentPresetAvatar,
    presetsLoaded,
    supportsVision,
    supportsAudio,
    supportsThinking,
    supportsWebSearch,
    allowCustomSystemPrompt,
    imageGenEnabled,
    promptTemplates,
    drawMode,
    editingMessageId,
    pendingImages,
    // 统计与限制
    hasMemory,
    sessionTokenUsage,
    messageLimitWarning,
    messageLimitReached,
    slidingWindowActive,
    sendBlocked,
    // 会话管理
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    clearMemory,
    activateSlidingWindow,
    // 能力开关
    toggleThinking,
    toggleSearch,
    setCustomSystemPrompt,
    toggleDrawMode,
    // 预设
    loadPresets,
    selectPreset,
    // 消息收发
    sendMessage,
    sendMessageAfterEdit,
    drawImage,
    startEdit,
    cancelEdit,
    saveEdit,
    saveEditOnly,
    clearError,
    // 图片
    addPendingImage,
    removePendingImage,
    clearPendingImages,
    // 存储
    flushSessions,
    syncToServer
  }
}
