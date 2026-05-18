/**
 * ============================================================
 *  雪年个人网站 - 博客列表 API
 *  GET /api/blog/list
 *  返回所有博客文章的元数据列表（按日期倒序，不含正文）
 *
 *  注意：getAllBlogPosts 从 server/utils/markdown.ts 自动导入
 * ============================================================ */

export default defineEventHandler(async () => {
  const posts = await getAllBlogPosts()

  return {
    success: true,
    data: posts
  }
})
