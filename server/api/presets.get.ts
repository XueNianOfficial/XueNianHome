/**
 * ============================================================
 *  雪年个人网站 - AI 预设列表 API
 *  返回可用的预设名称（不包含敏感信息）
 *
 *  GET /api/presets
 *  响应体：{ success: boolean, data: {
 *    presets: ChatPreset[],          // 预设能力标记（绝不下发 API Key）
 *    defaultModel: string,
 *    defaultSupportsVision/Audio/Thinking/WebSearch: boolean,
 *    defaultAllowCustomSystemPrompt: boolean,
 *    imageGenEnabled: boolean,       // AI 画图是否已配置（仅布尔，不下发密钥）
 *    promptTemplates: PromptTemplate[] // 聊天欢迎页提示词模板（无敏感信息）
 *  } }
 * ============================================================
 */

import { getPresets, getDefaultConfig, getPresetConfig } from '../utils/ai'
import { getEffectiveSettings } from '../utils/settings'

export default defineEventHandler(async () => {
  const presets = getPresets()
  // 返回预设名称和功能信息（能力标记驱动前端功能开关的显示）
  // 能力标记取「预设 + 默认配置」合并后的有效值（与 getPresetConfig 继承语义一致），
  // 保证前端开关显隐与服务端 resolveChatOptions 的校验结果一致
  const presetInfos = presets.map((p) => {
    const effective = getPresetConfig(p.name)
    return {
      name: p.name,
      model: effective.model,
      supportsVision: effective.supportsVision || false,
      supportsAudio: effective.supportsAudio || false,
      supportsThinking: effective.supportsThinking || false,
      supportsWebSearch: effective.supportsWebSearch || false,
      allowCustomSystemPrompt: effective.allowCustomSystemPrompt || false,
      avatar: p.avatar || ''
    }
  })

  // 默认配置的功能信息
  const defaultCfg = getDefaultConfig()
  const settings = getEffectiveSettings()

  return {
    success: true,
    data: {
      presets: presetInfos,
      // 默认模型必须与管理后台「默认配置」一致，不能读环境变量
      defaultModel: defaultCfg.model,
      defaultSupportsVision: defaultCfg.supportsVision || false,
      defaultSupportsAudio: defaultCfg.supportsAudio || false,
      defaultSupportsThinking: defaultCfg.supportsThinking || false,
      defaultSupportsWebSearch: defaultCfg.supportsWebSearch || false,
      defaultAllowCustomSystemPrompt: defaultCfg.allowCustomSystemPrompt || false,
      // 画图入口显示与否仅依赖「是否配置了密钥」这一布尔值
      imageGenEnabled: !!settings.imageGen?.apiKey,
      promptTemplates: settings.promptTemplates || []
    }
  }
})
