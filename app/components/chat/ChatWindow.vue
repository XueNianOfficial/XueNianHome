<!--
============================================================
  雪年个人网站 - AI 聊天窗口（多会话版）
  消息列表 + 输入框 + 发送按钮
  支持：会话管理、图片粘贴/上传、音频录制、预设过滤
============================================================
-->
<template>
  <div class="chat-window card">
    <!-- 免责声明弹窗 -->
    <div v-if="showDisclaimer" class="modal-overlay">
      <div class="modal card disclaimer-modal">
        <h3>📋 免责声明</h3>
        <div class="disclaimer-body">
          <p>本聊天功能由 AI 模型驱动，AI 生成内容不代表本站立场。</p>
          <ul>
            <li>请勿输入个人隐私信息（如密码、身份证号等）</li>
            <li>AI 回复仅供参考，不构成任何建议</li>
            <li>聊天记录仅保存 7 天，过期自动删除</li>
          </ul>
        </div>
        <label class="disclaimer-checkbox">
          <input type="checkbox" v-model="disclaimerDontShowAgain" />
          <span>不再提示</span>
        </label>
        <div class="modal-actions">
          <button class="btn-primary" @click="acceptDisclaimer">我知道了</button>
        </div>
      </div>
    </div>

    <!-- 会话侧栏 -->
    <div v-if="showSessions" class="chat-sessions-overlay" @click.self="showSessions = false">
      <div class="chat-sessions-panel card">
        <div class="sessions-header">
          <h3>💬 会话列表</h3>
          <button class="btn-close" @click="showSessions = false">✕</button>
        </div>
        <button class="btn-primary btn-full" @click="handleCreateSession">
          + 创建新对话
        </button>
        <div class="sessions-list">
          <div
            v-for="session in sessions"
            :key="session.id"
            class="session-item"
            :class="{ active: session.id === activeSessionId }"
            @click="handleSwitchSession(session.id)"
          >
            <div class="session-info">
              <span class="session-name">{{ session.name }}</span>
              <span class="session-meta">{{ session.messages.length }} 条 · {{ formatDate(session.lastActiveAt) }}</span>
            </div>
            <div class="session-actions">
              <button class="btn-icon-sm" title="重命名" @click.stop="startRename(session)">✏️</button>
              <button
                v-if="sessions.length > 1"
                class="btn-icon-sm btn-danger-icon"
                title="删除"
                @click.stop="handleDeleteSession(session.id)"
              >🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 顶部工具栏 -->
    <div class="chat-toolbar">
      <div class="toolbar-left">
        <button class="btn-sessions" title="会话列表" @click="showSessions = !showSessions">
          💬 {{ activeSession?.name || '对话' }}
        </button>
        <button class="btn-new-chat" title="新建对话" @click="handleCreateSession">＋</button>
      </div>

      <div class="toolbar-right">
        <div class="preset-selector">
          <select
            v-model="selectedPreset"
            class="preset-select"
            @change="onPresetChange"
          >
            <option value="">默认</option>
            <option
              v-for="p in presets"
              :key="p.name"
              :value="p.name"
            >
              {{ p.name }}
              {{ p.supportsVision ? '🖼️' : '' }}
              {{ p.supportsAudio ? '🎤' : '' }}
            </option>
          </select>
        </div>

        <div class="memory-controls">
          <span v-if="hasMemory" class="memory-indicator" title="有聊天记录">💾 {{ messages.length }} 条</span>
          <span
            v-if="sessionTokenUsage.total > 0"
            class="token-indicator"
            title="Token 用量：输入 {{ sessionTokenUsage.input }} + 输出 {{ sessionTokenUsage.output }} = 总计 {{ sessionTokenUsage.total }}"
          >
            🎯 {{ sessionTokenUsage.total }}
          </span>
          <button
            v-if="hasMemory"
            class="btn-memory"
            title="清除聊天记录"
            @click="handleClearMemory"
          >🗑️</button>
        </div>
      </div>
    </div>

    <!-- 消息数量警告（800 条） -->
    <div v-if="messageLimitWarning && !messageLimitReached" class="chat-limit-warning">
      ⚠️ 当前会话已有 {{ messages.length }} 条消息，建议开启新对话以免达到 1000 条上限。
    </div>

    <!-- 滚动窗口模式提示 -->
    <div v-if="slidingWindowActive" class="chat-limit-info">
      🔄 滚动窗口模式：仅保留最近 400 条消息作为 AI 上下文，早期对话记忆已被裁剪，AI 可能遗忘之前的记忆。
    </div>

    <!-- 消息数量上限（1000 条）— 未启用滚动窗口时显示选择 -->
    <div v-if="messageLimitReached && !slidingWindowActive" class="chat-limit-reached">
      <p>🚫 当前会话已达到 1000 条消息上限。</p>
      <p class="chat-limit-hint">AI 可能因上下文过长而遗忘早期记忆。你可以：</p>
      <div class="chat-limit-actions">
        <button class="btn-primary" @click="handleCreateSession">创建新对话</button>
        <button class="btn-outline" @click="handleActivateSlidingWindow">
          继续对话（裁剪旧记忆）
        </button>
      </div>
      <p class="chat-limit-note">选择「继续对话」将仅保留最近 400 条消息发送给 AI，早期对话记忆将被忽略。</p>
    </div>

    <!-- 消息列表 -->
    <div ref="messagesContainer" class="chat-messages">
      <div v-if="messages.length === 0" class="chat-welcome">
        <img :src="welcomeAvatar" alt="AI 头像" class="about-avatar" width="180" height="180" @error="onWelcomeAvatarError">
        <h3>你好，这里是雪年！</h3>
        <p>一只热爱艺术与代码的小狼，很高兴认识你～<br />有什么想聊的吗？</p>
        <div class="welcome-prompts">
          <button
            v-for="prompt in quickPrompts"
            :key="prompt"
            class="prompt-btn"
            @click="sendMessage(prompt)"
          >{{ prompt }}</button>
        </div>
      </div>

      <ChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />

      <!-- 流式传输中：仅显示思考指示器（不泄露未完成文本） -->
      <div v-if="isLoading" class="chat-loading">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
        <span class="loading-text">雪年正在思考...</span>
      </div>

      <div v-if="error" class="chat-error">
        <p>😢 {{ error }}</p>
        <button class="btn-outline" @click="clearError">关闭</button>
      </div>
    </div>

    <!-- 待发送图片预览 -->
    <div v-if="pendingImages.length > 0" class="pending-images">
      <div v-for="(img, idx) in pendingImages" :key="idx" class="pending-img-wrap">
        <img :src="img" class="pending-img" alt="待发送图片" />
        <button class="pending-img-remove" @click="removePendingImage(idx)">✕</button>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="chat-input-area">
      <button
        v-if="supportsVision"
        class="btn-input-action"
        title="上传图片"
        @click="triggerImageUpload"
        :disabled="isLoading || sendBlocked"
      >🖼️</button>

      <button
        v-if="supportsAudio"
        class="btn-input-action"
        :class="{ recording: isRecording }"
        title="按住录音，松手停止"
        :disabled="isLoading || sendBlocked"
        @mousedown.prevent="startRecording"
        @mouseup.prevent="stopRecording"
        @mouseleave="cancelRecording"
        @touchstart.prevent="startRecording"
        @touchend.prevent="stopRecording"
        @touchcancel="cancelRecording"
      >{{ isRecording ? '🎤' : '🎤' }}</button>

      <textarea
        ref="inputRef"
        v-model="inputText"
        class="chat-input"
        :placeholder="sendBlocked ? '已达到 1000 条消息上限，请选择处理方式' : '输入消息，和雪年聊天...（支持粘贴图片）'"
        :disabled="isLoading || sendBlocked"
        rows="2"
        @keydown.enter.exact.prevent="handleSend"
        @keydown.enter.shift.exact="inputText += '\n'"
        @paste="handlePaste"
      ></textarea>

      <button
        class="btn-primary chat-send-btn"
        :disabled="!inputText.trim() || isLoading || sendBlocked"
        @click="handleSend"
      >
        <span v-if="!isLoading">发送</span>
        <span v-else class="sending-dot">...</span>
      </button>
    </div>

    <!-- 隐藏的图片上传 input -->
    <input
      ref="imageInputRef"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      class="file-input-hidden"
      multiple
      @change="handleImageUpload"
    />

    <!-- 重命名对话框 -->
    <div v-if="renamingSession" class="modal-overlay" @click.self="renamingSession = null">
      <div class="modal card modal-sm">
        <h3>重命名会话</h3>
        <input
          v-model="renameText"
          class="form-input"
          placeholder="输入新名称"
          @keydown.enter="confirmRename"
        />
        <div class="modal-actions">
          <button class="btn-outline" @click="renamingSession = null">取消</button>
          <button class="btn-primary" @click="confirmRename" :disabled="!renameText.trim()">确定</button>
        </div>
      </div>
    </div>
    <!-- 音频确认对话框 -->
    <div v-if="showAudioConfirm" class="modal-overlay" @click.self="cancelAudio">
      <div class="modal card audio-confirm-modal">
        <h3>🎤 语音消息</h3>
        <p class="audio-duration">录音时长：{{ audioDuration }}</p>
        <audio
          v-if="audioBlobUrl"
          ref="audioPlayerRef"
          :src="audioBlobUrl"
          controls
          class="audio-player"
        ></audio>
        <div class="modal-actions">
          <button class="btn-outline" @click="cancelAudio">取消</button>
          <button class="btn-primary" @click="sendAudio">发送</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ChatWindow - AI 聊天窗口主组件（多会话版）
 * 支持：会话管理、图片粘贴/上传、音频录制、预设过滤
 */
