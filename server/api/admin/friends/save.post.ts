/**
 * POST /api/admin/friends/save
 * 保存友链列表（需管理员登录）
 * Body: { friends: FriendLink[] }
 */
import { requireAuth } from '../../../utils/admin-auth'
import { saveFriends } from '../../../utils/friends-storage'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const body = await readBody(event)
  const { friends } = body

  if (!friends || !Array.isArray(friends)) {
    throw createError({ statusCode: 400, message: '请提供有效的友链列表' })
  }

  // 验证每条友链
  for (const f of friends) {
    if (!f.name || !f.url) {
      throw createError({ statusCode: 400, message: '每条友链需要名称和链接' })
    }
  }

  saveFriends(friends)
  return { success: true, message: '友链已保存' }
})
