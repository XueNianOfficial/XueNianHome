<!--
============================================================
  管理后台 - AI 设置组件
  配置 API Key、Base URL、模型、System Prompt、预设
  保存后即时生效
============================================================
-->
<template>
  <div class="admin-ai">
    <!-- 加载中 -->
    <div v-if="loading" class="loading-text">加载设置中...</div>

    <template v-else>
      <!-- 状态提示 -->
      <div class="settings-source">
        当前配置来源：<strong>{{ source === 'file' ? '管理后台（文件存储）' : '环境变量' }}</strong>
      </div>

      <!-- 默认配置 -->
      <div class="settings-section card">
        <h3>🔧 默认配置</h3>
        <p class="section-desc">未选择预设时使用的 API 配置</p>

        <div class="form-group">
          <label>API Key</label>
          <input
            v-model="form.apiKey"
            class="form-input"
            type="password"
            placeholder="sk-..."
            autocomplete="off"
          />
          <span class="form-hint">留空则保持原值不变</span>
        </div>

        <div class="form-row">
          <div class="form-group form-group-flex">
            <label>API Base URL</label>
            <input v-model="form.baseUrl" class="form-input" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="form-group form-group-flex">
            <label>模型</label>
            <input v-model="form.model" class="form-input" placeholder="gpt-3.5-turbo" />
          </div>
        </div>

        <div class="form-group">
          <label>自定义 System Prompt（可选）</label>
          <textarea
            v-model="form.systemPrompt"
            class="form-textarea"
            rows="4"
            placeholder="留空则使用默认的雪年角色提示词..."
          ></textarea>
        </div>

        <div class="form-row">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.supportsVision" />
            <span>🖼️ 支持视觉（图片输入）</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.supportsAudio" />
            <span>🎤 支持音频（语音输入）</span>
          </label>
        </div>
      </div>

      <!-- 预设列表 -->
      <div class="settings-section card">
        <div class="section-header">
          <h3>📋 聊天预设</h3>
          <button class="btn-primary btn-sm" @click="addPreset">+ 添加预设</button>
        </div>
        <p class="section-desc">不同预设可使用不同的 API 地址、Key 和模型</p>

        <div v-if="form.presets.length === 0" class="empty-hint">
          暂无预设，点击「添加预设」创建
        </div>

        <div
          v-for="(preset, index) in form.presets"
          :key="index"
          class="preset-card"
        >
          <div class="preset-header">
            <h4>预设 #{{ index + 1 }}</h4>
            <button class="btn-delete-text" @click="removePreset(index)">删除</button>
          </div>

          <div class="form-row">
            <div class="form-group form-group-flex">
              <label>名称</label>
              <input v-model="preset.name" class="form-input" placeholder="如：GPT-4" />
            </div>
            <div class="form-group form-group-flex">
              <label>模型</label>
              <input v-model="preset.model" class="form-input" placeholder="gpt-4" />
            </div>
          </div>

          <div class="form-group">
            <label>API Key</label>
            <input
              v-model="preset.apiKey"
              class="form-input"
              type="password"
              placeholder="sk-..."
              autocomplete="off"
            />
          </div>

          <div class="form-group">
            <label>API Base URL</label>
            <input v-model="preset.baseUrl" class="form-input" placeholder="https://api.openai.com/v1" />
          </div>

          <div class="form-group">
            <label>System Prompt（可选）</label>
            <textarea
              v-model="preset.systemPrompt"
              class="form-textarea"
              rows="3"
              placeholder="留空则使用默认提示词..."
            ></textarea>
          </div>

          <div class="form-row">
            <label class="checkbox-label">
              <input type="checkbox" v-model="preset.supportsVision" />
              <span>🖼️ 支持视觉（图片输入）</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="preset.supportsAudio" />
              <span>🎤 支持音频（语音输入）</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 保存 -->
      <div class="save-bar">
        <p v-if="saveMsg" class="save-msg" :class="saveOk ? 'save-ok' : 'save-err'">
          {{ saveMsg }}
        </p>
        <button
          class="btn-primary"
          :disabled="saving"
          @click="handleSave"
        >{{ saving ? '保存中...' : '💾 保存设置（即时生效）' }}</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * AdminAISettings - AI 设置管理组件
 * 配置 API Key、Base URL、模型、System Prompt、预设
 * 保存后即时生效
 */

/** 预设表单数据（管理后台专用，对应服务端 AISettingsPreset） */
interface PresetForm {
  name: string
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
  supportsVision: boolean
  supportsAudio: boolean
}

