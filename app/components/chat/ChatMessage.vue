<!--
============================================================
  雪年个人网站 - 聊天消息组件
  区分用户消息（右侧蓝色气泡）和 AI 消息（左侧白色气泡）
  支持消息编辑功能
============================================================
-->
<template>
  <div class="chat-message" :class="`chat-message--${message.role}`">
    <!-- AI 消息头像（左侧） -->
    <div v-if="message.role === 'assistant'" class="message-avatar">
      <img src="/images/头像.png" alt="雪年的头像" class="avatar-img" width="36" height="36">
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
          <span class="edit-hint">Enter 保存 · Esc 取消</span>
          <div class="edit-btns">
            <button class="btn-edit-cancel" @click="handleCancelEdit">取消</button>
            <button class="btn-edit-save-only" :disabled="!editContent.trim()" @click="handleSaveEditOnly">仅保存</button>
            <button class="btn-edit-save" :disabled="!editContent.trim()" @click="handleSaveEdit">保存并重发</button>
          </div>
        </div>
      </div>

      <!-- 普通消息气泡 -->
      <template v-else>
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
                alt="用户上传的图片"
                loading="lazy"
                @click="viewImage(part.image_url!.url)"
              />
            </template>
          </div>
          <div class="message-content" v-html="renderedContent"></div>
          <div class="message-meta">
            <span v-if="message.edited" class="message-edited-tag">已编辑</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
        </div>

        <!-- 消息操作按钮（用户和 AI 消息均可编辑） -->
        <div class="message-actions">
          <button
            class="msg-action-btn"
            title="编辑消息"
            @click="startEditLocal"
          >
            ✏️
          </button>
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
 * 根据 role 渲染不同样式的气泡
 * 支持编辑用户消息、流式消息显示
 */
import type { ChatMessage } from '~/types'
import { useChat } from '~/composables/useChat'

const props = defineProps<{
  message: ChatMessage
}>()

const { editingMessageId, startEdit, cancelEdit, saveEdit, saveEditOnly } = useChat()

/** 是否正在编辑此条消息 */
const isEditing = computed(() => editingMessageId.value === props.message.id)

/** 编辑内容 */
const editContent = ref(props.message.content)

/** 编辑输入框 ref */
const editInputRef = ref<HTMLTextAreaElement | null>(null)

/** 渲染消息内容为 HTML（转义 + 换行 + 简单 Markdown） */
const renderedContent = computed(() => {
  return props.message.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
})

/** 开始编辑（本地触发） */
function startEditLocal() {
  editContent.value = props.message.content
  startEdit(props.message.id)
  nextTick(() => {
    editInputRef.value?.focus()
  })
}

/** 保存编辑 */
function handleSaveEdit() {
  if (!editContent.value.trim()) return
  saveEdit(props.message.id, editContent.value)
}

/** 仅保存编辑（不重发） */
function handleSaveEditOnly() {
  if (!editContent.value.trim()) return
  saveEditOnly(props.message.id, editContent.value)
}

/** 取消编辑 */
function handleCancelEdit() {
  cancelEdit()
}

// ==================== 右键 / 长按编辑 ====================

/** 长按计时器 */
let longPressTimer: ReturnType<typeof setTimeout> | null = null
/** 长按触发阈值（ms） */
const LONG_PRESS_MS = 500
/** 是否已触发长按（防止 touchend 后再次触发 click） */
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

function onTouchMove() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

/**
 * 格式化时间戳为 HH:MM 格式
 */
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
/* ---------- 消息容器 ---------- */
.chat-message {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 85%;
  animation: messageIn 0.3s ease;
}

@keyframes messageIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
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
}

.chat-message--user .message-body {
  align-items: flex-end;
}

/* ---------- 头像 ---------- */
.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  background: var(--color-bg-tertiary);
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

/* ---------- 消息气泡 ---------- */
.message-bubble {
  padding: 10px 14px;
  border-radius: 16px;
  position: relative;
}

/* AI 气泡 */
.chat-message--assistant .message-bubble {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border-top-left-radius: 4px;
}

/* 用户气泡（蓝色强调） */
.chat-message--user .message-bubble {
  background: var(--color-accent);
  color: #FFFFFF;
  border-top-right-radius: 4px;
}

/* ---------- 消息内容 ---------- */
.message-content {
  font-size: 0.95rem;
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
  gap: 6px;
  margin-bottom: 8px;
}

.message-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  object-fit: cover;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.2);
  transition: transform var(--transition-fast);
}
.message-image:hover {
  transform: scale(1.05);
}

/* ---------- 消息元信息 ---------- */
.message-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 4px;
}

.message-time {
  font-size: 0.7rem;
  opacity: 0.7;
}

.message-edited-tag {
  font-size: 0.65rem;
  opacity: 0.6;
  font-style: italic;
}

/* ---------- 消息操作按钮 ---------- */
.message-actions {
  display: flex;
  gap: 4px;
  margin-top: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.chat-message:hover .message-actions {
  opacity: 1;
}

/* 移动端（触摸设备）始终显示编辑按钮 */
@media (pointer: coarse) {
  .message-actions {
    opacity: 1;
  }
}

.msg-action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background var(--transition-fast);
}

.msg-action-btn:hover {
  background: var(--color-bg-tertiary);
}

/* ---------- 编辑模式 ---------- */
.message-edit-area {
  width: 100%;
  min-width: 260px;
}

.message-edit-input {
  width: 100%;
  padding: 8px 12px;
  border: 2px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-family: var(--font-sans);
  line-height: 1.5;
  resize: vertical;
  outline: none;
}

.message-edit-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  gap: 8px;
}

.edit-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.edit-btns {
  display: flex;
  gap: 6px;
}

.btn-edit-save-only,
.btn-edit-save,
.btn-edit-cancel {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  cursor: pointer;
  border: none;
  transition: all var(--transition-fast);
}

.btn-edit-save {
  background: var(--color-accent);
  color: #fff;
}

.btn-edit-save:hover {
  background: var(--color-accent-dark);
}

.btn-edit-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-edit-save-only {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-edit-save-only:hover {
  background: var(--color-accent-bg);
}

.btn-edit-save-only:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-edit-cancel {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.btn-edit-cancel:hover {
  background: var(--color-bg-hover);
}
</style>