import { useChat } from '~/composables/useChat'
import type { ChatSession } from '~/types'

const {
  sessions, activeSessionId, activeSession,
  messages, isLoading, error,
  sendMessage, clearError, clearMemory,
  presets, currentPreset, currentPresetAvatar, presetsLoaded,
  loadPresets, selectPreset,
  supportsVision, supportsAudio,
  hasMemory, sessionTokenUsage,
  messageLimitWarning, messageLimitReached,
  slidingWindowActive, sendBlocked, activateSlidingWindow,
  pendingImages,
  createSession, switchSession, deleteSession, renameSession,
  addPendingImage, removePendingImage, clearPendingImages
} = useChat()

const inputText = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)

const showSessions = ref(false)
const renamingSession = ref<ChatSession | null>(null)
const renameText = ref('')

const selectedPreset = ref(currentPreset.value)

/** 欢迎页使用的头像（预设头像 > 默认头像） */
const welcomeAvatar = computed(() => currentPresetAvatar.value || '/images/头像.png')

/** 欢迎页头像加载失败时回退 */
function onWelcomeAvatarError(e: Event) {
  const img = e.target as HTMLImageElement
  if (img && img.src !== '/images/头像.png') {
    img.src = '/images/头像.png'
  }
}

const quickPrompts = [
  '你好呀，介绍一下你自己吧！',
  '你平时喜欢画什么样的作品？',
  '可以给我讲个故事吗？',
  '有什么推荐的 furry 画师吗？'
]

