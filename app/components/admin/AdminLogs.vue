<!--
============================================================
  管理后台 - 系统日志
  查看 AI 聊天 / AI 画图的服务端请求日志：
  - 按日期 + 类型筛选，倒序展示（最新在前）
  - 每条日志可展开查看完整请求消息、API 原始输出与上游错误详情
  - 支持删除指定日期的日志文件（AdminConfirm 二次确认）
  数据接口：GET /api/admin/logs/list、GET /api/admin/logs/detail、
            POST /api/admin/logs/delete
============================================================
-->
<template>
  <div class="admin-logs">
    <!-- 工具栏：日期 / 类型筛选 + 刷新 + 删除当日 -->
    <div class="logs-toolbar card">
      <div class="toolbar-field">
        <label class="field-label" for="log-date">日期</label>
        <select id="log-date" v-model="selectedDate" class="input toolbar-select" :disabled="!logFiles.length">
          <option v-if="!logFiles.length" value="">暂无日志</option>
          <option v-for="f in logFiles" :key="f.date" :value="f.date">
            {{ f.date }}（{{ f.count }} 条，{{ formatBytes(f.size) }}）
          </option>
        </select>
      </div>

      <div class="toolbar-field">
        <label class="field-label" for="log-type">类型</label>
        <select id="log-type" v-model="typeFilter" class="input toolbar-select">
          <option value="">全部</option>
          <option value="chat">聊天</option>
          <option value="draw">画图</option>
        </select>
      </div>

      <div class="toolbar-actions">
        <button type="button" class="btn-outline btn-sm" :disabled="loading" @click="refresh">
          {{ loading ? '加载中…' : '刷新' }}
        </button>
        <button
          type="button"
          class="btn-danger btn-sm"
          :disabled="!selectedDate || loading"
          @click="showDeleteConfirm = true"
        >删除当日日志</button>
      </div>
    </div>

    <p v-if="logFiles.length" class="logs-hint">
      共 {{ logFiles.length }} 天、{{ totalEntries }} 条日志，保留 7 天自动清理；日志含完整聊天内容，请勿截图外泄
    </p>

    <!-- 加载态 -->
    <div v-if="loading && !entries.length" class="logs-loading">
      <span class="spinner"></span>
      <p>正在加载日志…</p>
    </div>

    <!-- 空态 -->
    <div v-else-if="!entries.length" class="logs-empty card">
      <p>{{ logFiles.length ? '该筛选条件下暂无日志' : '暂无请求日志，发起一次 AI 聊天或画图后即会记录' }}</p>
    </div>

    <!-- 日志列表 -->
    <div v-else class="logs-list">
      <div
        v-for="(entry, index) in entries"
        :key="index"
        class="log-item card"
        :class="{ 'log-item-error': entry.error }"
      >
        <!-- 摘要行（点击展开/收起详情） -->
        <button type="button" class="log-head" @click="toggleExpand(index)">
          <span class="log-badge" :class="entry.type === 'chat' ? 'badge-accent' : 'badge-warn'">
            {{ entry.type === 'chat' ? '聊天' : '画图' }}
          </span>
          <span v-if="entry.error" class="log-badge badge-danger">失败</span>
          <span class="log-time">{{ formatTime(entry.time) }}</span>
          <span class="log-summary">{{ summarize(entry) }}</span>
          <span class="log-duration">{{ formatDuration(entry.durationMs) }}</span>
          <span class="log-chevron" :class="{ expanded: expandedIndex === index }">▾</span>
        </button>

        <!-- 展开详情：请求 / 输出 / 错误的完整 JSON -->
        <div v-if="expandedIndex === index" class="log-detail">
          <div class="log-meta">
            <span v-if="entry.model">模型：{{ entry.model }}</span>
            <span v-if="entry.preset">预设：{{ entry.preset }}</span>
            <span v-if="entry.sessionId">会话：{{ entry.sessionId }}</span>
            <span v-if="hasOptions(entry)">能力：{{ optionsText(entry) }}</span>
          </div>

          <section v-if="entry.request" class="log-section">
            <h4 class="log-section-title">完整请求内容</h4>
            <pre class="log-json">{{ prettyJson(entry.request) }}</pre>
          </section>

          <section v-if="entry.response" class="log-section">
            <h4 class="log-section-title">API 输出</h4>
            <pre class="log-json">{{ prettyJson(entry.response) }}</pre>
          </section>

          <section v-if="entry.error" class="log-section">
            <h4 class="log-section-title log-section-title-danger">错误详情（含上游原始错误体）</h4>
            <pre class="log-json log-json-danger">{{ prettyJson(entry.error) }}</pre>
          </section>
        </div>
      </div>

      <!-- 加载更多（服务端默认返回 100 条，逐步加量） -->
      <div v-if="entries.length >= limit" class="logs-more">
        <button type="button" class="btn-outline btn-sm" :disabled="loading" @click="loadMore">
          {{ loading ? '加载中…' : '加载更多' }}
        </button>
      </div>
    </div>

    <!-- 删除当日日志二次确认 -->
    <AdminConfirm
      :show="showDeleteConfirm"
      title="删除当日日志"
      :description="`确定要删除 ${selectedDate} 的全部日志吗？此操作不可撤销。`"
      confirm-text="确认删除"
      loading-text="删除中…"
      :loading="deleting"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * AdminLogs - 系统日志查看
 * 与服务端 request-log.ts 的日志结构对应；
 * 日志中的密钥类字段已被服务端脱敏，前端无需再处理
 */
