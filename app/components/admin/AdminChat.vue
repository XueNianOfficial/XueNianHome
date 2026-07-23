<!--
  ============================================================
  AdminChat - 聊天记录管理
  - 概览统计：用户数 / 总消息数 / 存储占用
  - 用户列表：会话数、消息数、会话名称、最后活跃，支持查看详情
  - 详情视图：按会话分组的消息气泡预览
  - 删除用户全部记录走 AdminConfirm 二次确认
  ============================================================
-->
<template>
  <div class="admin-chat">
    <!-- 概览统计 -->
    <div class="stats-row">
      <div class="stat-card card">
        <span class="stat-icon">👥</span>
        <span class="stat-value">{{ stats.totalUsers }}</span>
        <span class="stat-label">用户数</span>
      </div>
      <div class="stat-card card">
        <span class="stat-icon">💬</span>
        <span class="stat-value">{{ stats.totalMessages }}</span>
        <span class="stat-label">总消息数</span>
      </div>
      <div class="stat-card card">
        <span class="stat-icon">💾</span>
        <span class="stat-value">{{ stats.totalSizeFormatted }}</span>
        <span class="stat-label">存储占用</span>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <button type="button" class="btn-outline btn-sm" :disabled="loading" @click="refreshList">
        <span v-if="loading" class="spinner"></span>
        {{ loading ? '加载中…' : '🔄 刷新' }}
      </button>
      <button
        v-if="selectedUser"
        type="button"
        class="btn-ghost btn-sm"
        @click="backToList"
      >← 返回列表</button>
    </div>

    <!-- 加载骨架（仅首次加载列表时展示） -->
    <div v-if="loading && users.length === 0 && !selectedUser" class="chat-skeleton">
      <div v-for="i in 4" :key="i" class="skeleton skeleton-row"></div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="errorMessage" class="error-state">
      <p>⚠️ {{ errorMessage }}</p>
      <button type="button" class="btn-outline btn-sm" @click="refreshList">重试</button>
    </div>

    <!-- 用户列表 -->
    <div v-else-if="!selectedUser" class="card table-card">
      <div v-if="users.length === 0" class="empty-state">
        <div class="empty-state-icon">💬</div>
        <p>暂无聊天记录</p>
      </div>
      <div v-else class="users-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>用户 ID</th>
              <th>会话数</th>
              <th>消息数</th>
              <th>会话名称</th>
              <th>最后活跃</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.userId">
              <td class="user-id-cell" :title="user.userId">
                {{ truncate(user.userId, 14) }}
              </td>
              <td>{{ user.sessionCount }}</td>
              <td>{{ user.messageCount }}</td>
              <td class="sessions-cell">
                <span
                  v-for="(name, i) in user.sessionNames.slice(0, 3)"
                  :key="i"
                  class="badge"
                >{{ name }}</span>
                <span v-if="user.sessionNames.length > 3" class="more-tag">
                  +{{ user.sessionNames.length - 3 }}
                </span>
              </td>
              <td class="date-cell">{{ formatDate(user.lastActiveAt) }}</td>
              <td>
                <div class="actions-cell">
                  <button type="button" class="btn-outline btn-sm" @click="viewDetail(user.userId)">
                    查看
                  </button>
                  <button
                    type="button"
                    class="btn-danger btn-sm"
                    @click="confirmDeleteUser(user.userId)"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 用户详情 -->
    <div v-else class="user-detail">
      <h3 class="detail-title">👤 用户 {{ truncate(selectedUser, 20) }} 的聊天记录</h3>

      <!-- 详情加载中 -->
      <div v-if="detailLoading" class="detail-loading">
        <span class="spinner"></span>
        <span>加载会话中…</span>
      </div>

      <template v-else-if="userDetail">
        <div v-for="session in userDetail.sessions" :key="session.id" class="detail-session card">
          <div class="session-header">
            <span class="session-name">💬 {{ session.name }}</span>
            <span v-if="session.preset" class="badge">{{ session.preset }}</span>
            <span class="session-time">{{ formatDate(session.lastActiveAt) }}</span>
          </div>
          <div class="session-messages">
            <div
              v-for="msg in session.messages"
              :key="msg.id"
              class="detail-msg"
              :class="`detail-msg--${msg.role}`"
            >
              <span class="detail-msg-role">{{ msg.role === 'user' ? '👤' : '🦊' }}</span>
              <span class="detail-msg-content">{{ truncate(msg.content, 120) }}</span>
              <span class="detail-msg-time">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <div v-if="session.messages.length === 0" class="empty-msgs">
              暂无消息
            </div>
          </div>
        </div>

        <div v-if="userDetail.sessions.length === 0" class="empty-state">
          <div class="empty-state-icon">📭</div>
          <p>该用户暂无会话</p>
        </div>
      </template>
    </div>

    <!-- 删除确认弹窗 -->
    <AdminConfirm
      :show="deleteTarget !== null"
      title="删除聊天记录"
      :description="`确定要删除用户 ${truncate(deleteTarget || '', 20)} 的所有聊天记录吗？此操作不可撤销。`"
      confirm-text="确认删除"
      :loading="deleting"
      loading-text="删除中…"
      @confirm="executeDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  AdminChat - 管理后台聊天记录管理组件
 *  - GET  /api/admin/chat/list              用户与统计概览
 *  - GET  /api/admin/chat/detail?userId=…   单用户全部会话
 *  - POST /api/admin/chat/delete            删除用户全部记录（body: { userId }）
 *  ============================================================
 */
