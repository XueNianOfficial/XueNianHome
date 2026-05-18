/**
 * POST /api/admin/settings
 * 保存 AI 设置（即时生效）
 * 设置保存到 server/data/ai-settings.json
 */
import { requireAuth } from '../../utils/admin-auth'
import { saveSettings, loadSettings } from '../../utils/settings'
import type { AISettings } from '../../utils/settings'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const body = await readBody(event)
  const { apiKey, baseUrl, model, systemPrompt, supportsVision, supportsAudio, presets } = body

  // 如果 apiKey 是掩码值（以 **** 开头），保留原值
  const existing = loadSettings()
  let finalApiKey = apiKey
  if (apiKey && apiKey.startsWith('****') && existing) {
    finalApiKey = existing.apiKey
  }

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
    presets: finalPresets
  }

  await saveSettings(settings)

  return { success: true, message: '设置已保存并即时生效' }
})