import AdminConfirm from '~/components/admin/AdminConfirm.vue'

/** 日志文件概览（与 list 接口结构一致） */
interface LogFileInfo {
  date: string
  count: number
  size: number
}

/** 单条日志（与服务端 RequestLogEntry 一致） */
interface LogEntry {
  time: string
  type: 'chat' | 'draw'
  sessionId?: string
  preset?: string
  model?: string
  options?: Record<string, unknown>
  request?: unknown
  response?: unknown
  error?: { statusCode?: number; message: string; detail?: unknown }
  durationMs: number
}

const { success, error: showError } = useToast()

/** 日志文件列表与总量 */
const logFiles = ref<LogFileInfo[]>([])
const totalEntries = ref(0)

/** 筛选条件 */
const selectedDate = ref('')
const typeFilter = ref('')

/** 当前日期下的日志条目 */
const entries = ref<LogEntry[]>([])
const loading = ref(false)
const limit = ref(100)

/** 当前展开详情的条目下标（-1 为全部收起） */
const expandedIndex = ref(-1)

/** 删除确认弹窗状态 */
const showDeleteConfirm = ref(false)
const deleting = ref(false)

/** 加载日志文件列表，默认选中最新一天 */
async function loadFiles() {
  try {
    const res = await $fetch<{ success: boolean; data: { files: LogFileInfo[]; totalEntries: number } }>('/api/admin/logs/list')
    logFiles.value = res.data.files
    totalEntries.value = res.data.totalEntries
    if (!selectedDate.value || !logFiles.value.some(f => f.date === selectedDate.value)) {
      selectedDate.value = logFiles.value[0]?.date || ''
    }
  } catch (e: any) {
    showError(e?.data?.message || '加载日志列表失败')
  }
}

/** 加载当前筛选条件下的日志条目 */
async function loadEntries() {
  if (!selectedDate.value) {
    entries.value = []
    return
  }
  loading.value = true
  expandedIndex.value = -1
  try {
    const params = new URLSearchParams({ date: selectedDate.value, limit: String(limit.value) })
    if (typeFilter.value) params.set('type', typeFilter.value)
    const res = await $fetch<{ success: boolean; data: { entries: LogEntry[] } }>(`/api/admin/logs/detail?${params}`)
    entries.value = res.data.entries
  } catch (e: any) {
    showError(e?.data?.message || '加载日志详情失败')
  }
  loading.value = false
}

/** 刷新：文件列表与条目一起重新加载 */
async function refresh() {
  await loadFiles()
  await loadEntries()
}

/** 加载更多（每次追加 100 条上限） */
async function loadMore() {
  limit.value += 100
  await loadEntries()
}

/** 删除当日日志 */
async function handleDelete() {
  deleting.value = true
  try {
    await $fetch('/api/admin/logs/delete', { method: 'POST', body: { date: selectedDate.value } })
    success(`已删除 ${selectedDate.value} 的日志`)
    showDeleteConfirm.value = false
    limit.value = 100
    await refresh()
  } catch (e: any) {
    showError(e?.data?.message || '删除日志失败')
  }
  deleting.value = false
}

