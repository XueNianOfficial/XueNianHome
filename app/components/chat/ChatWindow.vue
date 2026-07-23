<template>
  <!-- 聊天窗口编排层：工具栏 + 消息列表 + 输入区 -->
  <div class="chat-window card">
    <!-- 免责声明弹窗 -->
    <div v-if="showDisclaimer" class="modal-overlay">
      <div class="modal-card card disclaimer-modal">
        <h3 class="modal-title">📋 免责声明</h3>
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

    <!-- 会话列表抽屉 -->
    <ChatSessionList v-model="showSessions" />

    <!-- 顶部工具栏 -->
    <div class="chat-toolbar">
      <div class="toolbar-left">
        <button class="btn-ghost session-name-btn" title="会话列表" @click="showSessions = true">
          💬 {{ activeSession?.name || '对话' }}
        </button>
        <button class="icon-btn" title="新建对话" @click="handleCreateSession">＋</button>
      </div>

      <div class="toolbar-right">
        <select
          v-model="selectedPreset"
          class="preset-select"
          title="选择 AI 预设"
          @change="onPresetChange"
        >
          <option value="">默认</option>
          <option
            v-for="p in presets"
            :key="p.name"
            :value="p.name"
          >
            {{ p.name }}{{ p.supportsVision ? ' 🖼️' : '' }}{{ p.supportsAudio ? ' 🎤' : '' }}
          </option>
        </select>

        <!-- 能力开关：深度思考 / 联网搜索 / 画图 / 自定义提示词（按当前预设能力显示） -->
        <button
          v-if="supportsThinking"
          class="icon-btn"
          :class="{ active: activeSession?.enableThinking }"
          title="深度思考"
          @click="toggleThinking"
        >🧠</button>
        <button
          v-if="supportsWebSearch"
          class="icon-btn"
          :class="{ active: activeSession?.enableSearch }"
          title="联网搜索"
          @click="toggleSearch"
        >🌐</button>
        <button
          v-if="imageGenEnabled"
          class="icon-btn"
          :class="{ active: drawMode }"
          title="画图模式"
          @click="toggleDrawMode"
        >🎨</button>
        <div v-if="allowCustomSystemPrompt" class="prompt-btn-wrap">
          <button
            class="icon-btn"
            :class="{ active: !!activeSession?.customSystemPrompt }"
            title="提示词"
            @click="togglePromptPopover"
          >📝</button>
          <!-- 自定义系统提示词小弹层（仅本会话生效） -->
          <div v-if="showPromptPopover" class="prompt-popover">
            <p class="prompt-popover-desc">自定义系统提示词（仅本会话生效）</p>
            <textarea
              v-model="customPromptInput"
              class="prompt-popover-input"
              rows="4"
              placeholder="输入系统提示词…"
            ></textarea>
            <div class="prompt-popover-actions">
              <button class="btn-ghost btn-sm" @click="clearCustomPrompt">清除</button>
              <button class="btn-primary btn-sm" @click="saveCustomPrompt">保存</button>
            </div>
          </div>
        </div>

        <span v-if="hasMemory" class="badge" title="当前会话消息数">💾 {{ messages.length }} 条</span>
        <span
          v-if="sessionTokenUsage.total > 0"
          class="badge"
          :title="`Token 用量：输入 ${sessionTokenUsage.input} + 输出 ${sessionTokenUsage.output} = 总计 ${sessionTokenUsage.total}`"
        >🎯 {{ sessionTokenUsage.total }}</span>
        <button
          v-if="hasMemory"
          class="icon-btn"
          title="清除聊天记录"
          @click="handleClearMemory"
        >🗑️</button>
      </div>
    </div>

    <!-- 消息数量警告（800 条） -->
    <div v-if="messageLimitWarning && !messageLimitReached" class="limit-banner warning">
      ⚠️ 当前会话已有 {{ messages.length }} 条消息，建议开启新对话以免达到 1000 条上限。
    </div>

    <!-- 滚动窗口模式提示 -->
    <div v-if="slidingWindowActive" class="limit-banner info">
      🔄 滚动窗口模式：仅保留最近 400 条消息作为 AI 上下文，早期对话记忆已被裁剪，AI 可能遗忘之前的记忆。
    </div>

    <!-- 消息数量上限（1000 条）— 未启用滚动窗口时显示选择 -->
    <div v-if="messageLimitReached && !slidingWindowActive" class="limit-banner danger">
      <p>🚫 当前会话已达到 1000 条消息上限。</p>
      <p class="limit-hint">AI 可能因上下文过长而遗忘早期记忆。你可以：</p>
      <div class="limit-actions">
        <button class="btn-primary btn-sm" @click="handleCreateSession">创建新对话</button>
        <button class="btn-outline btn-sm" @click="handleActivateSlidingWindow">
          继续对话（裁剪旧记忆）
        </button>
      </div>
      <p class="limit-note">选择「继续对话」将仅保留最近 400 条消息发送给 AI，早期对话记忆将被忽略。</p>
    </div>

    <!-- 消息列表 -->
    <div ref="messagesContainer" class="chat-messages" @scroll="onScroll">
      <ChatWelcome v-if="messages.length === 0 && !isLoading" />

      <ChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />

      <!-- 流式状态指示：深度思考 / 联网搜索进行中 -->
      <div v-if="streamingReasoning" class="stream-status">💭 思考中…</div>
      <div v-if="isLoading && streamSearched" class="stream-status">🌐 正在联网搜索…</div>

      <!-- 流式预览气泡：显示正在生成的内容（已经过标签过滤） -->
      <div v-if="isLoading && streamingPreview" class="stream-preview">
        <img :src="streamAvatar" alt="AI 头像" class="stream-avatar" @error="onAvatarError" />
        <div class="stream-bubble">
          <span class="stream-text">{{ streamingPreview }}</span>
          <span class="stream-cursor">▍</span>
        </div>
      </div>

      <!-- 思考中指示器 -->
      <div v-if="isLoading" class="chat-loading">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
        <span class="loading-text">{{ loadingText }}</span>
      </div>

      <!-- 错误提示 + 重试 -->
      <div v-if="error" class="chat-error">
        <p class="error-text">😢 {{ error }}</p>
        <div class="error-actions">
          <button class="btn-primary btn-sm" @click="handleRetry">重试</button>
          <button class="btn-ghost btn-sm" @click="clearError">关闭</button>
        </div>
      </div>
    </div>

    <!-- 回到底部悬浮按钮 -->
    <Transition name="fade">
      <button
        v-if="!stickToBottom"
        class="back-to-bottom"
        title="回到底部"
        @click="scrollToBottom(true)"
      >↓</button>
    </Transition>

    <!-- 输入区 -->
    <ChatInput @sent="scrollToBottom(true)" />
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  ChatWindow - 聊天窗口编排层
 *  - 组合 ChatSessionList / ChatMessage / ChatWelcome / ChatInput
 *  - 负责：预设切换、免责声明、消息上限横幅、滚动管理、错误重试
 *  - 工具栏能力开关：深度思考 / 联网搜索 / 画图模式 / 自定义系统提示词
 * ============================================================
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useChat } from '~/composables/useChat'
import ChatMessage from '~/components/chat/ChatMessage.vue'
import ChatWelcome from '~/components/chat/ChatWelcome.vue'
import ChatInput from '~/components/chat/ChatInput.vue'
import ChatSessionList from '~/components/chat/ChatSessionList.vue'

