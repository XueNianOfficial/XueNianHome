// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  /* ============================================================
   *  DevTools：仅开发环境启用，生产环境严格关闭
   *  生产部署时必须设置 NODE_ENV=production
   * ============================================================ */
  devtools: {
    enabled: process.env.NODE_ENV !== 'production'
  },

  /* ============================================================
   *  全局 CSS：必须通过 css 配置显式引入，确保 SSR 内联
   *  仅在 app.vue 中 import 可能在生产构建时被 tree-shake 掉
   * ============================================================ */
  css: ['~/assets/css/main.css'],

  /* ============================================================
   *  应用全局配置
   * ============================================================ */
  app: {
    // 页面过渡动画
    pageTransition: {
      name: 'page',
      mode: 'out-in'
    },
    // 安全相关 HTML meta（兜底，nginx 为主要配置点）
    head: {
      meta: [
        { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' },
        { 'http-equiv': 'X-Frame-Options', content: 'DENY' },
        { 'http-equiv': 'Referrer-Policy', content: 'strict-origin-when-cross-origin' }
      ]
    }
  },

  /* ============================================================
   *  运行时配置（环境变量映射）
   *  服务端通过 useRuntimeConfig() 访问
   *  环境变量名：NUXT_AI_API_KEY, NUXT_AI_API_BASE_URL, NUXT_AI_MODEL
   *  预设通过 NUXT_AI_PRESETS JSON 字符串配置
   * ============================================================ */
  runtimeConfig: {
    // AI 默认配置（仅服务端可访问）
    aiApiKey: '',
    aiApiBaseUrl: 'https://api.openai.com/v1',
    aiModel: 'gpt-3.5-turbo',

    // AI 聊天预设（JSON 数组字符串，仅服务端）
    // 格式: '[{"name":"OpenAI","apiKey":"sk-...","baseUrl":"https://api.openai.com/v1","model":"gpt-4"},...]'
    aiPresets: '',

    // 管理后台密码（仅服务端，环境变量 NUXT_ADMIN_PASSWORD）
    adminPassword: 'admin123',

    // 公开配置（可暴露给客户端）
    public: {
      // 预设名称列表（不包含敏感信息）
      aiPresetNames: ''
    }
  },

  /* ============================================================
   *  开发服务器配置
   * ============================================================ */
  devServer: {
    port: 3000,
    host: '0.0.0.0'  // 允许局域网/外网访问
  },

  /* ============================================================
   *  Vite 配置（开发模式）
   *  允许外部域名访问开发服务器
   *  生产环境请使用 nuxt build，此配置仅用于开发调试
   * ============================================================ */
  vite: {
    server: {
      allowedHosts: [
        'xuenian.hellofurry.cn',
        '.hellofurry.cn'       // 允许所有 hellofurry.cn 子域名
      ]
    }
  },

  /* ============================================================
   *  Nitro 服务器配置
   * ============================================================ */
  nitro: {
    // 预设：本地 Node.js 服务
    preset: 'node-server'
  }

  /* ============================================================
   *  安全配置说明
   *  - X-Powered-By 在 server/middleware/security.ts 中设为空
   *  - nginx 端也需 proxy_hide_header X-Powered-By（双重保障）
   *  - 安全响应头（CSP, HSTS 等）在 server/middleware/security.ts 中统一配置
   *  - 完整安全部署指南见 SECURITY.md
   * ============================================================ */
})
