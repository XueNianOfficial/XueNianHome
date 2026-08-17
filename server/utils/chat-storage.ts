/**
 * ============================================================
 *  雪年个人网站 - 聊天记录持久化存储
 *  每个用户聊天记录保存 7 天，过期自动删除
 *  存储路径：server/data/chat/{userId}.json
 * ============================================================
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const CHAT_DIR = join(process.cwd(), 'server/data/chat')

/** 聊天记录永久保存，不自动过期（管理员手动清理） */
const MAX_AGE_MS = Infinity

/** 清理检查间隔：禁用自动清理 */
const CLEANUP_INTERVAL_MS = Infinity

// ==================== 类型定义 ====================

/** 存储的消息格式（字段与 app/types/index.ts 的 ChatMessage 对应；
 *  tokenUsage 为前端运行时统计字段，服务端不落盘） */
export interface StoredMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** 多模态内容片段（对应前端 ContentPart，text/image_url） */
  parts?: { type: string; text?: string; image_url?: { url: string; detail?: string } }[]
  timestamp: number
  edited?: boolean
}

/** 存储的会话格式（字段与 app/types/index.ts 的 ChatSession 对应） */
export interface StoredSession {
  id: string
  name: string
  messages: StoredMessage[]
  preset: string
  createdAt: number
  lastActiveAt: number
  /** 是否启用滑动窗口模式（前端 ChatSession.slidingWindow，服务端原样透传存储） */
  slidingWindow?: boolean
}

/** 单个用户的所有聊天数据 */
export interface UserChatData {
  userId: string
  sessions: StoredSession[]
  lastActiveAt: number
}

// ==================== 文件路径 ====================

/**
 * 获取用户聊天数据文件路径
 * 安全考量：userId 来自客户端（query/body），直接拼路径会被
 * "../" 路径遍历利用——此处将非 [a-zA-Z0-9_-] 字符全部替换为下划线，
 * 保证结果文件名始终落在 CHAT_DIR 内
 */
function getUserFilePath(userId: string): string {
  // 防路径遍历：替换所有非法字符（含 "."、"/"、"\"）
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(CHAT_DIR, `${safeId}.json`)
}

// ==================== 读写操作 ====================

/**
 * 加载用户聊天数据，自动清理过期内容
 * @param userId - 用户 ID（客户端生成，路径拼接前会做字符过滤）
 * @returns 聊天数据；不存在、全部过期或文件损坏时返回 null
 */
export function loadUserChat(userId: string): UserChatData | null {
  if (!userId) return null
  const filePath = getUserFilePath(userId)
  if (!existsSync(filePath)) return null

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw) as UserChatData
    const cleaned = cleanupUserData(data)

    // 如果所有会话都过期了，删除文件
    if (cleaned.sessions.length === 0) {
      try { unlinkSync(filePath) } catch { /* 忽略 */ }
      return null
    }

    // 如果清理后有变化，写回文件
    if (cleaned.sessions.length !== data.sessions.length ||
        JSON.stringify(cleaned.sessions) !== JSON.stringify(data.sessions)) {
      try {
        writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8')
      } catch { /* 忽略 */ }
    }

    return cleaned
  } catch {
    console.error(`读取用户 ${userId} 聊天数据失败`)
    return null
  }
}

/**
 * 保存用户聊天数据，自动清理过期内容
 * @param data - 完整用户聊天数据（写盘前先做过期裁剪，并刷新整体活跃时间）
 */
export function saveUserChat(data: UserChatData): void {
  if (!data.userId) return

  const dir = CHAT_DIR
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const cleaned = cleanupUserData(data)
  // 更新整体活跃时间
  cleaned.lastActiveAt = Date.now()

  const filePath = getUserFilePath(data.userId)
  try {
    writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8')
  } catch (e) {
    console.error(`保存用户 ${data.userId} 聊天数据失败：`, e)
  }
}

/**
 * 删除指定用户的指定会话
 * @returns true 表示找到并删除（会话删空后顺带删除用户文件）
 */
export function deleteUserSession(userId: string, sessionId: string): boolean {
  const data = loadUserChat(userId)
  if (!data) return false

  const idx = data.sessions.findIndex(s => s.id === sessionId)
  if (idx === -1) return false

  data.sessions.splice(idx, 1)
  data.lastActiveAt = Date.now()

  if (data.sessions.length === 0) {
    // 删除用户文件
    const filePath = getUserFilePath(userId)
    try { unlinkSync(filePath) } catch { /* 忽略 */ }
    return true
  }

  saveUserChat(data)
  return true
}

// ==================== 过期清理 ====================

/**
 * 清理用户数据中的过期消息和会话
 * 注意：已改为永久保存，此函数仅保留空会话清理逻辑
 */
function cleanupUserData(data: UserChatData): UserChatData {
  // 仅过滤掉没有消息的会话（永久保存模式下不按时间过期）
  data.sessions = data.sessions.filter(s => s.messages.length > 0)
  return data
}

/**
 * 清理所有过期用户数据（已改为永久保存，此函数禁用）
 */
export function cleanupAllExpiredChats(): void {
  // 永久保存模式：禁用自动清理，管理员手动删除
  return
}

// ==================== 定时清理 ====================

let cleanupTimer: ReturnType<typeof setInterval> | null = null

/** 启动定时清理任务（永久保存模式：已禁用） */
export function startChatCleanupTimer(): void {
  // 永久保存模式：不启动定时清理
  console.log('[聊天存储] 永久保存模式，已禁用自动清理')
}

/** 停止定时清理任务 */
export function stopChatCleanupTimer(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}

// ==================== 管理用查询 ====================

/** 概览统计信息（不含消息详情） */
export interface UserChatSummary {
  userId: string
  sessionCount: number
  messageCount: number
  lastActiveAt: number
  /** 会话名称列表 */
  sessionNames: string[]
}

/**
 * 列出所有用户聊天统计（管理后台用）
 */
export function listAllUserChats(): UserChatSummary[] {
  if (!existsSync(CHAT_DIR)) return []

  const files = readdirSync(CHAT_DIR)
  const summaries: UserChatSummary[] = []

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const filePath = join(CHAT_DIR, file)
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw) as UserChatData
      const userId = file.replace('.json', '')

      summaries.push({
        userId,
        sessionCount: data.sessions.length,
        messageCount: data.sessions.reduce((sum, s) => sum + s.messages.length, 0),
        lastActiveAt: data.lastActiveAt,
        sessionNames: data.sessions.map(s => s.name)
      })
    } catch {
      // 跳过损坏文件
    }
  }

  // 按最后活跃时间倒序
  summaries.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  return summaries
}

/**
 * 管理员删除指定用户聊天记录
 */
export function adminDeleteUserChat(userId: string): boolean {
  const filePath = getUserFilePath(userId)
  if (!existsSync(filePath)) return false
  try {
    unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 获取所有聊天文件占用的总大小（bytes）
 */
export function getChatStorageSize(): number {
  if (!existsSync(CHAT_DIR)) return 0
  const files = readdirSync(CHAT_DIR)
  let total = 0
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      total += statSync(join(CHAT_DIR, file)).size
    } catch { /* 忽略 */ }
  }
  return total
}