const {
  activeSessionId,
  activeSession,
  messages,
  isLoading,
  streamingPreview,
  error,
  presets,
  currentPreset,
  currentPresetAvatar,
  hasMemory,
  sessionTokenUsage,
  messageLimitWarning,
  messageLimitReached,
  slidingWindowActive,
  createSession,
  clearMemory,
  activateSlidingWindow,
  loadPresets,
  selectPreset,
  sendMessageAfterEdit,
  clearError,
  streamingReasoning,
  streamSearched,
  drawMode,
  supportsThinking,
  supportsWebSearch,
  allowCustomSystemPrompt,
  imageGenEnabled,
  toggleThinking,
  toggleSearch,
  setCustomSystemPrompt,
  toggleDrawMode,
} = useChat()

// ==================== 预设切换 ====================

/** 本地选中的预设（空字符串 = 默认预设） */
const selectedPreset = ref('')

watch(currentPreset, (val) => {
  selectedPreset.value = val
})

function onPresetChange() {
  selectPreset(selectedPreset.value)
}

// ==================== 会话操作 ====================

const showSessions = ref(false)

function handleCreateSession() {
  createSession()
  selectedPreset.value = ''
  scrollToBottom(true)
}

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

// ==================== 自定义系统提示词弹层 ====================

/** 提示词弹层是否展开 */
const showPromptPopover = ref(false)
/** 弹层中的提示词草稿（点击保存时才写回会话） */
const customPromptInput = ref('')

/** 切换弹层展开状态；展开时同步当前会话已保存的提示词 */
function togglePromptPopover() {
  showPromptPopover.value = !showPromptPopover.value
  if (showPromptPopover.value) {
    customPromptInput.value = activeSession.value?.customSystemPrompt || ''
  }
}

/** 保存自定义系统提示词并关闭弹层 */
function saveCustomPrompt() {
  setCustomSystemPrompt(customPromptInput.value)
  showPromptPopover.value = false
}

/** 清除自定义系统提示词并关闭弹层 */
function clearCustomPrompt() {
  setCustomSystemPrompt('')
  showPromptPopover.value = false
}

// ==================== 错误重试 ====================

/** 基于现有消息列表重新发起流式请求（不新增用户消息） */
function handleRetry() {
  clearError()
  sendMessageAfterEdit()
}

// ==================== 滚动管理 ====================

const messagesContainer = ref<HTMLElement | null>(null)

/** 是否贴在底部（距底 < 80px 视为贴底） */
const stickToBottom = ref(true)

