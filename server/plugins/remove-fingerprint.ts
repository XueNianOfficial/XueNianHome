/**
 * ============================================================
 *  Nitro 服务端插件 — 移除框架指纹
 *  在所有响应中移除 X-Powered-By 响应头
 *  此插件在 Nitro 渲染管道最后阶段执行，确保覆盖所有响应
 * ============================================================
 */

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response) => {
    // 从响应头中删除框架标识
    if (response.headers) {
      delete response.headers['x-powered-by']
      delete response.headers['X-Powered-By']
      // 也删除可能泄露的 Nitro/Nuxt 标识
      delete response.headers['x-nitro']
      delete response.headers['x-nuxt']
    }
  })
})