// ==================== 免责声明弹窗 ====================

const DISCLAIMER_KEY = 'xuenian_disclaimer_accepted'

const showDisclaimer = ref(false)
const disclaimerDontShowAgain = ref(false)

function checkDisclaimer() {
  if (import.meta.server) return
  try {
    const accepted = localStorage.getItem(DISCLAIMER_KEY)
    if (!accepted) {
      showDisclaimer.value = true
    }
  } catch { /* 忽略 */ }
}

function acceptDisclaimer() {
  if (disclaimerDontShowAgain.value) {
    try {
      localStorage.setItem(DISCLAIMER_KEY, '1')
    } catch { /* 忽略 */ }
  }
  showDisclaimer.value = false
}

// ==================== 会话操作 ====================

function handleCreateSession() {
  createSession()
  selectedPreset.value = ''
  showSessions.value = false
  scrollToBottom()
}

function handleSwitchSession(id: string) {
  switchSession(id)
  selectedPreset.value = currentPreset.value
  showSessions.value = false
  scrollToBottom()
}

function handleDeleteSession(id: string) {
  if (sessions.value.length <= 1) return
  if (confirm('确定要删除这个会话吗？')) {
    deleteSession(id)
    selectedPreset.value = currentPreset.value
  }
}

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

// ==================== 预设 ====================

