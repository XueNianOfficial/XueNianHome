<!--
============================================================
  雪年个人网站 - 管理后台页面
  需密码登录后使用，管理博客、图片、AI 设置
============================================================
-->
<template>
  <div class="page-admin">
    <!-- 未登录：显示登录表单 -->
    <div v-if="!isLoggedIn" class="admin-login-page">
      <div class="login-card card">
        <h2>🔐 管理后台</h2>
        <p class="login-desc">请输入管理密码</p>
        <form @submit.prevent="handleLogin" class="login-form">
          <input
            v-model="password"
            type="password"
            placeholder="密码"
            class="login-input"
            :disabled="loginLoading"
          />
          <p v-if="loginError" class="login-error">{{ loginError }}</p>
          <button
            type="submit"
            class="btn-primary login-btn"
            :disabled="!password || loginLoading"
          >
            {{ loginLoading ? '验证中...' : '登录' }}
          </button>
        </form>
      </div>
    </div>

    <!-- 已登录：显示管理面板 -->
    <div v-else class="admin-panel">
      <div class="admin-header">
        <h1>⚙️ 管理后台</h1>
        <button class="btn-outline" @click="handleLogout">退出登录</button>
      </div>

      <!-- Tab 切换 -->
      <div class="admin-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="admin-tab"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id as typeof activeTab"
        >{{ tab.label }}</button>
      </div>

      <!-- Tab 内容 -->
      <div class="admin-content">
        <AdminBlog v-if="activeTab === 'blog'" />
        <AdminGallery v-if="activeTab === 'gallery'" />
        <AdminAISettings v-if="activeTab === 'ai'" />
        <AdminFriends v-if="activeTab === 'friends'" />
        <AdminChat v-if="activeTab === 'chat'" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 管理后台页面
 * Tab 组件使用 defineAsyncComponent 按需懒加载，减少首屏体积
 */

/** 管理后台 Tab 组件（懒加载） */
const AdminBlog = defineAsyncComponent(() => import('~/components/admin/AdminBlog.vue'))
const AdminGallery = defineAsyncComponent(() => import('~/components/admin/AdminGallery.vue'))
const AdminAISettings = defineAsyncComponent(() => import('~/components/admin/AdminAISettings.vue'))
const AdminFriends = defineAsyncComponent(() => import('~/components/admin/AdminFriends.vue'))
const AdminChat = defineAsyncComponent(() => import('~/components/admin/AdminChat.vue'))

useHead({ title: '管理后台' })

/** Tab 定义 */
const tabs = [
  { id: 'blog', label: '📝 博客管理' },
  { id: 'gallery', label: '🖼️ 图片管理' },
  { id: 'friends', label: '🔗 友链管理' },
  { id: 'ai', label: '💬 AI 设置' },
  { id: 'chat', label: '📋 聊天记录' }
]

const activeTab = ref<'blog' | 'gallery' | 'friends' | 'ai' | 'chat'>('blog')

/** 登录状态 */
const isLoggedIn = ref(false)
const isChecking = ref(true)

/** 登录表单 */
const password = ref('')
const loginLoading = ref(false)
const loginError = ref('')

/** 检查登录状态 */
async function checkAuth() {
  try {
    const res = await $fetch<{ authenticated: boolean }>('/api/admin/check')
    isLoggedIn.value = res.authenticated
  } catch {
    isLoggedIn.value = false
  }
  isChecking.value = false
}

/** 登录 */
async function handleLogin() {
  loginLoading.value = true
  loginError.value = ''
  try {
    await $fetch('/api/admin/login', {
      method: 'POST',
      body: { password: password.value }
    })
    isLoggedIn.value = true
    password.value = ''
  } catch (e: any) {
    loginError.value = e?.data?.message || '登录失败'
  }
  loginLoading.value = false
}

/** 登出 */
async function handleLogout() {
  try {
    await $fetch('/api/admin/logout', { method: 'POST' })
  } catch { /* 忽略 */ }
  isLoggedIn.value = false
}

onMounted(() => {
  checkAuth()
})
</script>

<style scoped>
/* ---------- 登录页 ---------- */
.admin-login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 40px 20px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  text-align: center;
}

.login-card h2 {
  font-size: 1.5rem;
  margin-bottom: 8px;
}

.login-desc {
  color: var(--color-text-secondary);
  margin-bottom: 24px;
  font-size: 0.9rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.login-input {
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 1rem;
  font-family: var(--font-sans);
  outline: none;
  transition: border-color var(--transition-fast);
}

.login-input:focus {
  border-color: var(--color-accent);
}

.login-error {
  color: #DC2626;
  font-size: 0.85rem;
  margin: 0;
}

.login-btn {
  width: 100%;
  padding: 10px;
}

/* ---------- 管理面板 ---------- */
.admin-panel {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 20px;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.admin-header h1 {
  font-size: 1.5rem;
  margin: 0;
}

/* Tab 导航 */
.admin-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0;
}

.admin-tab {
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: -1px;
}

.admin-tab:hover {
  color: var(--color-text-primary);
}

.admin-tab.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.admin-content {
  min-height: 400px;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .login-card {
    padding: 24px;
  }
  .admin-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  .admin-tabs {
    overflow-x: auto;
  }
}
</style>
