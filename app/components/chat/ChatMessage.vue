<!--
============================================================
  雪年个人网站 - 聊天消息气泡组件
  - 用户消息：右侧 accent 渐变气泡（气泡角在右上）
  - AI 消息：左侧卡片底色气泡 + 雪年头像（气泡角在左上）
  - 悬停显示操作：复制 / 编辑（移动端常显）
  - 支持消息编辑（仅保存 / 保存并重发）、图片展示、时间戳
  - AI 消息支持深度思考过程折叠展示与「已联网搜索」标记
============================================================
-->
<template>
  <div class="chat-message" :class="`chat-message--${message.role}`">
    <!-- AI 消息头像（左侧） -->
    <div v-if="message.role === 'assistant'" class="message-avatar">
      <img :src="aiAvatar" alt="雪年头像" class="avatar-img" width="36" height="36" @error="onAiAvatarError">
    </div>

    <!-- 消息主体 -->
    <div class="message-body">
      <!-- 编辑模式 -->
      <div v-if="isEditing" class="message-edit-area">
        <textarea
          ref="editInputRef"
          v-model="editContent"
          class="message-edit-input"
          rows="3"
          @keydown.enter.exact.prevent="handleSaveEdit"
          @keydown.escape="handleCancelEdit"
        ></textarea>
        <div class="message-edit-actions">
          <span class="edit-hint">Enter 保存并重发 · Esc 取消</span>
          <div class="edit-btns">
            <button class="btn-ghost btn-sm" @click="handleCancelEdit">取消</button>
            <button class="btn-outline btn-sm" :disabled="!editContent.trim()" @click="handleSaveEditOnly">仅保存</button>
            <button class="btn-primary btn-sm" :disabled="!editContent.trim()" @click="handleSaveEdit">保存并重发</button>
          </div>
        </div>
      </div>

      <!-- 普通消息气泡 -->
      <template v-else>
        <!-- AI 深度思考过程（可折叠，插值纯文本渲染防 XSS） -->
        <details
          v-if="message.role === 'assistant' && message.reasoning"
          class="message-reasoning"
        >
          <summary class="message-reasoning-summary">💭 思考过程</summary>
          <div class="message-reasoning-content">{{ message.reasoning }}</div>
        </details>

        <div
          class="message-bubble"
          @contextmenu.prevent="startEditLocal"
          @touchstart="onTouchStart"
          @touchend="onTouchEnd"
          @touchmove="onTouchMove"
        >
          <!-- 图片展示 -->
          <div v-if="message.parts && message.parts.length > 0" class="message-images">
            <template v-for="(part, idx) in message.parts" :key="idx">
              <img
                v-if="part.type === 'image_url' && part.image_url"
                :src="part.image_url.url"
                class="message-image"
                alt="聊天中的图片"
                loading="lazy"
                @click="viewImage(part.image_url!.url)"
              />
            </template>
          </div>
          <div v-if="message.content" class="message-content" v-html="renderedContent"></div>
          <div class="message-meta">
            <span v-if="message.edited" class="message-edited-tag">已编辑</span>
            <span v-if="message.searched" class="message-searched-tag">🌐 已联网搜索</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
        </div>

        <!-- 消息操作按钮（悬停显示；移动端常显） -->
        <div class="message-actions">
          <button
            v-if="message.content"
            class="msg-action-btn"
            title="复制内容"
            @click="copyContent"
          >📋</button>
          <button
            class="msg-action-btn"
            title="编辑消息"
            @click="startEditLocal"
          >✏️</button>
        </div>
      </template>
    </div>

    <!-- 用户消息头像（右侧） -->
    <div v-if="message.role === 'user'" class="message-avatar message-avatar--user">
      😊
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ChatMessage - 单条聊天消息组件
 * 根据 role 渲染不同样式的气泡，支持复制、编辑、长按/右键进入编辑
 */
import type { ChatMessage } from '~/types'
import { useChat } from '~/composables/useChat'
import { useToast } from '~/composables/useToast'

const props = defineProps<{
  message: ChatMessage
}>()

const { editingMessageId, startEdit, cancelEdit, saveEdit, saveEditOnly, currentPresetAvatar } = useChat()
const toast = useToast()

/** AI 消息使用的头像（预设头像 > 默认雪年头像） */
const aiAvatar = computed(() => currentPresetAvatar.value || '/images/头像.png')

/** 头像加载失败时回退到默认头像（防止预设头像 404 显示破图） */
function onAiAvatarError(e: Event) {
  const img = e.target as HTMLImageElement
  if (img && img.src !== '/images/头像.png') {
    img.src = '/images/头像.png'
  }
}

/** 是否正在编辑此条消息 */
const isEditing = computed(() => editingMessageId.value === props.message.id)

/** 编辑框内容 */
const editContent = ref(props.message.content)

/** 编辑输入框 ref（进入编辑时自动聚焦） */
const editInputRef = ref<HTMLTextAreaElement | null>(null)

/** 渲染消息内容为 HTML（转义 + 换行 + 简单 Markdown，保持现状不引入渲染器） */
const renderedContent = computed(() => {
  return props.message.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
})

/** 复制消息文本到剪贴板 */
async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    toast.success('已复制')
  } catch {
    toast.error('复制失败，请手动选择文本复制')
  }
}

/** 进入编辑模式（右键 / 长按 / 按钮触发） */
function startEditLocal() {
  editContent.value = props.message.content
  startEdit(props.message.id)
  nextTick(() => {
    editInputRef.value?.focus()
  })
}

