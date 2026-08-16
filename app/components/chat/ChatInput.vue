<template>
  <!-- 聊天输入区：图片预览条 + 工具按钮 + 自动增高输入框 + 发送 -->
  <div class="chat-input">
    <!-- 待发送图片预览条 -->
    <div v-if="pendingImages.length > 0" class="pending-images">
      <div v-for="(img, idx) in pendingImages" :key="idx" class="pending-img-wrap">
        <img :src="img" alt="待发送图片" class="pending-img" />
        <button
          class="pending-img-remove"
          title="移除图片"
          @click="removePendingImage(idx)"
        >✕</button>
      </div>
    </div>

    <div class="input-row">
      <!-- 图片上传按钮（仅视觉模型可用） -->
      <button
        v-if="supportsVision"
        class="icon-btn tool-btn"
        title="发送图片"
        :disabled="isLoading"
        @click="triggerImageUpload"
      >🖼️</button>
      <input
        ref="imageInputRef"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        class="hidden-input"
        @change="handleImageUpload"
      />

      <!-- 录音按钮（仅音频模型可用，按住录音） -->
      <button
        v-if="supportsAudio"
        class="icon-btn tool-btn"
        :class="{ recording: isRecording }"
        title="按住录音"
        :disabled="isLoading"
        @mousedown.prevent="startRecording"
        @mouseup.prevent="stopRecording"
        @mouseleave="cancelRecording"
        @touchstart.prevent="startRecording"
        @touchend.prevent="stopRecording"
        @touchcancel="cancelRecording"
      >🎤</button>

      <!-- 消息输入框：Enter 发送，Shift+Enter 换行 -->
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="input message-input"
        rows="1"
        :placeholder="placeholder"
        :disabled="isLoading"
        @keydown.enter.exact.prevent="handleSend"
        @paste="handlePaste"
        @input="autoResize"
      ></textarea>

      <!-- 发送按钮 -->
      <button
        class="btn-primary send-btn"
        :disabled="!inputText.trim() || isLoading || sendBlocked"
        @click="handleSend"
      >
        <span v-if="isLoading" class="loading-spinner"></span>
        <span v-else-if="drawMode">🎨</span>
        <span v-else>发送</span>
      </button>
    </div>

    <div class="input-hint">Enter 发送 · Shift+Enter 换行</div>

    <!-- 录音确认弹窗 -->
    <div v-if="showAudioConfirm" class="modal-overlay" @click.self="cancelAudio">
      <div class="modal-card card">
        <h3 class="modal-title">🎤 语音消息</h3>
        <p class="modal-desc">时长约 {{ audioDuration }}，确认发送这段语音吗？</p>
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
 * ============================================================
 *  ChatInput - 聊天输入区组件
 *  - 自动增高的多行输入框（Enter 发送 / Shift+Enter 换行）
 *  - 图片上传（仅视觉模型）：按钮选择 + 粘贴板粘贴，预览条可移除
 *  - 语音录制（仅音频模型）：按住录音，松开弹出确认窗回放后发送
 *  - 画图模式：drawMode 下输入提示语与发送按钮图标随之切换
 * ============================================================
 */
import { computed, nextTick, ref } from 'vue'
import { useChat } from '~/composables/useChat'

const emit = defineEmits<{
  /** 消息已发出（父组件用于滚动到底部） */
  (e: 'sent'): void
}>()

const {
  isLoading,
  sendBlocked,
  supportsVision,
  supportsAudio,
  pendingImages,
  drawMode,
  addPendingImage,
  removePendingImage,
  sendMessage,
} = useChat()

// ==================== 输入框 ====================

const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const placeholder = computed(() => {
  if (sendBlocked.value) return '当前会话消息过多，请先创建新对话或裁剪旧记忆'
  if (drawMode.value) return '描述想画的画面…'
  return supportsVision.value ? '输入消息，可直接粘贴图片…' : '输入消息…'
})