function onPresetChange() {
  selectPreset(selectedPreset.value)
}

// ==================== 消息发送 ====================

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return
  inputText.value = ''
  await sendMessage(text)
  scrollToBottom()
}

// ==================== 图片处理 ====================

function triggerImageUpload() {
  imageInputRef.value?.click()
}

async function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files) return
  for (const file of files) {
    const dataUrl = await fileToDataUrl(file)
    if (dataUrl) addPendingImage(dataUrl)
  }
  input.value = ''
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

function handlePaste(e: ClipboardEvent) {
  if (!supportsVision.value) return
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) {
        fileToDataUrl(file).then(dataUrl => {
          if (dataUrl) addPendingImage(dataUrl)
        })
      }
    }
  }
}

// ==================== 录音状态 ====================

const isRecording = ref(false)
const showAudioConfirm = ref(false)
const audioBlobUrl = ref('')
const audioPlayerRef = ref<HTMLAudioElement | null>(null)
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let recordingStartTime = 0

const audioDuration = computed(() => {
  if (!recordingStartTime) return '0 秒'
  const seconds = Math.round((Date.now() - recordingStartTime) / 1000)
  return `${seconds} 秒`
})

// ==================== 音频录制 ====================

async function startRecording() {
  if (isLoading.value || isRecording.value) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioChunks = []
    recordingStartTime = Date.now()
    mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' })
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data)
    }
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      // 生成音频 blob 用于回放
      const mimeType = mediaRecorder?.mimeType || 'audio/webm'
      const blob = new Blob(audioChunks, { type: mimeType })
      if (audioBlobUrl.value) URL.revokeObjectURL(audioBlobUrl.value)
      audioBlobUrl.value = URL.createObjectURL(blob)
      // 弹出确认窗口
      showAudioConfirm.value = true
      nextTick(() => {
        audioPlayerRef.value?.load()
      })
    }
    mediaRecorder.start()
    isRecording.value = true
  } catch (e) {
    console.error('录音失败：', e)
    alert('无法访问麦克风，请检查浏览器权限设置。')
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }
  isRecording.value = false
}

/** 鼠标移出按钮时取消录音（不弹出确认框） */
function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    // 停止但不触发 onstop 中的确认框
    mediaRecorder.onstop = () => {
      if (mediaRecorder) {
        mediaRecorder.stream.getTracks().forEach(t => t.stop())
      }
    }
    mediaRecorder.stop()
  }
  isRecording.value = false
}

/** 取消发送音频 */
function cancelAudio() {
  showAudioConfirm.value = false
  if (audioBlobUrl.value) {
    URL.revokeObjectURL(audioBlobUrl.value)
    audioBlobUrl.value = ''
  }
  audioChunks = []
}

/** 发送音频 — 当前附加 [🎤 语音消息] 标记 */
async function sendAudio() {
  showAudioConfirm.value = false
  const blobUrl = audioBlobUrl.value
  if (blobUrl) {
    inputText.value = (inputText.value + ' [🎤 语音消息]').trim()
    URL.revokeObjectURL(blobUrl)
    audioBlobUrl.value = ''
  }
  audioChunks = []
}

