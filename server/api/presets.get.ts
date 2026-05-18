/**
 * ============================================================
 *  雪年个人网站 - AI 预设列表 API
 *  返回可用的预设名称（不包含敏感信息）
 *
 *  GET /api/presets
 *  响应体：{ success: boolean, data: { presets: string[], defaultModel: string } }
 * ============================================================ */

import { getPresets, getDefaultConfig } from '../utils/ai'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const presets = getPresets()
  // 返回预设名称和功能信息
  const presetInfos = presets.map((p) => ({
    name: p.name,
    model: p.model,
    supportsVision: p.supportsVision || false,
    supportsAudio: p.supportsAudio || false
  }))

  // 默认配置的功能信息
  const defaultCfg = getDefaultConfig()

  return {
    success: true,
    data: {
      presets: presetInfos,
      defaultModel: config.aiModel || 'gpt-3.5-turbo',
      defaultSupportsVision: defaultCfg.supportsVision || false,
      defaultSupportsAudio: defaultCfg.supportsAudio || false
    }
  }
})
