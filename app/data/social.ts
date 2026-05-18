/**
 * ============================================================
 *  雪年个人网站 - 社交平台链接配置
 *  在此数组中添加/修改社交平台链接
 *  每条记录包含：platform（名称）、icon（图标）、url（链接）、color（颜色）
 * ============================================================
 */

import type { SocialLink } from '../types'

/** 社交平台链接列表
 *  ⚠️ icon 字段当前由 AppFooter.vue 的 getSocialIcon() 内联 SVG 渲染，
 *     保留 icon 字段便于后续迁移到图标库（如 nuxt-icon）时直接使用
 */
export const socialLinks: SocialLink[] = [
  {
    platform: 'Bilibili',
    icon: 'i-simple-icons-bilibili',
    url: 'https://space.bilibili.com/669819482',
    color: '#00A1D6'
  },
  {
    platform: '微博',
    icon: 'i-simple-icons-sinaweibo',
    url: 'https://weibo.com/',
    color: '#E6162D'
  },
  {
    platform: 'GitHub',
    icon: 'i-simple-icons-github',
    url: 'https://github.com/XueNianOfficial',
    color: '#181717'
  },
  {
    platform: 'Twitter / X',
    icon: 'i-simple-icons-x',
    url: 'https://x.com/',
    color: '#000000'
  },
  {
    platform: 'Telegram',
    icon: 'i-simple-icons-telegram',
    url: 'https://t.me/',
    color: '#26A5E4'
  }
]
