#!/usr/bin/env node
/**
 * ============================================================
 *  管理后台账号管理 CLI
 *
 *  用法：
 *    npm run admin:add     — 交互式创建管理员账号
 *    npm run admin:list    — 列出所有管理员账号
 *    npm run admin:delete  — 删除管理员账号
 *    npm run admin:passwd  — 修改管理员密码
 * ============================================================
 *
 * 此脚本通过 Nitro 的 devProxy 或直接操作 JSON 文件来管理账号。
 * 由于 Nuxt 项目的 nitro 自动导入不可用于纯 Node 脚本，
 * 此脚本直接操作 server/data/admin-accounts.json 文件。
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { createInterface } from 'node:readline'

const ACCOUNTS_FILE = join(process.cwd(), 'server/data/admin-accounts.json')

// ====================================================================
//  工具函数（与 admin-accounts.ts 保持同步）
// ====================================================================

function loadAccounts() {
  try {
    if (!existsSync(ACCOUNTS_FILE)) return []
    const raw = readFileSync(ACCOUNTS_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return data.accounts || []
  } catch {
    console.error('❌ 读取账号文件失败')
    process.exit(1)
  }
}

function saveAccounts(accounts) {
  mkdirSync(join(process.cwd(), 'server/data'), { recursive: true })
  writeFileSync(ACCOUNTS_FILE, JSON.stringify({ accounts }, null, 2), 'utf-8')
}

function hashPassword(password) {
  const salt = randomBytes(32)
  const hash = scryptSync(password, salt, 64)
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`
}

// ====================================================================
//  交互式输入
// ====================================================================

function ask(question, hidden = false) {
  return new Promise(resolve => {
    if (hidden) {
      // ============================================================
      //  密码隐藏输入：使用 stdin raw 模式逐字符读取
      //  注意：不能同时使用 readline，否则会冲突
      // ============================================================
      const stdin = process.stdin
      const stdout = process.stdout

      if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
        // 降级：非 TTY 环境直接明文输入
        const rl = createInterface({ input: stdin, output: stdout })
        rl.question(question, (answer) => {
          rl.close()
          resolve(answer.trim())
        })
        return
      }

      stdout.write(question)
      let input = ''
      const wasRaw = stdin.isRaw

      stdin.setRawMode(true)
      stdin.resume()

      function onData(chunk) {
        // 逐字节处理（原始模式下 chunk 通常是单字符 Buffer）
        const str = chunk.toString('utf-8')

        for (const char of str) {
          const code = char.charCodeAt(0)

          // Enter (CR/LF)
          if (code === 13 || code === 10) {
            cleanup()
            stdout.write('\n')
            resolve(input)
            return
          }
          // Backspace / Delete
          else if (code === 127 || code === 8) {
            if (input.length > 0) {
              input = input.slice(0, -1)
              // 擦除屏幕上最后一个 * 号
              stdout.write('\b \b')
            }
          }
          // Ctrl+C
          else if (code === 3) {
            cleanup()
            stdout.write('\n已取消\n')
            process.exit(0)
          }
          // 可打印字符
          else if (code >= 32) {
            input += char
            stdout.write('*')
          }
        }
      }

      function cleanup() {
        stdin.removeListener('data', onData)
        stdin.setRawMode(wasRaw || false)
        stdin.pause()
      }

      stdin.on('data', onData)
    } else {
      // 普通明文输入
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      rl.question(question, (answer) => {
        rl.close()
        resolve(answer.trim())
      })
    }
  })
}

// ====================================================================
//  命令实现
// ====================================================================

async function cmdAdd() {
  console.log('\n📝 创建新管理员账号\n')

  const username = await ask('用户名 (字母/数字/下划线/中文, 2-32字符): ')
  if (!username || !/^[a-zA-Z0-9_\u4e00-\u9fff]{2,32}$/.test(username)) {
    console.log('❌ 用户名格式无效')
    process.exit(1)
  }

  const accounts = loadAccounts()
  if (accounts.some(a => a.username === username)) {
    console.log(`❌ 账号 "${username}" 已存在`)
    process.exit(1)
  }

  const displayName = await ask('显示名称 (可选，回车使用用户名): ') || username

  let password
  while (true) {
    password = await ask('密码 (至少6个字符): ', true)
    if (!password || password.length < 6) {
      console.log('密码至少需要 6 个字符，请重新输入')
      continue
    }
    const confirm = await ask('确认密码: ', true)
    if (password !== confirm) {
      console.log('两次密码不一致，请重新输入')
      continue
    }
    break
  }

  accounts.push({
    username,
    passwordHash: hashPassword(password),
    displayName,
    createdAt: new Date().toISOString()
  })
  saveAccounts(accounts)
  console.log(`\n✅ 账号 "${username}" 创建成功！`)
}

async function cmdList() {
  const accounts = loadAccounts()
  if (accounts.length === 0) {
    console.log('\n📋 暂无管理员账号\n')
    return
  }

  console.log('\n📋 管理员账号列表:\n')
  console.log('  用户名         显示名称         创建时间')
  console.log('  ' + '─'.repeat(55))
  for (const acc of accounts) {
    const name = acc.username.padEnd(16)
    const display = (acc.displayName || '').padEnd(16)
    const date = acc.createdAt?.split('T')[0] || '—'
    console.log(`  ${name}${display}${date}`)
  }
  console.log(`\n  共 ${accounts.length} 个账号\n`)
}

async function cmdDelete() {
  const accounts = loadAccounts()
  if (accounts.length <= 1) {
    console.log('❌ 至少需要保留一个管理员账号')
    process.exit(1)
  }

  console.log('\n🗑️  删除管理员账号\n')
  for (let i = 0; i < accounts.length; i++) {
    console.log(`  [${i + 1}] ${accounts[i].username} — ${accounts[i].displayName}`)
  }

  const choice = await ask(`\n选择要删除的账号 (1-${accounts.length}): `)
  const index = parseInt(choice) - 1
  if (isNaN(index) || index < 0 || index >= accounts.length) {
    console.log('❌ 无效选择')
    process.exit(1)
  }

  const target = accounts[index]
  const confirm = await ask(`确认删除 "${target.username}"？输入 yes 确认: `)
  if (confirm.toLowerCase() !== 'yes') {
    console.log('已取消')
    process.exit(0)
  }

  accounts.splice(index, 1)
  saveAccounts(accounts)
  console.log(`✅ 账号 "${target.username}" 已删除`)
}

async function cmdPasswd() {
  const accounts = loadAccounts()
  if (accounts.length === 0) {
    console.log('❌ 暂无管理员账号，请先创建')
    process.exit(1)
  }

  console.log('\n🔒 修改管理员密码\n')
  for (let i = 0; i < accounts.length; i++) {
    console.log(`  [${i + 1}] ${accounts[i].username}`)
  }

  const choice = await ask(`\n选择账号 (1-${accounts.length}): `)
  const index = parseInt(choice) - 1
  if (isNaN(index) || index < 0 || index >= accounts.length) {
    console.log('❌ 无效选择')
    process.exit(1)
  }

  let password
  while (true) {
    password = await ask('新密码 (至少6个字符): ', true)
    if (!password || password.length < 6) {
      console.log('密码至少需要 6 个字符，请重新输入')
      continue
    }
    const confirm = await ask('确认新密码: ', true)
    if (password !== confirm) {
      console.log('两次密码不一致，请重新输入')
      continue
    }
    break
  }

  accounts[index].passwordHash = hashPassword(password)
  saveAccounts(accounts)
  console.log(`✅ 账号 "${accounts[index].username}" 密码已更新`)
}

// ====================================================================
//  入口
// ====================================================================

const command = process.argv[2] || 'help'

async function main() {
  switch (command) {
    case 'add':
      await cmdAdd()
      break
    case 'list':
      await cmdList()
      break
    case 'delete':
    case 'del':
      await cmdDelete()
      break
    case 'passwd':
    case 'password':
      await cmdPasswd()
      break
    case 'help':
    default:
      console.log(`
🔐 管理后台账号管理工具

用法:
  node scripts/admin-accounts.mjs <命令>

命令:
  add       创建新管理员账号（交互式）
  list      列出所有管理员账号
  delete    删除管理员账号（交互式）
  passwd    修改管理员密码（交互式）
  help      显示此帮助

示例:
  node scripts/admin-accounts.mjs add
  node scripts/admin-accounts.mjs list
`)
      break
  }
}

main().catch(err => {
  console.error('❌ 运行出错:', err.message)
  process.exit(1)
})
