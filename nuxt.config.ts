// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  /* ============================================================
   *  应用全局配置
   * ============================================================ */
  app: {
    // 页面过渡动画
    pageTransition: {
      name: 'page',
      mode: 'out-in'
    },
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
    host: '0.0.0.0'  // 允许局域网访问
  },

  /* ============================================================
   *  Nitro 服务器配置
   * ============================================================ */
  nitro: {
    // 预设：本地 Node.js 服务
    preset: 'node-server'
  }
})