import AdminConfirm from './AdminConfirm.vue'

const { success, error: toastError } = useToast()

interface UserSummary {
  userId: string
  sessionCount: number
  messageCount: number
  lastActiveAt: number
  sessionNames: string[]
}

interface StatsData {
  users: UserSummary[]
  totalUsers: number
  totalMessages: number
  totalSize: number
  totalSizeFormatted: string
}

const loading = ref(false)
const errorMessage = ref('')
const users = ref<UserSummary[]>([])
const stats = ref({ totalUsers: 0, totalMessages: 0, totalSizeFormatted: '0 B' })

const selectedUser = ref<string | null>(null)
const userDetail = ref<any>(null)
const detailLoading = ref(false)

const deleteTarget = ref<string | null>(null)
const deleting = ref(false)

/** 加载用户列表与统计 */
async function refreshList() {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await $fetch<{ success: boolean; data: StatsData }>('/api/admin/chat/list')
    if (res.success && res.data) {
      users.value = res.data.users
      stats.value = {
        totalUsers: res.data.totalUsers,
        totalMessages: res.data.totalMessages,
        totalSizeFormatted: res.data.totalSizeFormatted
      }
    }
  } catch (e: any) {
    errorMessage.value = e?.data?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

/** 查看指定用户的会话详情 */
async function viewDetail(userId: string) {
  selectedUser.value = userId
  userDetail.value = null
  detailLoading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: any }>(`/api/admin/chat/detail?userId=${encodeURIComponent(userId)}`)
    if (res.success) {
      userDetail.value = res.data
    }
  } catch (e: any) {
    toastError(e?.data?.message || '加载详情失败')
    selectedUser.value = null
  } finally {
    detailLoading.value = false
  }
}

/** 返回用户列表 */
function backToList() {
  selectedUser.value = null
  userDetail.value = null
}

/** 发起删除确认 */
function confirmDeleteUser(userId: string) {
  deleteTarget.value = userId
}

/** 执行删除：移除列表项并刷新统计 */
async function executeDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await $fetch('/api/admin/chat/delete', {
      method: 'POST',
      body: { userId: deleteTarget.value }
    })
    users.value = users.value.filter(u => u.userId !== deleteTarget.value)
    if (selectedUser.value === deleteTarget.value) {
      backToList()
    }
    deleteTarget.value = null
    success('删除成功')
    // 刷新统计数字
    refreshList()
  } catch (e: any) {
    toastError(e?.data?.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

/** 超长文本截断 */
function truncate(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

/** 相对时间格式化（刚刚 / N 分钟前 / N 小时前 / 日期） */
function formatDate(ts: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** 时分格式化 */
function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  refreshList()
})
</script>

<style scoped>
.admin-chat {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* 统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-4);
  text-align: center;
}

.stat-icon {
  font-size: var(--text-xl);
  margin-bottom: var(--space-1);
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-accent);
  line-height: 1.2;
  word-break: break-all;
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

/* 工具栏 */
.toolbar {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

/* 加载骨架 */
.chat-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.skeleton-row {
  height: 52px;
  border-radius: var(--radius-md);
}

/* 错误状态 */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  color: var(--color-danger);
  text-align: center;
}

.error-state p {
  margin: 0;
}

/* 用户表格 */
.table-card {
  padding: 0;
  overflow: hidden;
}

.users-table-wrap {
  overflow-x: auto;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.admin-table th,
.admin-table td {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.admin-table tr:last-child td {
  border-bottom: none;
}

.admin-table th {
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: var(--text-xs);
  background: var(--color-bg-secondary);
}

.admin-table tbody tr {
  transition: background var(--transition-fast);
}

.admin-table tbody tr:hover {
  background: var(--color-bg-secondary);
}

.user-id-cell {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.sessions-cell {
  max-width: 220px;
  white-space: normal;
}

.sessions-cell .badge {
  margin-right: var(--space-1);
  margin-bottom: 2px;
}

.more-tag {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.date-cell {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
}

.actions-cell {
  display: flex;
  gap: var(--space-2);
}

/* 用户详情 */
.user-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.detail-title {
  margin: 0;
  font-size: var(--text-base);
  word-break: break-all;
}

.detail-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--color-text-muted);
}

.detail-session {
  padding: 0;
  overflow: hidden;
}

.session-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.session-name {
  font-weight: 600;
  font-size: var(--text-sm);
}

.session-time {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.session-messages {
  max-height: 400px;
  overflow-y: auto;
  padding: var(--space-2);
}

.detail-msg {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-1);
}

.detail-msg--user {
  background: var(--color-accent-bg);
}

.detail-msg--assistant {
  background: var(--color-bg-secondary);
}

.detail-msg-role {
  flex-shrink: 0;
  font-size: var(--text-sm);
}

.detail-msg-content {
  flex: 1;
  font-size: var(--text-sm);
  line-height: 1.5;
  word-break: break-word;
  min-width: 0;
}

.detail-msg-time {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.empty-msgs {
  text-align: center;
  padding: var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* 响应式 */
@media (max-width: 640px) {
  .stats-row {
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }

  .stat-card {
    padding: var(--space-3) var(--space-2);
  }

  .stat-value {
    font-size: var(--text-lg);
  }

  .sessions-cell {
    display: none;
  }
}
</style>
