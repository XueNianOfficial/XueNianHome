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
  /** 预设列表 */
  presets: AISettingsPreset[]
}

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
  /** 预设头像 URL（可选，为空则使用默认头像） */
  avatar?: string
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
    presets: fileSettings?.presets || parseEnvPresets()
  }
}

/**
 * 从环境变量解析预设
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