function onScroll() {
  const el = messagesContainer.value
  if (!el) return
  stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

/**
 * 滚动到底部
 * @param smooth 是否平滑滚动
 */
function scrollToBottom(smooth = false) {
  stickToBottom.value = true
  nextTick(() => {
    const el = messagesContainer.value
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  })
}

// 新消息到达时，仅在贴底状态下跟随滚动（用户上翻阅读时不打扰）
watch(() => messages.value.length, () => {
  if (stickToBottom.value) scrollToBottom()
})

// 流式内容增长时同理跟随
watch(streamingPreview, () => {
  if (stickToBottom.value) scrollToBottom()
})

// 切换会话后强制滚到底部
watch(activeSessionId, () => {
  scrollToBottom()
})

// ==================== 加载态与头像 ====================

const loadingText = computed(() =>
  currentPreset.value ? `${currentPreset.value} 正在思考...` : '雪年正在思考...'
)

const DEFAULT_AVATAR = '/images/头像.png'
const streamAvatar = computed(() => currentPresetAvatar.value || DEFAULT_AVATAR)

/** 头像加载失败时回退默认头像 */
function onAvatarError(e: Event) {
  const img = e.target as HTMLImageElement
  if (img && !img.src.endsWith(DEFAULT_AVATAR)) {
    img.src = DEFAULT_AVATAR
  }
}

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

// ==================== 生命周期 ====================

onMounted(() => {
  loadPresets()
  selectedPreset.value = currentPreset.value
  scrollToBottom()
  checkDisclaimer()
})
</script>

<style scoped>
.chat-window {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 0;
}

/* 顶部工具栏 */
.chat-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.session-name-btn {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-sm);
}

.preset-select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--text-xs);
  cursor: pointer;
  max-width: 140px;
}

/* 工具栏能力开关激活态（icon-btn 全局类无激活样式，在此补充） */
.toolbar-right .icon-btn.active {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

/* 自定义提示词按钮与弹层 */
.prompt-btn-wrap {
  position: relative;
}

.prompt-popover {
  position: absolute;
  top: calc(100% + var(--space-xs));
  right: 0;
  width: 260px;
  padding: var(--space-sm);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: var(--z-dropdown);
}

.prompt-popover-desc {
  margin: 0 0 var(--space-xs);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.prompt-popover-input {
  width: 100%;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: var(--text-xs);
  font-family: var(--font-sans);
  line-height: 1.5;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}

.prompt-popover-input:focus {
  border-color: var(--color-accent);
}

.prompt-popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
}

/* 流式状态小指示（思考中 / 联网搜索） */
.stream-status {
  font-size: var(--text-xs);
  font-style: italic;
  color: var(--color-text-muted);
  padding-left: var(--space-xs);
}

/* 消息上限横幅 */
.limit-banner {
  flex-shrink: 0;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-xs);
  line-height: 1.6;
}

.limit-banner.warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.limit-banner.info {
  background: var(--color-accent-bg);
  color: var(--color-accent-dark);
}

.limit-banner.danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.limit-banner p {
  margin: 0 0 var(--space-xs);
}

.limit-hint,
.limit-note {
  opacity: 0.85;
}

.limit-actions {
  display: flex;
  gap: var(--space-sm);
  margin: var(--space-xs) 0;
}

/* 消息列表 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

/* 流式预览气泡（与 AI 气泡同风格） */
.stream-preview {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  animation: fade-in var(--transition-base) both;
}

.stream-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid var(--color-accent-bg);
}

.stream-bubble {
  max-width: 75%;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  border-top-left-radius: var(--radius-sm);
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--color-text-primary);
  word-break: break-word;
  white-space: pre-wrap;
}

.stream-cursor {
  color: var(--color-accent);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 思考中指示器（三点脉冲，复用全局 pulse-dot 关键帧） */
.chat-loading {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
}

.typing-indicator {
  display: flex;
  gap: 4px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  animation: pulse-dot 1.2s ease-in-out infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

.loading-text {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* 错误提示 */
.chat-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--color-danger-bg);
  border-radius: var(--radius-md);
  animation: fade-in-up var(--transition-base) both;
}

.error-text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-danger);
}

.error-actions {
  display: flex;
  gap: var(--space-sm);
}

/* 回到底部悬浮按钮 */
.back-to-bottom {
  position: absolute;
  right: var(--space-md);
  bottom: 96px;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: var(--text-base);
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-fast);
  z-index: 1;
}

.back-to-bottom:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-base);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 免责声明弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-bg-mask);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-md);
}

.modal-card {
  width: 100%;
  max-width: 420px;
  padding: var(--space-lg);
  animation: fade-in-up var(--transition-base) both;
}

.modal-title {
  margin: 0 0 var(--space-md);
  font-size: var(--text-base);
  color: var(--color-text-primary);
}

.disclaimer-body {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin-bottom: var(--space-md);
}

.disclaimer-body p {
  margin: 0 0 var(--space-sm);
}

.disclaimer-body ul {
  margin: 0;
  padding-left: var(--space-lg);
}

.disclaimer-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  margin-bottom: var(--space-md);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}

@media (max-width: 640px) {
  .chat-messages {
    padding: var(--space-sm);
  }

  .session-name-btn {
    max-width: 120px;
  }

  .preset-select {
    max-width: 110px;
  }
}
</style>