/** 设置表单数据（管理后台专用，对应服务端 AISettings） */
interface SettingsForm {
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
  supportsVision: boolean
  supportsAudio: boolean
  presets: PresetForm[]
}

const loading = ref(true)
const saving = ref(false)
const source = ref('env')
const saveMsg = ref('')
const saveOk = ref(true)

const form = reactive<SettingsForm>({
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo',
  systemPrompt: '',
  supportsVision: false,
  supportsAudio: false,
  presets: []
})

/** 加载设置 */
async function loadSettings() {
  loading.value = true
  try {
    const res = await $fetch<{
      success: boolean
      data: {
        source: string
        apiKey: string
        baseUrl: string
        model: string
        systemPrompt: string
        supportsVision: boolean
        supportsAudio: boolean
        presets: any[]
      }
    }>('/api/admin/settings')

    if (res.success && res.data) {
      source.value = res.data.source
      form.apiKey = res.data.apiKey
      form.baseUrl = res.data.baseUrl
      form.model = res.data.model
      form.systemPrompt = res.data.systemPrompt || ''
      form.supportsVision = res.data.supportsVision || false
      form.supportsAudio = res.data.supportsAudio || false
      form.presets = (res.data.presets || []).map((p: any) => ({
        name: p.name || '',
        apiKey: p.apiKey || '',
        baseUrl: p.baseUrl || 'https://api.openai.com/v1',
        model: p.model || '',
        systemPrompt: p.systemPrompt || '',
        supportsVision: p.supportsVision || false,
        supportsAudio: p.supportsAudio || false
      }))
    }
  } catch (e: any) {
    console.error('加载设置失败：', e)
  }
  loading.value = false
}

/** 添加预设 */
function addPreset() {
  form.presets.push({
    name: '',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    systemPrompt: '',
    supportsVision: false,
    supportsAudio: false
  })
}

/** 删除预设 */
function removePreset(index: number) {
  form.presets.splice(index, 1)
}

/** 保存设置 */
async function handleSave() {
  saving.value = true
  saveMsg.value = ''
  saveOk.value = true

  try {
    const res = await $fetch<{ success: boolean; message: string }>('/api/admin/settings', {
      method: 'POST',
      body: {
        apiKey: form.apiKey.startsWith('****') ? undefined : (form.apiKey || undefined),
        baseUrl: form.baseUrl,
        model: form.model,
        systemPrompt: form.systemPrompt || undefined,
        supportsVision: form.supportsVision,
        supportsAudio: form.supportsAudio,
        presets: form.presets.filter(p => p.name && p.model)
      }
    })
    saveMsg.value = res.message || '保存成功'
    saveOk.value = true
    await loadSettings() // 刷新掩码后的显示
  } catch (e: any) {
    saveMsg.value = e?.data?.message || '保存失败'
    saveOk.value = false
  }

  saving.value = false
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-source {
  padding: 8px 14px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.settings-section {
  padding: 20px;
  margin-bottom: 16px;
}

.settings-section h3 {
  margin: 0 0 4px;
  font-size: 1.05rem;
}

.section-desc {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0 0 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 表单 */
.form-group { margin-bottom: 12px; }
.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.form-row { display: flex; gap: 12px; }
.form-group-flex { flex: 1; }

.form-input, .form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-family: var(--font-sans);
  outline: none;
  transition: border-color var(--transition-fast);
}
.form-input:focus, .form-textarea:focus { border-color: var(--color-accent); }
.form-textarea { resize: vertical; }

.form-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  display: block;
  margin-top: 2px;
}

/* 预设卡片 */
.preset-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 12px;
}

.preset-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.preset-header h4 { margin: 0; font-size: 0.95rem; }

.btn-delete-text {
  background: none;
  border: none;
  color: #DC2626;
  cursor: pointer;
  font-size: 0.8rem;
  font-family: var(--font-sans);
}
.btn-delete-text:hover { text-decoration: underline; }

.empty-hint {
  text-align: center;
  padding: 20px;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

/* 保存栏 */
.save-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 0;
}

.save-msg {
  font-size: 0.85rem;
  margin: 0;
}
.save-ok { color: #065F46; }
.save-err { color: #DC2626; }

.btn-sm { padding: 4px 14px; font-size: 0.8rem; }
.loading-text { text-align: center; padding: 40px; color: var(--color-text-muted); }

/* 复选框 */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}
.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

@media (max-width: 640px) {
  .form-row { flex-direction: column; }
}
</style>
