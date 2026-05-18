/**
 * ============================================================
 *  友链数据持久化存储
 *  读写 server/data/friends.json
 * ============================================================
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const FRIENDS_FILE = join(process.cwd(), 'server/data/friends.json')

export interface FriendEntry {
  name: string
  avatar: string
  description: string
  url: string
}

/** 从 JSON 文件加载友链列表 */
export function loadFriends(): FriendEntry[] {
  try {
    if (!existsSync(FRIENDS_FILE)) return []
    const raw = readFileSync(FRIENDS_FILE, 'utf-8')
    return JSON.parse(raw) as FriendEntry[]
  } catch {
    console.error('读取友链数据文件失败')
    return []
  }
}

/** 保存友链列表到 JSON 文件 */
export function saveFriends(friends: FriendEntry[]): void {
  try {
    const dir = join(process.cwd(), 'server/data')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(FRIENDS_FILE, JSON.stringify(friends, null, 2), 'utf-8')
  } catch (e) {
    console.error('保存友链数据文件失败：', e)
    throw createError({ statusCode: 500, message: '保存友链失败' })
  }
}
