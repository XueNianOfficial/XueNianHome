/**
 * GET /api/chat/system-prompt
 * 返回当前预设对应的完整系统提示词（调试用）
 * 查询参数：?preset=xxx
 */
import { getPresetConfig, getSystemPrompt } from '../../utils/ai'
import { buildExperimentalPromptExtension } from '../../utils/experimental-chat'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const presetName = query.preset as string | undefined

  const config = getPresetConfig(presetName)
  const systemPromptContent = config.systemPrompt || getSystemPrompt()

  // 实验模式追加表情包和格式说明
  const experimentalExtension = config.enableExperimental
    ? '\n' + buildExperimentalPromptExtension()
    : ''

  return {
    success: true,
    data: {
      systemPrompt: systemPromptContent + experimentalExtension,
      preset: presetName || '(默认)',
      model: config.model,
      enableExperimental: config.enableExperimental || false
    }
  }
})
