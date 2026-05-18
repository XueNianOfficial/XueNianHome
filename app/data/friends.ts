/**
 * ============================================================
 *  雪年个人网站 - 友链数据配置
 *  在此数组中添加/修改好友链接信息
 *  每条记录包含：name（名称）、avatar（头像）、description（描述）、url（链接）
 * ============================================================
 */

import type { FriendLink } from '../types'

/** 友链列表 */
export const friendLinks: FriendLink[] = [
  {
    name: '示例好友',
    avatar: '/images/头像.png',
    description: '这是一个友链示例，你可以替换为自己的好友信息。',
    url: 'https://example.com'
  }
  // 添加更多好友：
  // {
  //   name: '好友名称',
  //   avatar: '/images/xxx.png 或 https://...',
  //   description: '简短描述',
  //   url: 'https://friend-website.com'
  // },
]
