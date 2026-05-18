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

/** 7 天（毫秒） */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** 清理检查间隔：每 10 分钟（毫秒） */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000

// ==================== 类型定义 ====================

/** 存储的消息格式（与前端 ChatMessage 对应） */
export interface StoredMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parts?: { type: string; image_url?: { url: string; detail?: string } }[]
  timestamp: number
  edited?: boolean
}

/** 存储的会话格式 */
export interface StoredSession {
  id: string
  name: string
  messages: StoredMessage[]
  preset: string
  createdAt: number
  lastActiveAt: number
}

/** 单个用户的所有聊天数据 */
export interface UserChatData {
  userId: string
  sessions: StoredSession[]
  lastActiveAt: number
}

// ==================== 文件路径 ====================

function getUserFilePath(userId: string): string {
  // 防止路径遍历攻击
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(CHAT_DIR, `${safeId}.json`)
}

// ==================== 读写操作 ====================

/**
 * 加载用户聊天数据，自动清理过期内容
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
 */
function cleanupUserData(data: UserChatData): UserChatData {
  const now = Date.now()
  const cutoff = now - MAX_AGE_MS

  // 过滤过期会话
  data.sessions = data.sessions.filter(s => s.lastActiveAt > cutoff)

  // 过滤每个会话中的过期消息
  for (const session of data.sessions) {
    session.messages = session.messages.filter(m => m.timestamp > cutoff)
  }

  // 再次过滤掉没有消息的会话
  data.sessions = data.sessions.filter(s => s.messages.length > 0)

  return data
}

/**
 * 清理所有过期用户数据（定期调用）
 */
export function cleanupAllExpiredChats(): void {
  if (!existsSync(CHAT_DIR)) return

  const files = readdirSync(CHAT_DIR)
  const now = Date.now()
  const cutoff = now - MAX_AGE_MS
  let cleanedCount = 0

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const filePath = join(CHAT_DIR, file)

    try {
      // 先检查文件修改时间（快速判断）
      const stat = statSync(filePath)
      if (stat.mtimeMs < cutoff) {
        unlinkSync(filePath)
        cleanedCount++
        continue
      }

      // 加载并清理内容
      const raw = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw) as UserChatData
      const cleaned = cleanupUserData(data)

      if (cleaned.sessions.length === 0) {
        unlinkSync(filePath)
        cleanedCount++
      } else if (JSON.stringify(cleaned.sessions) !== JSON.stringify(data.sessions)) {
        writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8')
      }
    } catch {
      // 删除损坏的文件
      try { unlinkSync(filePath) } catch { /* 忽略 */ }
      cleanedCount++
    }
  }

  if (cleanedCount > 0) {
    console.log(`[聊天存储] 清理了 ${cleanedCount} 个过期聊天记录`)
  }
}

// ==================== 定时清理 ====================

let cleanupTimer: ReturnType<typeof setInterval> | null = null

/** 启动定时清理任务 */
export function startChatCleanupTimer(): void {
  if (cleanupTimer) return
  // 启动后 1 分钟执行首次清理，之后每 10 分钟执行一次
  setTimeout(() => {
    cleanupAllExpiredChats()
    cleanupTimer = setInterval(cleanupAllExpiredChats, CLEANUP_INTERVAL_MS)
  }, 60_000)
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
