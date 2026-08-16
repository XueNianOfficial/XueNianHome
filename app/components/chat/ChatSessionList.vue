<template>
  <!-- 会话列表抽屉：左侧滑出面板 + 遮罩 -->
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="visible" class="drawer-overlay" @click.self="close">
        <aside class="drawer-panel card">
          <div class="drawer-header">
            <span class="drawer-title">💬 会话列表</span>
            <button class="icon-btn" title="关闭" @click="close">✕</button>
          </div>

          <button class="btn-primary new-session-btn" @click="handleCreate">
            ＋ 创建新对话
          </button>

          <div class="session-list">
            <div
              v-for="session in sessions"
              :key="session.id"
              class="session-item"
              :class="{ active: session.id === activeSessionId }"
              @click="handleSwitch(session.id)"
            >
              <div class="session-info">
                <span class="session-name">{{ session.name }}</span>
                <span class="session-meta">{{ session.messages.length }} 条 · {{ formatDate(session.lastActiveAt) }}</span>
              </div>
              <div class="session-actions" @click.stop>
                <button class="icon-btn action-btn" title="重命名" @click="startRename(session)">✏️</button>
                <button
                  v-if="sessions.length > 1"
                  class="icon-btn action-btn danger"
                  title="删除会话"
                  @click="handleDelete(session.id)"
                >🗑️</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </Transition>

    <!-- 重命名弹窗 -->
    <div v-if="renamingSession" class="modal-overlay" @click.self="renamingSession = null">
      <div class="modal-card card">
        <h3 class="modal-title">重命名会话</h3>
        <input
          v-model="renameText"
          class="input rename-input"
          placeholder="输入新的会话名称"
          maxlength="30"
          @keydown.enter.exact.prevent="confirmRename"
        />
        <div class="modal-actions">
          <button class="btn-outline" @click="renamingSession = null">取消</button>
          <button class="btn-primary" :disabled="!renameText.trim()" @click="confirmRename">确定</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  ChatSessionList - 会话列表抽屉
 *  - 左侧滑出面板：新建 / 切换 / 重命名 / 删除会话
 *  - 重命名通过内嵌弹窗完成；仅剩一个会话时不允许删除
 * ============================================================
 */
import { ref } from 'vue'
import { useChat } from '~/composables/useChat'
import type { ChatSession } from '~/types'

/** 抽屉可见性，由父组件 v-model 控制 */
const visible = defineModel<boolean>({ default: false })

const {
  sessions,
  activeSessionId,
  createSession,
  switchSession,
  deleteSession,
  renameSession,
} = useChat()

function close() {
  visible.value = false
}

function handleCreate() {
  createSession()
  close()
}

function handleSwitch(id: string) {
  switchSession(id)
  close()
}

function handleDelete(id: string) {
  if (sessions.value.length <= 1) return
  if (confirm('确定要删除这个会话吗？')) {
    deleteSession(id)
  }
}

// ==================== 重命名 ====================

const renamingSession = ref<ChatSession | null>(null)
const renameText = ref('')

function startRename(session: ChatSession) {
  renamingSession.value = session
  renameText.value = session.name
}

function confirmRename() {
  if (renamingSession.value && renameText.value.trim()) {
    renameSession(renamingSession.value.id, renameText.value.trim())
  }
  renamingSession.value = null
}

// ==================== 工具 ====================

/** 相对时间显示：刚刚 / N 分钟前 / N 小时前 / 日期 */
function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-bg-mask);
  z-index: var(--z-modal);
}

.drawer-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  max-width: 85vw;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  padding: var(--space-md);
  gap: var(--space-sm);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
}

.new-session-btn {
  width: 100%;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.session-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.session-item:hover {
  background: var(--color-bg-secondary);
}

.session-item.active {
  background: var(--color-accent-bg);
  border-color: var(--color-accent);
}

.session-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-name {
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.session-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.session-item:hover .session-actions,
.session-item:focus-within .session-actions {
  opacity: 1;
}

/* 触屏设备没有 hover，操作按钮常显 */
@media (pointer: coarse) {
  .session-actions {
    opacity: 1;
  }
}

.action-btn {
  width: 28px;
  height: 28px;
  font-size: var(--text-xs);
}

.action-btn.danger:hover {
  color: var(--color-danger);
}

/* 重命名弹窗（基础弹窗样式见 main.css 全局 .modal-* 体系；
   需叠在抽屉等弹层之上，故 z-index 提高一级） */
.modal-overlay {
  z-index: calc(var(--z-modal) + 1);
}

.rename-input {
  width: 100%;
  margin-bottom: var(--space-md);
}

/* 抽屉滑入滑出动画 */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity var(--transition-base);
}

.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform var(--transition-base);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(-100%);
}
</style>
