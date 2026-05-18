/**
 * ============================================================
 *  IPX 安全中间件 — 阻止 SSRF 攻击
 *  拦截 _ipx 路径中对远程 URL (http/https) 的代理请求
 *  仅允许代理本地/public 资源
 * ============================================================
 */

export default defineEventHandler((event) => {
  const url = event.path

  // 仅处理 _ipx 路径
  if (!url.startsWith('/_ipx')) return

  // 检测远程 URL 代理模式
  // IPX 格式: /_ipx/{modifiers}/{source}
  // 远程 URL: /_ipx/_/http://... 或 /_ipx/_/https://...
  const remotePattern = /\/_ipx\/[^/]*\/https?:\/\//i
  if (remotePattern.test(url)) {
    throw createError({
      statusCode: 403,
      message: '禁止代理远程 URL'
    })
  }
})