// ==================== 工具 ====================

function handleClearMemory() {
  if (confirm('确定要清除当前会话的所有聊天记录吗？此操作不可撤销。')) {
    clearMemory()
  }
}

function handleActivateSlidingWindow() {
  if (confirm('启用滚动窗口模式后，AI 将只能看到最近 400 条消息，早期对话记忆会被遗忘。确定继续吗？')) {
    activateSlidingWindow()
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

watch(() => messages.value.length, () => scrollToBottom())
watch(currentPreset, (val) => { selectedPreset.value = val })

onMounted(() => {
  loadPresets()
  selectedPreset.value = currentPreset.value
  scrollToBottom()
  checkDisclaimer()
})
</script>

<style scoped>
/* ---------- 聊天窗口 ---------- */
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;
}

/* ---------- 会话侧栏 ---------- */
.chat-sessions-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgba(0,0,0,0.3);
  display: flex;
  justify-content: flex-start;
}

.chat-sessions-panel {
  width: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  padding: 16px;
  overflow-y: auto;
}

.sessions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.sessions-header h3 { margin: 0; font-size: 1rem; }

.btn-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 2px 6px;
}

.btn-full { width: 100%; margin-bottom: 12px; }

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  border: 1px solid transparent;
}
.session-item:hover { background: var(--color-bg-secondary); }
.session-item.active {
  background: var(--color-accent-bg);
  border-color: var(--color-accent-light);
}

