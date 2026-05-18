/**
 * ============================================================
 *  管理后台多账号系统
 *  - 账号存储于 server/data/admin-accounts.json
 *  - 密码使用 scrypt 哈希，永不明文存储
 *  - 支持创建、删除、列表账号
 * ============================================================
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { join } from 'node:path'

const ACCOUNTS_FILE = join(process.cwd(), 'server/data/admin-accounts.json')

/** 账号记录结构 */
export interface AdminAccount {
  username: string
  passwordHash: string        // 格式: "scrypt:<salt_hex>:<hash_hex>"
  displayName: string
  createdAt: string
}

/** 账号文件结构 */
interface AccountsData {
  accounts: AdminAccount[]
}

/**
 * 读取账号文件
 */
export function loadAccounts(): AdminAccount[] {
  try {
    if (!existsSync(ACCOUNTS_FILE)) {
      // 初始化默认账号文件
      const defaultData: AccountsData = {
        accounts: []
      }
      mkdirSync(join(process.cwd(), 'server/data'), { recursive: true })
      writeFileSync(ACCOUNTS_FILE, JSON.stringify(defaultData, null, 2), 'utf-8')
      return []
    }
    const raw = readFileSync(ACCOUNTS_FILE, 'utf-8')
    const data = JSON.parse(raw) as AccountsData
    return data.accounts || []
  } catch (err) {
    console.error('[AdminAccounts] 读取账号文件失败:', err)
    return []
  }
}

/**
 * 保存账号文件
 */
export function saveAccounts(accounts: AdminAccount[]): void {
  try {
    mkdirSync(join(process.cwd(), 'server/data'), { recursive: true })
    const data: AccountsData = { accounts }
    writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error('[AdminAccounts] 保存账号文件失败:', err)
  }
}

/**
 * 使用 scrypt 哈希密码
 * 返回格式: "scrypt:<salt_hex>:<hash_hex>"
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(32)
  const hash = scryptSync(password, salt, 64)
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`
}

/**
 * 验证密码是否匹配
 */
export function verifyPasswordHash(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':')
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      // 兼容旧的明文密码（从 runtimeConfig 迁移时）
      return password === storedHash
    }
    const salt = Buffer.from(parts[1], 'hex')
    const expectedHash = Buffer.from(parts[2], 'hex')
    const actualHash = scryptSync(password, salt, 64)
    return timingSafeEqual(actualHash, expectedHash)
  } catch {
    return false
  }
}

/**
 * 验证凭据：返回匹配的账号或 null
 */
export function authenticateUser(username: string, password: string): AdminAccount | null {
  const accounts = loadAccounts()
  const account = accounts.find(a => a.username === username)
  if (!account) return null

  if (verifyPasswordHash(password, account.passwordHash)) {
    return account
  }
  return null
}

/**
 * 查找账号
 */
export function findAccount(username: string): AdminAccount | undefined {
  const accounts = loadAccounts()
  return accounts.find(a => a.username === username)
}

/**
 * 创建新账号（密码已哈希存储）
 */
export function createAccount(username: string, password: string, displayName?: string): { success: boolean; error?: string } {
  // 验证用户名格式
  if (!username || !/^[a-zA-Z0-9_\u4e00-\u9fff]{2,32}$/.test(username)) {
    return { success: false, error: '用户名需为 2-32 个字符（字母、数字、下划线、中文）' }
  }

  // 验证密码强度
  if (!password || password.length < 6) {
    return { success: false, error: '密码至少需要 6 个字符' }
  }

  const accounts = loadAccounts()

  // 检查是否已存在
  if (accounts.some(a => a.username === username)) {
    return { success: false, error: `账号 "${username}" 已存在` }
  }

  const newAccount: AdminAccount = {
    username,
    passwordHash: hashPassword(password),
    displayName: displayName || username,
    createdAt: new Date().toISOString()
  }

  accounts.push(newAccount)
  saveAccounts(accounts)
  return { success: true }
}

/**
 * 删除账号（至少保留一个）
 */
export function deleteAccount(username: string): { success: boolean; error?: string } {
  const accounts = loadAccounts()

  if (accounts.length <= 1) {
    return { success: false, error: '至少需要保留一个管理员账号' }
  }

  const index = accounts.findIndex(a => a.username === username)
  if (index === -1) {
    return { success: false, error: '账号不存在' }
  }

  accounts.splice(index, 1)
  saveAccounts(accounts)
  return { success: true }
}

/**
 * 修改密码
 */
export function changePassword(username: string, oldPassword: string, newPassword: string): { success: boolean; error?: string } {
  const account = authenticateUser(username, oldPassword)
  if (!account) {
    return { success: false, error: '原密码错误' }
  }

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: '新密码至少需要 6 个字符' }
  }

  const accounts = loadAccounts()
  const target = accounts.find(a => a.username === username)!
  target.passwordHash = hashPassword(newPassword)
  saveAccounts(accounts)
  return { success: true }
}

/**
 * 获取账号列表（不含密码哈希）
 */
export function listAccounts(): Omit<AdminAccount, 'passwordHash'>[] {
  const accounts = loadAccounts()
  return accounts.map(({ passwordHash, ...rest }) => rest)
}

/**
 * 初始化：如果没有账号，则从旧的环境变量迁移创建一个默认账号
 */
export function ensureDefaultAccount(): void {
  const accounts = loadAccounts()
  if (accounts.length > 0) return

  // 从 runtimeConfig 读取旧密码进行迁移
  const config = useRuntimeConfig()
  const legacyPassword = config.adminPassword as string

  if (legacyPassword && legacyPassword !== 'admin123') {
    // 有自定义密码：迁移
    createAccount('admin', legacyPassword, '管理员')
    console.log('[AdminAccounts] 已从环境变量迁移默认管理员账号')
  } else {
    // 默认密码：仅开发环境自动创建
    if (process.env.NODE_ENV !== 'production') {
      createAccount('admin', 'admin123', '管理员')
      console.log('[AdminAccounts] 已创建默认管理员账号 (admin/admin123)，请尽快修改密码！')
    } else {
      console.warn('[AdminAccounts] ⚠️ 无管理员账号！请运行 npm run admin:add 创建账号')
    }
  }
}