/** 保存编辑并重发（截断后续消息重新生成） */
function handleSaveEdit() {
  if (!editContent.value.trim()) return
  saveEdit(props.message.id, editContent.value)
}

/** 仅保存编辑内容（不重发） */
function handleSaveEditOnly() {
  if (!editContent.value.trim()) return
  saveEditOnly(props.message.id, editContent.value)
}

/** 取消编辑 */
function handleCancelEdit() {
  cancelEdit()
}

// ==================== 移动端长按进入编辑 ====================

/** 长按计时器 */
let longPressTimer: ReturnType<typeof setTimeout> | null = null
/** 长按触发阈值（ms） */
const LONG_PRESS_MS = 500
/** 是否已触发长按 */
let longPressTriggered = false

function onTouchStart() {
  longPressTriggered = false
  longPressTimer = setTimeout(() => {
    longPressTriggered = true
    startEditLocal()
  }, LONG_PRESS_MS)
}

function onTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  if (longPressTriggered) {
    longPressTriggered = false
  }
}

/** 滑动时取消长按（避免滚动误触发编辑） */
function onTouchMove() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

/** 格式化时间戳为 HH:MM */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** 在新窗口中查看大图 */
function viewImage(src: string) {
  window.open(src, '_blank', 'width=800,height=600')
}
</script>

<style scoped>
/* ---------- 消息容器（入场动画使用全局 fade-in-up 关键帧） ---------- */
.chat-message {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  max-width: 85%;
  animation: fade-in-up var(--transition-normal);
}

/* 用户消息右对齐 */
.chat-message--user {
  align-self: flex-end;
  flex-direction: row;
}

/* AI 消息左对齐 */
.chat-message--assistant {
  align-self: flex-start;
}

/* ---------- 消息主体 ---------- */
.message-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-message--user .message-body {
  align-items: flex-end;
}

.chat-message--assistant .message-body {
  align-items: flex-start;
}

/* ---------- 头像 ---------- */
.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
  overflow: hidden;
}

.message-avatar--user {
  background: var(--color-accent-bg);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ---------- 消息气泡（不对称圆角 = 气泡角） ---------- */
.message-bubble {
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  position: relative;
  box-shadow: var(--shadow-sm);
}

/* AI 气泡：卡片底色 + 细边框，气泡角在左上 */
.chat-message--assistant .message-bubble {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  border-top-left-radius: var(--radius-sm);
}

/* 用户气泡：accent 渐变 + 反白文字，气泡角在右上 */
.chat-message--user .message-bubble {
  background: var(--color-accent-gradient);
  color: #FFFFFF;
  border-top-right-radius: var(--radius-sm);
  box-shadow: var(--shadow-accent);
}

/* ---------- 消息内容 ---------- */
.message-content {
  font-size: var(--text-sm);
  line-height: 1.6;
  word-break: break-word;
}

.message-content :deep(strong) {
  font-weight: 700;
}

.message-content :deep(em) {
  font-style: italic;
}

/* ---------- 消息图片 ---------- */
.message-images {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.message-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  cursor: pointer;
  border: 1px solid var(--color-border);
  transition: transform var(--transition-fast);
}
.message-image:hover {
  transform: scale(1.05);
}

/* ---------- 消息元信息（时间戳 / 已编辑标记） ---------- */
.message-meta {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  justify-content: flex-end;
  margin-top: var(--space-1);
}

.message-time {
  font-size: var(--text-xs);
  opacity: 0.7;
}

.message-edited-tag {
  font-size: var(--text-xs);
  opacity: 0.6;
  font-style: italic;
}

/* 联网搜索小标记（与「已编辑」同风格） */
.message-searched-tag {
  font-size: var(--text-xs);
  opacity: 0.6;
}

/* ---------- 深度思考过程折叠区（AI 消息气泡上方） ---------- */
.message-reasoning {
  margin-bottom: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.message-reasoning-summary {
  cursor: pointer;
  user-select: none;
  font-style: italic;
}

.message-reasoning-content {
  margin-top: var(--space-1);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.chat-message--assistant .message-meta {
  color: var(--color-text-muted);
}

/* ---------- 消息操作按钮（复制 / 编辑） ---------- */
.message-actions {
  display: flex;
  gap: var(--space-1);
  margin-top: var(--space-1);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.chat-message:hover .message-actions,
.chat-message:focus-within .message-actions {
  opacity: 1;
}

/* 移动端（触摸设备）始终显示操作按钮 */
@media (pointer: coarse) {
  .message-actions {
    opacity: 1;
  }
}

.msg-action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition:
    background-color var(--transition-fast),
    transform var(--transition-fast);
}

.msg-action-btn:hover {
  background: var(--color-bg-hover);
}

.msg-action-btn:active {
  transform: scale(0.92);
}

/* ---------- 编辑模式 ---------- */
.message-edit-area {
  width: 100%;
  min-width: 260px;
}

.message-edit-input {
  width: 100%;
  padding: 8px 12px;
  border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: var(--text-sm);
  font-family: var(--font-sans);
  line-height: 1.5;
  resize: vertical;
  outline: none;
  box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.15);
}

.message-edit-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-2);
  gap: var(--space-2);
  flex-wrap: wrap;
}

.edit-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.edit-btns {
  display: flex;
  gap: var(--space-2);
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .chat-message {
    max-width: 92%;
  }
}
</style>
