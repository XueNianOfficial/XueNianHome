/**
 * ============================================================
 *  雪年个人网站 - 博客详情 API
 *  GET /api/blog/[slug]
 *  返回指定 slug 的博客文章完整内容（含 HTML）
 *
 *  注意：getBlogPost 从 server/utils/markdown.ts 自动导入
 * ============================================================ */

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: '缺少文章 slug 参数'
    })
  }

  const post = await getBlogPost(slug)

  if (!post) {
    throw createError({
      statusCode: 404,
      message: '文章未找到'
    })
  }

  // 安全：禁止通过 API 访问草稿文章
  if (post.draft) {
    throw createError({
      statusCode: 404,
      message: '文章未找到'
    })
  }

  // 移除内部字段（仅暴露公开信息）
  const { draft: _, ...safePost } = post

  return {
    success: true,
    data: safePost
  }
})
