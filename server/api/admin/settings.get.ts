/**
 * GET /api/admin/settings
 * 获取当前 AI 设置（不含敏感信息掩码）
 */
import { requireAuth } from '../../utils/admin-auth'
import { getEffectiveSettings, loadSettings } from '../../utils/settings'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const settings = getEffectiveSettings()
  const fileExists = loadSettings() !== null

  // 掩码处理 API Key（只显示后4位）
  const maskKey = (key: string) => {
    if (!key || key.length <= 4) return key ? '****' : ''
    return '****' + key.slice(-4)
  }

  return {
    success: true,
    data: {
      source: fileExists ? 'file' : 'env',
      apiKey: maskKey(settings.apiKey),
      baseUrl: settings.baseUrl,
      model: settings.model,
      systemPrompt: settings.systemPrompt || '',
      supportsVision: settings.supportsVision || false,
      supportsAudio: settings.supportsAudio || false,
      enableExperimental: settings.enableExperimental || false,
      presets: settings.presets.map(p => ({
        ...p,
        apiKey: maskKey(p.apiKey),
        supportsVision: p.supportsVision || false,
        supportsAudio: p.supportsAudio || false
      }))
    }
  }
})
