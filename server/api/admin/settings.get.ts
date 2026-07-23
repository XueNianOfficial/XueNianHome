/**
 * ============================================================
 *  AI 设置查询 API - GET /api/admin/settings（需管理员登录）
 *  返回当前生效的 AI 配置，API Key 经掩码处理（只显示后 4 位）
 * ============================================================
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
      supportsThinking: settings.supportsThinking || false,
      supportsWebSearch: settings.supportsWebSearch || false,
      allowCustomSystemPrompt: settings.allowCustomSystemPrompt || false,
      // AI 画图配置（密钥同样掩码处理）
      imageGen: {
        apiKey: maskKey(settings.imageGen?.apiKey || ''),
        baseUrl: settings.imageGen?.baseUrl || '',
        model: settings.imageGen?.model || '',
        size: settings.imageGen?.size || '2K',
        watermark: settings.imageGen?.watermark ?? false
      },
      promptTemplates: settings.promptTemplates || [],
      presets: settings.presets.map(p => ({
        ...p,
        apiKey: maskKey(p.apiKey),
        supportsVision: p.supportsVision || false,
        supportsAudio: p.supportsAudio || false,
        supportsThinking: p.supportsThinking || false,
        supportsWebSearch: p.supportsWebSearch || false,
        allowCustomSystemPrompt: p.allowCustomSystemPrompt || false
      }))
    }
  }
})