/** 输入框随内容自动增高，超过约 6 行后出滚动条 */
const INPUT_MAX_HEIGHT = 140
function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`
}

function resetInput() {
  inputText.value = ''
  nextTick(() => {
    const el = textareaRef.value
    if (el) el.style.height = 'auto'
  })
}

// ==================== 消息发送 ====================

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || isLoading.value || sendBlocked.value) return
  resetInput()
  await sendMessage(text)
  emit('sent')
}

// ==================== 图片处理 ====================

const imageInputRef = ref<HTMLInputElement | null>(null)

function triggerImageUpload() {
  imageInputRef.value?.click()
}

async function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files) return
  for (const file of files) {
    const dataUrl = await fileToCompressedDataUrl(file)
    if (dataUrl) addPendingImage(dataUrl)
  }
  // 清空 value，允许重复选择同一文件
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

/** 压缩目标：最长边 1920px、JPEG 质量 0.85（兼顾画质与 base64 体积） */
const IMAGE_MAX_EDGE = 1920
const IMAGE_QUALITY = 0.85

/**
 * 图片压缩后转 dataURL：
 * 等比缩放到最长边 1920，统一转 JPEG（白底填充，避免透明图转 JPEG 黑底）。
 * GIF / SVG 跳过压缩以保留动画与矢量特性；失败时回退原始 base64。
 */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return fileToDataUrl(file)
  }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return fileToDataUrl(file)
    }
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', IMAGE_QUALITY)
  } catch {
    return fileToDataUrl(file)
  }
}

/** 粘贴图片（仅视觉模型），直接加入待发送列表 */
function handlePaste(e: ClipboardEvent) {
  if (!supportsVision.value) return
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) {
        fileToCompressedDataUrl(file).then(dataUrl => {
          if (dataUrl) addPendingImage(dataUrl)
        })
      }
    }
  }
}

// ==================== 语音录制 ====================

const isRecording = ref(false)
const showAudioConfirm = ref(false)
const audioBlobUrl = ref('')
const audioPlayerRef = ref<HTMLAudioElement | null>(null)
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let recordingStartTime = 0
/** 录音最长 120 秒，到时自动停止并进入确认流程，避免无限录制撑爆内存 */
const RECORD_MAX_MS = 120_000
let recordTimer: ReturnType<typeof setTimeout> | null = null

/** 录音时长显示（按开始时间估算） */
const audioDuration = computed(() => {
  if (!recordingStartTime) return '0 秒'
  const seconds = Math.round((Date.now() - recordingStartTime) / 1000)
  return `${seconds} 秒`
})

async function startRecording() {
  if (isLoading.value || isRecording.value) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioChunks = []
    recordingStartTime = Date.now()
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
    })
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
    recordTimer = setTimeout(() => stopRecording(), RECORD_MAX_MS)
  } catch (e) {
    console.error('录音失败：', e)
    alert('无法访问麦克风，请检查浏览器权限设置。')
  }
}

function stopRecording() {
  if (recordTimer) {
    clearTimeout(recordTimer)
    recordTimer = null
  }
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }
  isRecording.value = false
}

/** 鼠标移出按钮时取消录音（不弹出确认框） */
function cancelRecording() {
  if (recordTimer) {
    clearTimeout(recordTimer)
    recordTimer = null
  }
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
function sendAudio() {
  showAudioConfirm.value = false
  const blobUrl = audioBlobUrl.value
  if (blobUrl) {
    inputText.value = (inputText.value + ' [🎤 语音消息]').trim()
    URL.revokeObjectURL(blobUrl)
    audioBlobUrl.value = ''
    autoResize()
  }
  audioChunks = []
}
</script>

<style scoped>
.chat-input {
  flex-shrink: 0;
  padding: var(--space-sm) var(--space-md) var(--space-md);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-primary);
}

/* 待发送图片预览条 */
.pending-images {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.pending-img-wrap {
  position: relative;
  width: 64px;
  height: 64px;
}

.pending-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.pending-img-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--color-danger);
  color: #FFFFFF;
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-fast);
}

.pending-img-remove:hover {
  transform: scale(1.15);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-xs);
}

.tool-btn {
  flex-shrink: 0;
  margin-bottom: 2px;
}

.tool-btn.recording {
  background: var(--color-danger-bg);
  border-color: var(--color-danger);
  animation: pulse-dot var(--transition-slow) infinite;
}

.hidden-input {
  display: none;
}

.message-input {
  flex: 1;
  resize: none;
  max-height: 140px;
  line-height: 1.5;
}

.send-btn {
  flex-shrink: 0;
  min-width: 72px;
}

.loading-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #FFFFFF;
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

.input-hint {
  margin-top: var(--space-xs);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-align: right;
}

/* 录音确认弹窗（基础弹窗样式见 main.css 全局 .modal-* 体系） */
.modal-title {
  margin-bottom: var(--space-xs);
}

.audio-player {
  width: 100%;
  margin-bottom: var(--space-md);
}

@media (max-width: 640px) {
  .chat-input {
    padding: var(--space-xs) var(--space-sm) var(--space-sm);
  }

  .input-hint {
    display: none;
  }
}
</style>
