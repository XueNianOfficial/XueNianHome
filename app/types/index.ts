/**
 * ============================================================
 *  雪年个人网站 - TypeScript 类型定义
 *  定义全站使用的核心数据结构
 * ============================================================
 */

// ---------- 博客相关类型 ----------

/** 博客文章 frontmatter 元数据 */
export interface BlogPostMeta {
  /** 文章标题 */
  title: string
  /** 发布日期 (YYYY-MM-DD) */
  date: string
  /** 文章摘要/描述 */
  description: string
  /** 封面图路径（可选，位于 public/images/ 下） */
  cover?: string
  /** 文章标签 */
  tags?: string[]
  /** 是否为草稿（草稿不会在列表中显示） */
  draft?: boolean
}

/** 博客文章完整数据（meta + 内容 + 路径） */
export interface BlogPost extends BlogPostMeta {
  /** URL slug，如 "hello-world" */
  slug: string
  /** Markdown 渲染后的 HTML 内容 */
  content?: string
}

// ---------- 友链相关类型 ----------

/** 友链条目 */
export interface FriendLink {
  /** 好友名称 */
  name: string
  /** 头像 URL 或本地路径 */
  avatar: string
  /** 简短描述 */
  description: string
  /** 链接地址 */
  url: string
}

// ---------- 社交平台相关类型 ----------

/** 社交平台链接 */
export interface SocialLink {
  /** 平台名称 */
  platform: string
  /** 图标名称（nuxt-icon 或自定义 SVG） */
  icon: string
  /** 链接地址 */
  url: string
  /** 颜色（用于悬停效果） */
  color?: string
}

// ---------- AI 聊天相关类型 ----------

/** 聊天消息角色 */
export type ChatRole = 'user' | 'assistant' | 'system'

/** 多模态内容片段 */
export interface ContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string  // base64 data URL or https URL
    detail?: 'auto' | 'low' | 'high'
  }
}

/** 单条聊天消息 */
export interface ChatMessage {
  /** 消息唯一 ID */
  id: string
  /** 发送者角色 */
  role: ChatRole
  /** 消息内容（文本） */
  content: string
  /** 多模态内容片段（如图片） */
  parts?: ContentPart[]
  /** 发送时间戳 */
  timestamp: number
  /** 是否已编辑 */
  edited?: boolean
  /** 本条消息消耗的 token（仅 AI 回复消息有效） */
  tokenUsage?: TokenUsage
  /** 深度思考过程（仅 AI 回复消息有效，纯文本，渲染时需转义） */
  reasoning?: string
  /** 本条回复是否经过联网搜索（仅 AI 回复消息有效） */
  searched?: boolean
}

/** Token 用量统计 */
export interface TokenUsage {
  /** 输入 token 数（prompt） */
  input: number
  /** 输出 token 数（completion） */
  output: number
  /** 总计 token 数 */
  total: number
}

/** 聊天会话 */
export interface ChatSession {
  /** 会话唯一 ID */
  id: string
  /** 会话名称 */
  name: string
  /** 消息列表 */
  messages: ChatMessage[]
  /** 使用的预设名称 */
  preset: string
  /** 创建时间 */
  createdAt: number
  /** 最后活跃时间 */
  lastActiveAt: number
  /** 是否启用滚动窗口模式（超过消息上限后裁剪旧消息继续对话） */
  slidingWindow?: boolean
  /** 本会话是否开启深度思考（需预设支持，发送时随请求携带） */
  enableThinking?: boolean
  /** 本会话是否开启联网搜索（需预设支持） */
  enableSearch?: boolean
  /** 本会话的自定义系统提示词（需预设允许，服务端二次校验） */
  customSystemPrompt?: string
}

/** 聊天状态 */
export interface ChatState {
  /** 消息列表 */
  messages: ChatMessage[]
  /** 是否正在加载 AI 回复 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
}

/** AI 预设（客户端可见信息） */
export interface ChatPreset {
  /** 预设名称 */
  name: string
  /** 使用的模型 */
  model?: string
  /** 是否支持视觉（图片输入） */
  supportsVision?: boolean
  /** 是否支持音频输入 */
  supportsAudio?: boolean
  /** 是否支持深度思考 */
  supportsThinking?: boolean
  /** 是否支持联网搜索 */
  supportsWebSearch?: boolean
  /** 是否允许用户自定义系统提示词 */
  allowCustomSystemPrompt?: boolean
  /** 预设头像 URL（可选，为空则使用默认头像） */
  avatar?: string
  /** 是否支持画图功能 */
  supportsImageGen?: boolean
  /** 画图提示词前缀 */
  imageGenPrompt?: string
}

/** 提示词模板（聊天欢迎页快捷短语，由 /api/presets 下发） */
export interface PromptTemplate {
  /** 唯一标识 */
  id: string
  /** 模板标题（按钮上显示的短文案） */
  title: string
  /** 模板内容（点击后发送的完整提示词） */
  prompt: string
}

/** 预设列表响应（对应 GET /api/presets 的返回结构） */
export interface PresetsResponse {
  success: boolean
  data?: {
    presets: ChatPreset[]
    defaultModel: string
    /** 默认配置是否支持视觉（未选中预设时的兜底能力标记） */
    defaultSupportsVision?: boolean
    /** 默认配置是否支持音频输入 */
    defaultSupportsAudio?: boolean
    /** 默认配置是否支持深度思考 */
    defaultSupportsThinking?: boolean
    /** 默认配置是否支持联网搜索 */
    defaultSupportsWebSearch?: boolean
    /** 默认配置是否允许用户自定义系统提示词 */
    defaultAllowCustomSystemPrompt?: boolean
    /** AI 画图是否已配置（仅布尔标记，驱动画图入口显示） */
    imageGenEnabled?: boolean
    /** 提示词模板列表（聊天欢迎页快捷短语） */
    promptTemplates?: PromptTemplate[]
  }
  error?: string
}

// ---------- 主题相关类型 ----------

/** 主题模式 */
export type ThemeMode = 'light' | 'dark'

// ---------- 图片展示相关类型 ----------

/** 图片条目 */
export interface GalleryImage {
  /** 图片路径（public/images/ 下） */
  src: string
  /** 图片标题 */
  title: string
  /** 图片描述 */
  description?: string
  /** 图片分类 */
  category?: 'illustration' | 'avatar' | 'logo' | 'other'
  /** 文件名（用于管理后台定位） */
  filename?: string
}

// ---------- 404 小恐龙游戏相关类型 ----------

/** 游戏状态 */
export type GameState = 'idle' | 'playing' | 'gameover'

/** 游戏实体 */
export interface GameObject {
  x: number
  y: number
  width: number
  height: number
}
