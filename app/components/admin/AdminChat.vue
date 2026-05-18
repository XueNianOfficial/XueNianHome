<!--
============================================================
  雪年个人网站 - 管理后台聊天记录管理组件
  预览所有用户聊天记录，支持查看详情和删除
============================================================
-->
<template>
  <div class="admin-chat">
    <!-- 概览统计 -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalUsers }}</span>
        <span class="stat-label">用户数</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalMessages }}</span>
        <span class="stat-label">总消息数</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalSizeFormatted }}</span>
        <span class="stat-label">存储占用</span>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="toolbar">
      <button class="btn-primary" @click="refreshList" :disabled="loading">
        {{ loading ? '加载中...' : '🔄 刷新' }}
      </button>
      <button
        v-if="selectedUser"
        class="btn-outline"
        @click="selectedUser = null"
      >← 返回列表</button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading && users.length === 0" class="loading-state">
      加载中...
    </div>

    <!-- 错误 -->
    <div v-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn-outline" @click="refreshList">重试</button>
    </div>

    <!-- 用户列表 -->
    <div v-if="!selectedUser && !loading" class="users-table-wrap">
      <table v-if="users.length > 0" class="admin-table">
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
            <td>
              <span
                v-for="(name, i) in user.sessionNames.slice(0, 3)"
                :key="i"
                class="session-tag"
              >{{ name }}</span>
              <span v-if="user.sessionNames.length > 3" class="more-tag">
                +{{ user.sessionNames.length - 3 }}
              </span>
            </td>
            <td>{{ formatDate(user.lastActiveAt) }}</td>
            <td class="actions-cell">
              <button class="btn-sm btn-outline" @click="viewDetail(user.userId)">
                查看
              </button>
              <button
                class="btn-sm btn-danger"
                @click="confirmDeleteUser(user.userId)"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        <p>暂无聊天记录</p>
      </div>
    </div>

    <!-- 用户详情 -->
    <div v-if="selectedUser && userDetail" class="user-detail">
      <h3>👤 用户 {{ truncate(selectedUser, 20) }} 的聊天记录</h3>

      <div v-for="session in userDetail.sessions" :key="session.id" class="detail-session">
        <div class="session-header">
          <span class="session-name">💬 {{ session.name }}</span>
          <span class="session-preset" v-if="session.preset">预设：{{ session.preset }}</span>
          <span class="session-time">{{ formatDate(session.lastActiveAt) }}</span>
        </div>
        <div class="session-messages">
          <div
            v-for="msg in session.messages"
            :key="msg.id"
            class="detail-msg"
            :class="`detail-msg--${msg.role}`"
          >
            <span class="detail-msg-role">{{ msg.role === 'user' ? '👤' : '🤖' }}</span>
            <span class="detail-msg-content">{{ truncate(msg.content, 120) }}</span>
            <span class="detail-msg-time">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div v-if="session.messages.length === 0" class="empty-msgs">
            暂无消息
          </div>
        </div>
      </div>

      <div v-if="userDetail.sessions.length === 0" class="empty-state">
        <p>该用户暂无会话</p>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal card">
        <h3>⚠️ 确认删除</h3>
        <p>确定要删除用户 <strong>{{ truncate(deleteTarget, 20) }}</strong> 的所有聊天记录吗？此操作不可撤销。</p>
        <div class="modal-actions">
          <button class="btn-outline" @click="deleteTarget = null">取消</button>
          <button class="btn-danger" @click="executeDelete" :disabled="deleting">
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * AdminChat - 管理后台聊天记录管理组件
 */
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
const error = ref('')
const users = ref<UserSummary[]>([])
const stats = ref({ totalUsers: 0, totalMessages: 0, totalSizeFormatted: '0 B' })

const selectedUser = ref<string | null>(null)
const userDetail = ref<any>(null)

const deleteTarget = ref<string | null>(null)
const deleting = ref(false)

async function refreshList() {
  loading.value = true
  error.value = ''
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
    error.value = e?.data?.message || '加载失败'
  }
  loading.value = false
}

async function viewDetail(userId: string) {
  selectedUser.value = userId
  userDetail.value = null
  try {
    const res = await $fetch<{ success: boolean; data: any }>(`/api/admin/chat/detail?userId=${encodeURIComponent(userId)}`)
    if (res.success) {
      userDetail.value = res.data
    }
  } catch {
    userDetail.value = null
  }
}

function confirmDeleteUser(userId: string) {
  deleteTarget.value = userId
}

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
      selectedUser.value = null
      userDetail.value = null
    }
    deleteTarget.value = null
    // 刷新统计
    refreshList()
  } catch (e: any) {
    error.value = e?.data?.message || '删除失败'
  }
  deleting.value = false
}

function truncate(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

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
  gap: 16px;
}

/* 统计卡片 */
.stats-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-card {
  flex: 1;
  min-width: 120px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  padding: 16px;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-accent);
}

.stat-label {
  display: block;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 4px;
}

/* 工具栏 */
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 表格 */
.users-table-wrap {
  overflow-x: auto;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.admin-table th,
.admin-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.admin-table th {
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.admin-table tbody tr:hover {
  background: var(--color-bg-secondary);
}

.user-id-cell {
  font-family: monospace;
  font-size: 0.8rem;
}

.session-tag {
  display: inline-block;
  background: var(--color-bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  margin-right: 4px;
  margin-bottom: 2px;
}

.more-tag {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.actions-cell {
  display: flex;
  gap: 6px;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: none;
  transition: all var(--transition-fast);
}

.btn-danger {
  background: #DC2626;
  color: #fff;
  border: none;
  padding: 4px 10px;
  font-size: 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.btn-danger:hover {
  background: #B91C1C;
}

/* 用户详情 */
.user-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-detail h3 {
  margin: 0;
  font-size: 1.1rem;
}

.detail-session {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.session-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.session-name {
  font-weight: 600;
}

.session-preset {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.session-time {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.session-messages {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.detail-msg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
}

.detail-msg--user {
  background: var(--color-accent-bg);
}

.detail-msg--assistant {
  background: var(--color-bg-secondary);
}

.detail-msg-role {
  flex-shrink: 0;
  font-size: 0.9rem;
}

.detail-msg-content {
  flex: 1;
  font-size: 0.85rem;
  line-height: 1.5;
  word-break: break-word;
}

.detail-msg-time {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.empty-msgs {
  text-align: center;
  padding: 16px;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

/* 空/加载/错误状态 */
.empty-state,
.loading-state,
.error-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-muted);
}

.error-state {
  color: #DC2626;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  width: 90%;
  max-width: 400px;
  padding: 24px;
}

.modal h3 {
  margin: 0 0 12px;
}

.modal p {
  font-size: 0.9rem;
  margin: 0 0 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 按钮复用 */
.btn-outline {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-outline:hover {
  background: var(--color-bg-secondary);
}

.btn-primary {
  padding: 8px 16px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-primary:hover {
  background: var(--color-accent-dark);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