/** 展开/收起详情 */
function toggleExpand(index: number) {
  expandedIndex.value = expandedIndex.value === index ? -1 : index
}

/** 摘要行：取请求内容的一句话概括 */
function summarize(entry: LogEntry): string {
  if (entry.error) return entry.error.message
  const req = entry.request as any
  if (entry.type === 'draw') {
    return typeof req?.prompt === 'string' ? truncate(req.prompt, 40) : '画图请求'
  }
  // 聊天：取最后一条用户消息的内容
  if (Array.isArray(req)) {
    const lastUser = [...req].reverse().find((m: any) => m?.role === 'user')
    const content = typeof lastUser?.content === 'string' ? lastUser.content : '[多模态消息]'
    return truncate(content, 40)
  }
  return '聊天请求'
}

/** 附加能力摘要（仅展示开启的项） */
function hasOptions(entry: LogEntry): boolean {
  const o = entry.options
  return !!(o && (o.enableThinking || o.enableSearch || o.customSystemPrompt))
}

function optionsText(entry: LogEntry): string {
  const o = entry.options || {}
  const parts: string[] = []
  if (o.enableThinking) parts.push('深度思考')
  if (o.enableSearch) parts.push('联网搜索')
  if (o.customSystemPrompt) parts.push('自定义提示词')
  return parts.join('、')
}

/** 截断长文本 */
function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

/** JSON 美化输出 */
function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/** ISO 时间 → 本地 HH:MM:SS */
function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString('zh-CN', { hour12: false })
}

/** 耗时人性化展示 */
function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

/** 字节数人性化展示 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// 日期 / 类型变化时重置分页并重新加载
watch([selectedDate, typeFilter], () => {
  limit.value = 100
  loadEntries()
})

onMounted(refresh)
</script>

<style scoped>
/* ---------- 工具栏 ---------- */
.logs-toolbar {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding: var(--space-4);
  margin-bottom: var(--space-3);
}

.toolbar-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 200px;
}

.toolbar-select {
  padding: 8px 12px;
  font-size: var(--text-sm);
}

.toolbar-actions {
  display: flex;
  gap: var(--space-2);
  margin-left: auto;
}

.logs-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin: 0 0 var(--space-4);
}

/* ---------- 加载 / 空态 ---------- */
.logs-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.logs-empty {
  padding: var(--space-8);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.logs-empty p {
  margin: 0;
}

/* ---------- 日志列表 ---------- */
.logs-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.log-item {
  padding: 0;
  overflow: hidden;
}

/* 失败条目：左侧红色描边提示 */
.log-item-error {
  border-left: 3px solid var(--color-danger);
}

.log-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 10px var(--space-4);
  border: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--transition-fast);
}

.log-head:hover {
  background: var(--color-bg-hover);
}

/* 类型/状态徽章 */
.log-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
}

.badge-accent {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.badge-warn {
  background: var(--color-warning-bg, rgba(230, 162, 60, 0.12));
  color: var(--color-warning, #b8860b);
}

.badge-danger {
  background: var(--color-danger-bg, rgba(220, 80, 80, 0.12));
  color: var(--color-danger);
}

.log-time {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.log-summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-secondary);
}

.log-duration {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.log-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.log-chevron.expanded {
  transform: rotate(180deg);
}

/* ---------- 展开详情 ---------- */
.log-detail {
  border-top: 1px solid var(--color-border);
  padding: var(--space-4);
  background: var(--color-bg-secondary);
}

.log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin-bottom: var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.log-section {
  margin-bottom: var(--space-3);
}

.log-section:last-child {
  margin-bottom: 0;
}

.log-section-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.log-section-title-danger {
  color: var(--color-danger);
}

/* JSON 查看区：等宽字体 + 横向滚动，防超长行撑破布局 */
.log-json {
  margin: 0;
  padding: var(--space-3);
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  line-height: 1.6;
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-break: break-all;
}

.log-json-danger {
  border-color: var(--color-danger);
}

/* ---------- 加载更多 ---------- */
.logs-more {
  display: flex;
  justify-content: center;
  padding: var(--space-3);
}

/* ---------- 响应式 ---------- */
@media (max-width: 768px) {
  .toolbar-field {
    min-width: 0;
    flex: 1;
  }

  .toolbar-actions {
    margin-left: 0;
    width: 100%;
  }

  .log-duration {
    display: none;
  }
}
</style>
