/**
 * ============================================================
 *  POST /api/admin/settings
 *  保存 AI 设置（即时生效，写入 server/data/ai-settings.json）
 *  安全：requireAuth 鉴权 + csrfProtection 校验；
 *        掩码的 API Key（**** 开头）保留原值，避免回显覆盖
 * ============================================================
 */
import { requireAuth } from '../../utils/admin-auth'
import { saveSettings, loadSettings } from '../../utils/settings'
import type { AISettings } from '../../utils/settings'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  csrfProtection(event)

  const body = await readBody(event)
  const {
    apiKey, baseUrl, model, systemPrompt,
    supportsVision, supportsAudio,
    supportsThinking, supportsWebSearch, allowCustomSystemPrompt,
    imageGen, promptTemplates, presets
  } = body

  // 如果 apiKey 是掩码值（以 **** 开头），保留原值
  const existing = loadSettings()
  let finalApiKey = apiKey
  if (apiKey && apiKey.startsWith('****') && existing) {
    finalApiKey = existing.apiKey
  }

  // AI 画图配置：掩码 key 还原为原值；其余字段直接覆盖
  let finalImageGen: AISettings['imageGen'] = undefined
  if (imageGen && typeof imageGen === 'object') {
    let imageKey = typeof imageGen.apiKey === 'string' ? imageGen.apiKey : ''
    if (imageKey && imageKey.startsWith('****') && existing?.imageGen) {
      imageKey = existing.imageGen.apiKey
    }
    finalImageGen = {
      apiKey: imageKey,
      baseUrl: typeof imageGen.baseUrl === 'string' && imageGen.baseUrl.trim()
        ? imageGen.baseUrl.trim()
        : 'https://ark.cn-beijing.volces.com/api/v3',
      model: typeof imageGen.model === 'string' && imageGen.model.trim()
        ? imageGen.model.trim()
        : 'doubao-seedream-5-0-lite-260128',
      size: typeof imageGen.size === 'string' && imageGen.size.trim() ? imageGen.size.trim() : '2K',
      watermark: imageGen.watermark === true
    }
  }

  // 提示词模板服务端清洗：限 50 条；id 过滤非法字符；
  // title 截 50 字、prompt 截 2000 字；三项齐全才保留
  const finalPromptTemplates = (Array.isArray(promptTemplates) ? promptTemplates : [])
    .slice(0, 50)
    .map((t: any, i: number) => {
      if (!t || typeof t !== 'object') return null
      const title = typeof t.title === 'string' ? t.title.trim().slice(0, 50) : ''
      const prompt = typeof t.prompt === 'string' ? t.prompt.trim().slice(0, 2000) : ''
      if (!title || !prompt) return null
      let id = typeof t.id === 'string' ? t.id.replace(/[^a-zA-Z0-9-_]/g, '') : ''
      if (!id) id = `tpl_${Date.now()}_${i}`
      return { id, title, prompt }
    })
    .filter((t: any) => t !== null)

  // 处理预设中的掩码 key
  const finalPresets = (presets || []).map((p: any, i: number) => {
    let presetKey = p.apiKey
    if (p.apiKey && p.apiKey.startsWith('****') && existing?.presets?.[i]) {
      presetKey = existing.presets[i].apiKey
    }
    return { ...p, apiKey: presetKey }
  })

  const settings: AISettings = {
    apiKey: finalApiKey || '',
    baseUrl: baseUrl || 'https://api.openai.com/v1',
    model: model || 'gpt-3.5-turbo',
    systemPrompt: systemPrompt || undefined,
    supportsVision: supportsVision || false,
    supportsAudio: supportsAudio || false,
    supportsThinking: supportsThinking || false,
    supportsWebSearch: supportsWebSearch || false,
    allowCustomSystemPrompt: allowCustomSystemPrompt || false,
    imageGen: finalImageGen,
    promptTemplates: finalPromptTemplates,
    presets: finalPresets
  }

  await saveSettings(settings)

  return { success: true, message: '设置已保存并即时生效' }
})