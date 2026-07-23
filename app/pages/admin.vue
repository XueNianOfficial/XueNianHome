<!--
============================================================
  雪年个人网站 - 管理后台页面
  - 未登录：居中登录卡片（账号密码验证，含加载态与错误动画）
  - 已登录：左侧侧边栏导航 + 顶栏（当前用户/退出）+ 内容区
  - 移动端：侧边栏折叠为顶部横向滚动 tab
============================================================
-->
<template>
  <div class="page-admin">
    <!-- 登录状态检查中：避免登录卡片闪烁 -->
    <div v-if="isChecking" class="admin-checking">
      <span class="spinner"></span>
      <p>正在验证登录状态…</p>
    </div>

    <!-- 未登录：登录卡片 -->
    <div v-else-if="!isLoggedIn" class="admin-login-page">
      <div class="login-card card">
        <img src="/images/头像.png" alt="雪年头像" class="login-logo" />
        <h2 class="login-title">管理后台</h2>
        <p class="login-desc">请输入管理员账号和密码</p>

        <form class="login-form" @submit.prevent="handleLogin">
          <div class="login-field">
            <label class="field-label" for="admin-username">用户名</label>
            <input
              id="admin-username"
              v-model="username"
              type="text"
              class="input"
              placeholder="请输入用户名"
              autocomplete="username"
              :disabled="loginLoading"
            />
          </div>
          <div class="login-field">
            <label class="field-label" for="admin-password">密码</label>
            <input
              id="admin-password"
              v-model="password"
              type="password"
              class="input"
              placeholder="请输入密码"
              autocomplete="current-password"
              :disabled="loginLoading"
            />
          </div>

          <!-- 错误提示：key 绑定错误文案，文案变化时重新播放抖动动画 -->
          <p v-if="loginError" :key="loginError" class="login-error" role="alert">
            {{ loginError }}
          </p>

          <button
            type="submit"
            class="btn-primary login-btn"
            :disabled="!username || !password || loginLoading"
          >
            <span v-if="loginLoading" class="spinner login-btn-spinner"></span>
            {{ loginLoading ? '验证中…' : '登录' }}
          </button>
        </form>

        <NuxtLink to="/" class="login-back">← 返回首页</NuxtLink>
      </div>
    </div>

    <!-- 已登录：管理面板（侧边栏 + 主区域） -->
    <div v-else class="admin-layout">
      <!-- 侧边栏导航（移动端变为顶部横向滚动 tab） -->
      <aside class="admin-sidebar">
        <nav class="admin-nav">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="admin-nav-item"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <span class="admin-nav-icon">{{ tab.icon }}</span>
            <span class="admin-nav-label">{{ tab.label }}</span>
          </button>
        </nav>
      </aside>

      <!-- 主区域：顶栏 + 内容 -->
      <div class="admin-main">
        <header class="admin-topbar">
          <h1 class="admin-page-title">{{ activeTabLabel }}</h1>
          <div class="admin-topbar-right">
            <span class="admin-user">👤 {{ currentUser }}</span>
            <button type="button" class="btn-outline btn-sm" @click="handleLogout">
              退出登录
            </button>
          </div>
        </header>

        <section class="admin-content">
          <AdminBlog v-if="activeTab === 'blog'" />
          <AdminGallery v-if="activeTab === 'gallery'" />
          <AdminAISettings v-if="activeTab === 'ai'" />
          <AdminFriends v-if="activeTab === 'friends'" />
          <AdminChat v-if="activeTab === 'chat'" />
          <AdminLogs v-if="activeTab === 'logs'" />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 管理后台页面
 * - Tab 组件使用 defineAsyncComponent 按需懒加载，减少首屏体积
 * - 登录/登出接口契约：
 *   POST /api/admin/login  { username, password } → { success, user }
 *   POST /api/admin/logout → { success }
 *   GET  /api/admin/check  → { authenticated, user? }
 * - 登录失败文案直接展示服务端 message（服务端已做「用户不存在/密码错误」无差别提示）
 */

/** 管理后台 Tab 组件（懒加载） */
const AdminBlog = defineAsyncComponent(() => import('~/components/admin/AdminBlog.vue'))
const AdminGallery = defineAsyncComponent(() => import('~/components/admin/AdminGallery.vue'))
const AdminAISettings = defineAsyncComponent(() => import('~/components/admin/AdminAISettings.vue'))
const AdminFriends = defineAsyncComponent(() => import('~/components/admin/AdminFriends.vue'))
const AdminChat = defineAsyncComponent(() => import('~/components/admin/AdminChat.vue'))
const AdminLogs = defineAsyncComponent(() => import('~/components/admin/AdminLogs.vue'))

const { success } = useToast()

useHead({ title: '管理后台' })

