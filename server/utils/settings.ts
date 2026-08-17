/**
 * ============================================================
 *  运行时设置存储
 *  将 AI 设置持久化到 JSON 文件，支持热更新
 *  优先级：文件设置 > 环境变量
 * ============================================================
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SETTINGS_FILE = join(process.cwd(), 'server/data/ai-settings.json')

/** AI 设置结构 */
export interface AISettings {
  /** 默认 API Key */
  apiKey: string
  /** 默认 API Base URL */
  baseUrl: string
  /** 默认模型 */
  model: string
  /** 默认 system prompt（自定义覆盖） */
  systemPrompt?: string
  /** 默认是否支持视觉（图片输入） */
  supportsVision?: boolean
  /** 默认是否支持音频输入 */
  supportsAudio?: boolean
  /** 默认是否支持深度思考（方舟 thinking 参数） */
  supportsThinking?: boolean
  /** 默认是否支持联网搜索（方舟 Responses API web_search 工具） */
  supportsWebSearch?: boolean
  /** 默认是否允许用户自定义系统提示词 */
  allowCustomSystemPrompt?: boolean
  /** AI 画图配置（未配置 apiKey 时前端隐藏画图入口） */
  imageGen?: AIImageGenSettings
  /** 提示词模板列表（聊天页快捷短语） */
  promptTemplates?: PromptTemplate[]
  /** 预设列表 */
  presets: AISettingsPreset[]
}

/**
 * AI 画图配置（图像生成服务，独立于聊天预设）
 * 面向火山方舟 images/generations 接口（OpenAI 兼容形态）
 */
export interface AIImageGenSettings {
  /** 图像生成 API Key */
  apiKey?: string
  /** 图像生成 API Base URL（默认火山方舟北京节点） */
  baseUrl?: string
  /** 图像生成模型完整 ID（如 doubao-seedream-5-0-lite-260128；日期后缀随版本滚动，以控制台模型列表为准） */
  model?: string
  /** 图片尺寸：档位 "2K"/"3K"/"4K" 或像素 "宽x高"（如 2048x2048）；5.0-lite 不支持 1K */
  size?: string
  /** 是否在图片右下角加「AI 生成」水印（默认不加） */
  watermark?: boolean
}

/** 提示词模板（聊天欢迎页快捷短语，管理后台维护） */
export interface PromptTemplate {
  /** 唯一标识（仅字母数字短横线，由服务端生成/过滤） */
  id: string
  /** 模板标题（按钮上显示的短文案） */
  title: string
  /** 模板内容（点击后填入/发送的完整提示词） */
  prompt: string
}

/** AI 预设配置（多套独立的 API 凭据与模型） */
export interface AISettingsPreset {
  name: string
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt?: string
  /** 是否支持视觉（图片输入） */
  supportsVision?: boolean
  /** 是否支持音频输入 */
  supportsAudio?: boolean
  /** 是否支持深度思考（请求体注入 thinking: {type:'enabled'}，解析 reasoning_content） */
  supportsThinking?: boolean
  /** 是否支持联网搜索（需方舟控制台开通「联网内容插件」，走 Responses API） */
  supportsWebSearch?: boolean
  /** 是否允许用户为该预设自定义系统提示词（服务端二次校验，防注入） */
  allowCustomSystemPrompt?: boolean
  /** 预设头像 URL（可选，为空则使用默认头像） */
  avatar?: string
  /** 是否支持画图功能（开启后该预设可以使用画图模式） */
  supportsImageGen?: boolean
  /** 自定义画图提示词（在用户提示词前添加的前缀，用于引导画图风格） */
  imageGenPrompt?: string
}

/**
 * 读取设置文件，如不存在返回 null
 */
export function loadSettings(): AISettings | null {
  try {
    if (!existsSync(SETTINGS_FILE)) return null
    const raw = readFileSync(SETTINGS_FILE, 'utf-8')
    return JSON.parse(raw) as AISettings
  } catch {
    console.error('读取 AI 设置文件失败')
    return null
  }
}

/**
 * 保存设置到文件
 */
export function saveSettings(settings: AISettings): void {
  try {
    const dir = join(process.cwd(), 'server/data')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (e) {
    console.error('保存 AI 设置文件失败：', e)
    throw createError({ statusCode: 500, message: '保存设置失败' })
  }
}

/**
 * 获取当前生效的完整 AI 设置
 * 优先使用文件设置，回退到 runtimeConfig
 */
export function getEffectiveSettings(): AISettings {
  const fileSettings = loadSettings()
  const config = useRuntimeConfig()

  return {
    apiKey: fileSettings?.apiKey || (config.aiApiKey as string) || '',
    baseUrl: fileSettings?.baseUrl || (config.aiApiBaseUrl as string) || 'https://api.openai.com/v1',
    model: fileSettings?.model || (config.aiModel as string) || 'gpt-3.5-turbo',
    systemPrompt: fileSettings?.systemPrompt || undefined,
    supportsVision: fileSettings?.supportsVision || false,
    supportsAudio: fileSettings?.supportsAudio || false,
    supportsThinking: fileSettings?.supportsThinking || false,
    supportsWebSearch: fileSettings?.supportsWebSearch || false,
    allowCustomSystemPrompt: fileSettings?.allowCustomSystemPrompt || false,
    // AI 画图：逐字段回退到环境变量；apiKey 为空即视为未启用
    imageGen: {
      apiKey: fileSettings?.imageGen?.apiKey || (config.imageApiKey as string) || '',
      baseUrl: fileSettings?.imageGen?.baseUrl || (config.imageApiBaseUrl as string) || 'https://ark.cn-beijing.volces.com/api/v3',
      model: fileSettings?.imageGen?.model || (config.imageModel as string) || 'doubao-seedream-5-0-lite-260128',
      size: fileSettings?.imageGen?.size || '2K',
      watermark: fileSettings?.imageGen?.watermark ?? false
    },
    promptTemplates: fileSettings?.promptTemplates || [],
    presets: fileSettings?.presets || parseEnvPresets()
  }
}

/**
 * 从环境变量解析预设（NUXT_AI_PRESETS JSON 数组）
 * 安全考量：预设内含 API Key 等敏感凭据，解析结果仅限服务端使用，
 * 公开接口（/api/presets）只能下发名称与能力标记
 * @returns 字段齐全（name/apiKey/baseUrl/model 均非空）的预设列表
 */
function parseEnvPresets(): AISettingsPreset[] {
  const config = useRuntimeConfig()
  const presetsJson = config.aiPresets as string
  if (!presetsJson) return []
  try {
    const presets = JSON.parse(presetsJson)
    if (Array.isArray(presets)) {
      return presets.filter((p: any) => p.name && p.apiKey && p.baseUrl && p.model)
    }
  } catch { /* 忽略 */ }
  return []
}