.session-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.session-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.session-meta {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.session-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.btn-icon-sm {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 2px 4px;
  color: var(--color-text-muted);
}
.btn-icon-sm:hover { color: var(--color-text-primary); }
.btn-danger-icon:hover { color: #DC2626; }

/* ---------- 顶部工具栏 ---------- */
.chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-sessions {
  padding: 4px 10px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: 0.82rem;
  cursor: pointer;
  font-family: var(--font-sans);
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all var(--transition-fast);
}
.btn-sessions:hover { background: var(--color-accent-bg); border-color: var(--color-accent-light); }

.btn-new-chat {
  width: 28px;
  height: 28px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity var(--transition-fast);
}
.btn-new-chat:hover { opacity: 0.85; }

.preset-selector {
  display: flex;
  align-items: center;
  gap: 6px;
}

.preset-select {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 0.82rem;
  font-family: var(--font-sans);
  cursor: pointer;
  outline: none;
  max-width: 180px;
  transition: border-color var(--transition-fast);
}
.preset-select:focus { border-color: var(--color-accent); }

.memory-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.memory-indicator {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.token-indicator {
  font-size: 0.72rem;
  color: var(--color-primary);
  white-space: nowrap;
  cursor: help;
  border-bottom: 1px dotted var(--color-primary);
}

.btn-memory {
  padding: 3px 8px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: all var(--transition-fast);
}
.btn-memory:hover { background: #FEF2F2; border-color: #FECACA; color: #DC2626; }
html.dark .btn-memory:hover { background: #3B1111; border-color: #7F1D1D; }

/* ---------- 消息列表 ---------- */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-welcome {
  text-align: center;
  padding: 40px 20px;
}

.about-avatar { border-radius: 50%; }

.chat-welcome h3 {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.chat-welcome p {
  color: var(--color-text-secondary);
  margin-bottom: 24px;
  line-height: 1.7;
}

.welcome-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.prompt-btn {
  padding: 8px 16px;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.9rem;
  font-family: var(--font-sans);
  transition: all var(--transition-fast);
}
.prompt-btn:hover { background: var(--color-accent-bg); color: var(--color-accent); border-color: var(--color-accent-light); }

.chat-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}

.typing-indicator { display: flex; gap: 4px; }
.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: typingBounce 1.4s ease-in-out infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typingBounce {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-6px); }
}

.loading-text { font-size: 0.9rem; color: var(--color-text-muted); }

.chat-error {
  text-align: center;
  padding: 12px;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: var(--radius-sm);
  color: #DC2626;
  font-size: 0.9rem;
}
html.dark .chat-error { background: #3B1111; border-color: #7F1D1D; }
.chat-error p { margin: 0 0 8px; }

/* ---------- 消息数量警告 / 上限 ---------- */
.chat-limit-warning {
  text-align: center;
  padding: 10px 16px;
  margin: 0 16px 4px;
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  border-radius: var(--radius-sm);
  color: #92400E;
  font-size: 0.82rem;
}
html.dark .chat-limit-warning { background: #292312; border-color: #78350F; color: #FCD34D; }

.chat-limit-reached {
  text-align: center;
  padding: 16px;
  margin: 8px 16px;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: var(--radius-sm);
  color: #DC2626;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
html.dark .chat-limit-reached { background: #3B1111; border-color: #7F1D1D; }
.chat-limit-reached .btn-sm {
  padding: 6px 16px;
  font-size: 0.82rem;
}

.chat-limit-reached .chat-limit-hint {
  margin: 0;
}

.chat-limit-reached .chat-limit-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.chat-limit-reached .chat-limit-note {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* 滚动窗口模式提示 */
.chat-limit-info {
  text-align: center;
  padding: 10px 16px;
  margin: 0 16px 4px;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: var(--radius-sm);
  color: #1E40AF;
  font-size: 0.82rem;
}
html.dark .chat-limit-info { background: #1E293B; border-color: #334155; color: #93C5FD; }

/* ---------- 待发送图片 ---------- */
.pending-images {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  overflow-x: auto;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.pending-img-wrap {
  position: relative;
  flex-shrink: 0;
}

.pending-img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.pending-img-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #DC2626;
  color: #fff;
  border: none;
  font-size: 0.7rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---------- 输入区域 ---------- */
.chat-input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.btn-input-action {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}
.btn-input-action:hover { background: var(--color-accent-bg); border-color: var(--color-accent-light); }
.btn-input-action.recording {
  background: #DC2626;
  color: #fff;
  border-color: #DC2626;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
}

.chat-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-family: var(--font-sans);
  resize: none;
  outline: none;
  transition: border-color var(--transition-fast);
}
.chat-input:focus { border-color: var(--color-accent); }
.chat-input:disabled { opacity: 0.6; cursor: not-allowed; }

.chat-send-btn {
  flex-shrink: 0;
  padding: 8px 16px;
  height: 38px;
}

.sending-dot { letter-spacing: 2px; }

.file-input-hidden { display: none; }

/* 模态框 */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal { padding: 24px; max-width: 400px; width: 90%; }
.modal-sm { max-width: 360px; }
.modal h3 { margin: 0 0 12px; font-size: 1.1rem; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-family: var(--font-sans);
  outline: none;
}
.form-input:focus { border-color: var(--color-accent); }

/* 音频确认弹窗 */
.audio-confirm-modal {
  max-width: 380px;
  text-align: center;
}

.audio-duration {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0 0 12px;
}

.audio-player {
  width: 100%;
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
}

.audio-player:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* 免责声明弹窗 */
.disclaimer-modal {
  max-width: 440px;
}

.disclaimer-body {
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--color-text-secondary);
}

.disclaimer-body p {
  margin: 0 0 8px;
}

.disclaimer-body ul {
  margin: 0;
  padding-left: 20px;
}

.disclaimer-body li {
  margin-bottom: 4px;
}

.disclaimer-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.disclaimer-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .chat-toolbar { padding: 8px 10px; }
  .chat-sessions-panel { width: 100%; }
  .preset-select { max-width: 120px; }
  .chat-messages { padding: 12px; }
  .chat-input-area { padding: 12px; gap: 8px; }
  .chat-send-btn { padding: 8px 16px; font-size: 0.85rem; }
}
</style>