/** Tab 定义（图标 + 文字） */
const tabs = [
  { id: 'blog', icon: '📝', label: '博客管理' },
  { id: 'gallery', icon: '🖼️', label: '图片管理' },
  { id: 'friends', icon: '🔗', label: '友链管理' },
  { id: 'ai', icon: '💬', label: 'AI 设置' },
  { id: 'chat', icon: '📋', label: '聊天记录' },
  { id: 'logs', icon: '🩺', label: '系统日志' }
] as const

const activeTab = ref<'blog' | 'gallery' | 'friends' | 'ai' | 'chat' | 'logs'>('blog')

/** 当前激活 Tab 的名称（用于顶栏标题） */
const activeTabLabel = computed(() => tabs.find(t => t.id === activeTab.value)?.label || '')

/** 登录状态 */
const isLoggedIn = ref(false)
const isChecking = ref(true)
const currentUser = ref('')

/** 登录表单 */
const username = ref('')
const password = ref('')
const loginLoading = ref(false)
const loginError = ref('')

/** 检查登录状态 */
async function checkAuth() {
  try {
    const res = await $fetch<{ authenticated: boolean; user?: { username: string; displayName: string } }>('/api/admin/check')
    isLoggedIn.value = res.authenticated
    if (res.user) {
      currentUser.value = res.user.displayName || res.user.username
    }
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
    const res = await $fetch<{ success: boolean; user: { username: string; displayName: string } }>('/api/admin/login', {
      method: 'POST',
      body: { username: username.value, password: password.value }
    })
    isLoggedIn.value = true
    currentUser.value = res.user.displayName || res.user.username
    username.value = ''
    password.value = ''
  } catch (e: any) {
    // 服务端返回的中文提示（含限速提示），原样展示
    loginError.value = e?.data?.message || '登录失败，请稍后重试'
  }
  loginLoading.value = false
}

/** 登出 */
async function handleLogout() {
  try {
    await $fetch('/api/admin/logout', { method: 'POST' })
  } catch { /* 忽略登出接口错误，本地状态照常清除 */ }
  isLoggedIn.value = false
  currentUser.value = ''
  success('已退出登录')
}

onMounted(() => {
  checkAuth()
})
</script>

<style scoped>
/* ---------- 登录状态检查中 ---------- */
.admin-checking {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  min-height: 50vh;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* ---------- 登录页 ---------- */
.admin-login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - var(--header-height));
  padding: var(--space-8) var(--space-4);
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: var(--space-8);
  text-align: center;
}

.login-logo {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-full);
  object-fit: cover;
  border: 3px solid var(--color-accent-bg);
  box-shadow: var(--shadow-accent);
  margin-bottom: var(--space-4);
}

.login-title {
  font-size: var(--text-2xl);
  margin: 0 0 var(--space-2);
}

.login-desc {
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-6);
  font-size: var(--text-sm);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  text-align: left;
}

/* 错误提示：红色淡入 + 左右抖动 */
.login-error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  margin: 0;
  text-align: center;
  animation: login-error-shake var(--transition-slow);
}

.login-btn {
  width: 100%;
}

/* 主按钮上的旋转圈：反白色（与 .btn-primary 的反白文字一致） */
.login-btn-spinner {
  width: 16px;
  height: 16px;
  border-color: rgba(255, 255, 255, 0.4);
  border-top-color: #FFFFFF;
}

.login-back {
  display: inline-block;
  margin-top: var(--space-6);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.login-back:hover {
  color: var(--color-accent);
}

/* 登录错误抖动动画（淡入 + 左右抖动） */
@keyframes login-error-shake {
  0% { transform: translateX(0); opacity: 0; }
  20% { transform: translateX(-6px); opacity: 1; }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
  100% { transform: translateX(0); opacity: 1; }
}

/* ---------- 管理面板布局 ---------- */
.admin-layout {
  display: flex;
  align-items: flex-start;
  gap: var(--space-6);
  max-width: var(--container-max);
  margin: 0 auto;
  padding: var(--space-6);
}

/* 侧边栏 */
.admin-sidebar {
  flex-shrink: 0;
  width: 200px;
  position: sticky;
  top: calc(var(--header-height) + var(--space-6));
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
  box-shadow: var(--shadow-sm);
}

.admin-nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 10px 14px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.admin-nav-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* 激活态：强调色浅底 + 强调色文字 */
.admin-nav-item.active {
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 600;
}

.admin-nav-icon {
  font-size: 1rem;
}

/* 主区域 */
.admin-main {
  flex: 1;
  min-width: 0;
}

.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.admin-page-title {
  font-size: var(--text-xl);
  margin: 0;
}

.admin-topbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.admin-user {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.admin-content {
  min-height: 400px;
}

/* ---------- 响应式：移动端侧边栏折叠为顶部横向滚动 tab ---------- */
@media (max-width: 768px) {
  .admin-layout {
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
  }

  .admin-sidebar {
    position: static;
    width: 100%;
  }

  .admin-nav {
    flex-direction: row;
    overflow-x: auto;
    padding: var(--space-2);
  }

  .admin-nav-item {
    flex-shrink: 0;
  }

  .admin-topbar {
    flex-wrap: wrap;
  }
}
</style>
