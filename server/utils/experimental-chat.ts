/**
 * ============================================================
 *  实验功能 - AI 自主管理对话和表情包发送
 *  解析 AI 回复中的 <message>、<gif> 标签和 [wait] 标记
 *  扫描表情包目录，嵌入系统提示词
 * ============================================================
 */

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ==================== 表情包目录扫描 ====================

const STICKERS_DIR = join(process.cwd(), 'public/images/stickers')

/** 表情包气泡数据结构 */
export interface StickerBubble {
  type: 'text' | 'gif'
  content: string
}

/** 实验模式回复解析结果 */
export interface ExperimentalResult {
  /** 已完成的独立气泡列表 */
  bubbles: StickerBubble[]
  /** 是否处于等待状态 */
  wait: boolean
  /** 尚未完成解析的残留文本（流式传输用） */
  remaining: string
}

/**
 * 扫描表情包目录，获取所有 .gif 文件名列表
 */
export function scanStickers(): string[] {
  try {
    if (!existsSync(STICKERS_DIR)) return []
    const files = readdirSync(STICKERS_DIR)
    return files
      .filter(f => f.toLowerCase().endsWith('.gif'))
      .map(f => f.replace(/\.gif$/i, ''))
      .sort()
  } catch {
    return []
  }
}

/**
 * 获取表情包文件名的格式列表（用于嵌入提示词）
 */
export function getStickerListForPrompt(): string {
  const stickers = scanStickers()
  if (stickers.length === 0) return ''
  return stickers.map(s => `${s}.gif`).join('、')
}

/**
 * 构建实验模式的系统提示词追加内容
 */
export function buildExperimentalPromptExtension(): string {
  const stickerList = getStickerListForPrompt()

  if (!stickerList) {
    return `\n\n【实验功能 - 消息格式说明】
你可以使用以下格式来管理对话气泡和表情包：

1. 对话气泡管理
   - 每次回复可以包含一个或多个消息气泡，每个气泡用一对 <message> 和 </message> 包裹。
   - 气泡之间紧密排列，不用额外换行或分隔符。

2. 等待状态
   - 如果感觉用户话还没说完、句子明显中断，或你选择等待对方继续输入，只需单独回复：[wait]
   - [wait] 不放在 <message> 标签内，独占一次回复。`
  }

  return `\n\n【实验功能 - 消息格式与表情包】
你可以使用以下格式来管理对话气泡和表情包：

1. 对话气泡管理
   - 每次回复可以包含一个或多个消息气泡，每个气泡用一对 <message> 和 </message> 包裹。
   - 气泡之间紧密排列，不用额外换行或分隔符。
   - 每个气泡内为你要说的纯文本或表情包内容，不能嵌套其他标签（<gif> 除外）。

2. 表情包
   - 你可以在适当情绪下发送表情包，格式为 <gif>文件名.gif</gif>，并放在独立气泡内。
   - 当前可用的表情包文件有：${stickerList}
   - 请选择能形象表达当前情绪或回应的文件名，如 <gif>害羞.gif</gif>、<gif>哈哈大笑.gif</gif> 等。

3. 等待状态
   - 如果感觉用户话还没说完、句子明显中断，或你选择等待对方继续输入，只需单独回复：[wait]
   - [wait] 不放在 <message> 标签内，独占一次回复。

4. 回复示例
  用户："我今天……"
  你：[wait]

  用户："我今天捡到一只小猫！"
  你：
  <message>哇，真的吗？它长什么样子呀？</message>
  <message><gif>期待.gif</gif></message>`
}

// ==================== 响应解析 ====================

/**
 * 从 AI 原始回复中解析实验模式的结构化气泡
 * 支持流式场景：逐步输入文本，提取已完成的气泡
 *
 * @param rawText - AI 原始回复文本（可能不完整，流式场景）
 * @returns ExperimentalResult - 已解析的气泡和残留文本
 */
export function parseExperimentalResponse(rawText: string): ExperimentalResult {
  const bubbles: StickerBubble[] = []
  let remaining = rawText

  // 1. 首先检查是否为 [wait]
  const waitTrimmed = rawText.trim()
  if (waitTrimmed === '[wait]') {
    return { bubbles: [], wait: true, remaining: '' }
  }
  // 如果文本以 [wait] 开头但后面还有其他内容，忽略 [wait]
  // （实际上是格式错误，AI 不应该在 [wait] 后跟其他内容）

  // 2. 提取完整的 <message>...</message> 对
  const messageRegex = /<message>([\s\S]*?)<\/message>/g
  let lastEnd = 0
  let match: RegExpExecArray | null

  while ((match = messageRegex.exec(rawText)) !== null) {
    const innerContent = match[1]!.trim()
    lastEnd = match.index + match[0].length

    if (!innerContent) continue // 跳过空气泡

    // 检查是否包含 <gif> 标签
    const gifMatch = innerContent.match(/^<gif>(.+?)<\/gif>$/)
    if (gifMatch) {
      const gifName = gifMatch[1]!.trim()
      // 验证文件名是否以 .gif 结尾
      const validGifName = gifName.endsWith('.gif') ? gifName : `${gifName}.gif`
      bubbles.push({ type: 'gif', content: validGifName })
    } else {
      // 纯文本气泡，去除可能的残余标签
      const cleanText = innerContent
        .replace(/<[^>]*>/g, '') // 移除任何残余标签
        .trim()
      if (cleanText) {
        bubbles.push({ type: 'text', content: cleanText })
      }
    }
  }

  // 3. 计算残留文本：最后一个完整 </message> 之后的内容
  if (lastEnd > 0) {
    remaining = rawText.slice(lastEnd)
    // 检查是否有未闭合的 <message>（流式传输中途）
    const openTagIdx = remaining.indexOf('<message>')
    if (openTagIdx !== -1) {
      // 有新的 <message> 开始但尚未闭合，保留为残留
      remaining = remaining.slice(openTagIdx)
    } else {
      // 没有新标签开始，清空残留（因为全部处理完了）
      remaining = ''
    }
  } else {
    // 没有任何完整 <message> 对
    // 检查是否有未完成的 <message> 开始
    const openTagIdx = remaining.indexOf('<message>')
    if (openTagIdx !== -1) {
      remaining = remaining.slice(openTagIdx)
    } else {
      // 可能是纯文本或 [wait] 未完整到来
      // 保留等待判断
      if (remaining.includes('[wait]') || remaining.includes('[wai') || remaining.includes('[wa') || remaining.includes('[w')) {
        // 可能是 [wait] 正在传输中，保留
      } else {
        // 其他情况，保留但不标记为气泡
      }
    }
  }

  return { bubbles, wait: false, remaining }
}

/**
 * 判断文本是否为等待标记 [wait]（用于流式完成后的最终检查）
 */
export function isWaitSignal(text: string): boolean {
  return text.trim() === '[wait]'
}

/**
 * 检查当前残留文本是否可能是 [wait] 的前缀（用于流式检测）
 */
export function isPotentialWaitPrefix(text: string): boolean {
  const trimmed = text.trim()
  return trimmed === '[' || trimmed === '[w' || trimmed === '[wa' || trimmed === '[wai' || trimmed === '[wait'
}
