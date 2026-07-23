<!--
  ============================================================
  AdminAISettings - AI 接口设置管理
  - 默认配置：API Key / Base URL / 模型 / System Prompt
  - 多预设管理：折叠式卡片，支持新增 / 编辑 / 删除
  - 全局能力开关：默认视觉 / 音频 / 深度思考 / 联网搜索 /
    允许自定义系统提示词能力标记（预设内可单独覆盖）
  - AI 画图：火山方舟 seedream 图像生成配置（聊天页画图模式）
  - 提示词模板：聊天欢迎页快捷短语的增删改
  - 密钥安全：输入框默认留空不回显，placeholder 展示掩码，
    留空提交时回传掩码串让服务端保留原密钥（绝不显示明文）
  ============================================================
-->
<template>
  <div class="ai-settings">
    <!-- 加载骨架 -->
    <div v-if="loading" class="settings-skeleton">
      <div class="skeleton skeleton-banner"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    </div>

    <template v-else>
      <!-- 配置来源提示：file = 管理后台存储（即时生效），env = 环境变量（只读回显） -->
      <div class="source-banner" :class="`source-${settingsSource}`">
        <span class="source-icon">{{ settingsSource === 'file' ? '📁' : '🌍' }}</span>
        <div class="source-text">
          <strong>配置来源：{{ settingsSource === 'file' ? '管理后台（文件存储）' : '环境变量' }}</strong>
          <p v-if="settingsSource === 'env'">当前读取环境变量配置。在下方保存一次后，将转为文件存储并即时生效。</p>
          <p v-else>配置保存在服务端 <code>server/data/ai-settings.json</code>，保存后即时生效，无需重启。</p>
        </div>
      </div>

      <!-- 默认配置 -->
      <section class="card settings-card">
        <div class="card-header">
          <h3>⚙️ 默认配置</h3>
          <p class="card-subtitle">全局生效的 AI 接口配置，未单独配置的预设将使用这里的设置</p>
        </div>

        <div class="form-group">
          <label class="field-label" for="ai-api-key">API 密钥</label>
          <div class="input-with-btn">
            <input
              id="ai-api-key"
              v-model="defaultApiKeyInput"
              :type="showDefaultKey ? 'text' : 'password'"
              class="input"
              :placeholder="defaultApiKeyMasked ? `当前已设置：${defaultApiKeyMasked}` : '未设置，请输入密钥'"
              autocomplete="off"
            />
            <button
              type="button"
              class="icon-btn key-toggle"
              :title="showDefaultKey ? '隐藏' : '显示'"
              @click="showDefaultKey = !showDefaultKey"
            >{{ showDefaultKey ? '🙈' : '👁️' }}</button>
          </div>
          <p class="field-hint">留空则不修改当前密钥；密钥仅保存在服务端，此处永不显示明文</p>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="field-label" for="ai-base-url">Base URL</label>
            <input
              id="ai-base-url"
              v-model="defaultSettings.baseUrl"
              type="text"
              class="input"
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div class="form-group">
            <label class="field-label" for="ai-model">默认模型</label>
            <input
              id="ai-model"
              v-model="defaultSettings.model"
              type="text"
              class="input"
              placeholder="gpt-4o-mini"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="field-label" for="ai-system-prompt">System Prompt</label>
          <textarea
            id="ai-system-prompt"
            v-model="defaultSettings.systemPrompt"
            class="input prompt-input"
            rows="5"
            placeholder="你是雪年 XueNian，一只可爱的白色北极狐……"
          ></textarea>
          <p class="field-hint">留空则使用服务端默认的雪年角色提示词</p>
        </div>
      </section>

      <!-- 预设管理 -->
      <section class="card settings-card">
        <div class="card-header preset-header">
          <div>
            <h3>🎭 预设管理</h3>
            <p class="card-subtitle">访客可在聊天页选择不同预设，共 {{ presetForms.length }} 个</p>
          </div>
          <button type="button" class="btn-outline btn-sm" @click="addPreset">＋ 新增预设</button>
        </div>

        <div v-if="presetForms.length === 0" class="empty-state">
          <div class="empty-state-icon">🎭</div>
          <p>暂无预设，点击右上角「新增预设」创建</p>
        </div>

        <div v-else class="preset-list">
          <div v-for="(preset, index) in presetForms" :key="index" class="preset-item">
            <!-- 折叠行：概览信息 -->
            <div class="preset-summary" @click="preset.collapsed = !preset.collapsed">
              <img
                v-if="preset.avatar"
                v-show="!preset.avatarFailed"
                :src="preset.avatar"
                alt=""
                class="preset-avatar"
                @error="preset.avatarFailed = true"
                @load="preset.avatarFailed = false"
              />
              <span v-else class="preset-avatar preset-avatar-placeholder">🐾</span>
              <div class="preset-info">
                <span class="preset-name">{{ preset.name || `预设 ${index + 1}` }}</span>
                <span class="preset-model">{{ preset.model || '未设置模型' }}</span>
              </div>
              <span class="preset-caps">
                <span v-if="preset.supportsVision" title="支持图片">🖼️</span>
                <span v-if="preset.supportsAudio" title="支持音频">🎤</span>
                <span
                  class="key-dot"
                  :class="{ set: preset.apiKeyMasked || preset.apiKeyInput }"
                  :title="preset.apiKeyMasked || preset.apiKeyInput ? '已配置密钥' : '未配置密钥'"
                ></span>
              </span>
              <button
                type="button"
                class="icon-btn"
                title="删除预设"
                @click.stop="removePreset(index)"
              >🗑️</button>
              <span class="preset-chevron" :class="{ expanded: !preset.collapsed }">▾</span>
            </div>

            <!-- 展开：完整编辑表单 -->
            <div v-if="!preset.collapsed" class="preset-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="field-label">预设名称 *</label>
                  <input v-model="preset.name" type="text" class="input" placeholder="例如：雪年（GPT-4o）" />
                </div>
                <div class="form-group">
                  <label class="field-label">模型 *</label>
                  <input v-model="preset.model" type="text" class="input" placeholder="gpt-4o" />
                </div>
              </div>

              <div class="form-group">
                <label class="field-label">API 密钥</label>
                <div class="input-with-btn">
                  <input
                    v-model="preset.apiKeyInput"
                    :type="preset.showKey ? 'text' : 'password'"
                    class="input"
                    :placeholder="preset.apiKeyMasked ? `当前已设置：${preset.apiKeyMasked}` : '未设置（需填写密钥）'"
                    autocomplete="off"
                  />
                  <button
                    type="button"
                    class="icon-btn key-toggle"
                    :title="preset.showKey ? '隐藏' : '显示'"
                    @click="preset.showKey = !preset.showKey"
                  >{{ preset.showKey ? '🙈' : '👁️' }}</button>
                </div>
                <p class="field-hint">留空则不修改当前密钥；密钥为空的预设聊天时会报错</p>
              </div>

              <div class="form-group">
                <label class="field-label">Base URL</label>
                <input v-model="preset.baseUrl" type="text" class="input" placeholder="https://api.openai.com/v1" />
              </div>

              <div class="form-group">
                <label class="field-label">System Prompt</label>
                <textarea
                  v-model="preset.systemPrompt"
                  class="input prompt-input"
                  rows="3"
                  placeholder="留空则使用默认 System Prompt"
                ></textarea>
              </div>

              <div class="form-group">
                <label class="field-label">角色头像 URL</label>
                <div class="avatar-field">
                  <input
                    v-model="preset.avatar"
                    type="text"
                    class="input"
                    placeholder="/images/头像.png"
                    @blur="preset.avatar = preset.avatar.trim()"
                  />
                  <img
                    v-if="preset.avatar"
                    v-show="!preset.avatarFailed"
                    :src="preset.avatar"
                    alt="头像预览"
                    class="avatar-preview"
                    @error="preset.avatarFailed = true"
                    @load="preset.avatarFailed = false"
                  />
                </div>
                <p class="field-hint">支持本地路径（/images/xxx.png）或 https 链接，聊天页将显示为该预设的头像</p>
              </div>

              <div class="form-group">
                <div class="caps-checkboxes">
                  <label class="caps-checkbox">
                    <input v-model="preset.supportsVision" type="checkbox" />
                    <span>🖼️ 支持图片输入</span>
                  </label>
                  <label class="caps-checkbox">
                    <input v-model="preset.supportsAudio" type="checkbox" />
                    <span>🎤 支持音频输入</span>
                  </label>
                  <label class="caps-checkbox">
                    <input v-model="preset.supportsThinking" type="checkbox" />
                    <span>🧠 深度思考</span>
                  </label>
                  <label class="caps-checkbox">
                    <input v-model="preset.supportsWebSearch" type="checkbox" />
                    <span>🌐 联网搜索</span>
                  </label>
                  <label class="caps-checkbox">
                    <input v-model="preset.allowCustomSystemPrompt" type="checkbox" />
                    <span>✏️ 允许自定义系统提示词</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 全局能力开关 -->
      <section class="card settings-card">
        <div class="card-header">
          <h3>🔧 全局能力</h3>
          <p class="card-subtitle">开启后所有预设（含默认）均获得该能力，预设内也可单独开启</p>
        </div>
        <div class="switch-list">
          <label class="switch-row">
            <span class="switch-info">
              <span class="switch-title">🖼️ 默认支持图片输入</span>
              <span class="switch-desc">开启后聊天页默认允许上传图片</span>
            </span>
            <span class="switch">
              <input v-model="defaultSettings.supportsVision" type="checkbox" role="switch" />
              <span class="switch-slider"></span>
            </span>
          </label>
          <label class="switch-row">
            <span class="switch-info">
              <span class="switch-title">🎤 默认支持音频输入</span>
              <span class="switch-desc">预留能力标记，供前端展示用</span>
            </span>
            <span class="switch">
              <input v-model="defaultSettings.supportsAudio" type="checkbox" role="switch" />
              <span class="switch-slider"></span>
            </span>
          </label>
          <label class="switch-row">
            <span class="switch-info">
              <span class="switch-title">🧠 默认支持深度思考</span>
              <span class="switch-desc">开启后聊天页显示深度思考能力入口</span>
            </span>
            <span class="switch">
              <input v-model="defaultSettings.supportsThinking" type="checkbox" role="switch" />
              <span class="switch-slider"></span>
            </span>
          </label>
          <label class="switch-row">
            <span class="switch-info">
              <span class="switch-title">🌐 默认支持联网搜索</span>
              <span class="switch-desc">开启后聊天页显示联网搜索能力入口</span>
            </span>
            <span class="switch">
              <input v-model="defaultSettings.supportsWebSearch" type="checkbox" role="switch" />
              <span class="switch-slider"></span>
            </span>
          </label>
          <label class="switch-row">
            <span class="switch-info">
              <span class="switch-title">✏️ 允许自定义系统提示词</span>
              <span class="switch-desc">开启后访客可在聊天页临时修改系统提示词</span>
            </span>
            <span class="switch">
              <input v-model="defaultSettings.allowCustomSystemPrompt" type="checkbox" role="switch" />
              <span class="switch-slider"></span>
            </span>
          </label>
        </div>
      </section>

      <!-- AI 画图配置 -->
      <section class="card settings-card">
        <div class="card-header">
          <h3>🎨 AI 画图</h3>
          <p class="card-subtitle">火山方舟 seedream 图像生成，用于聊天页画图模式。留空 API Key 则前台不显示画图入口。</p>
        </div>

        <div class="form-group">
          <label class="field-label" for="image-gen-api-key">API 密钥</label>
          <div class="input-with-btn">
            <input
              id="image-gen-api-key"
              v-model="imageGenSettings.apiKey"
              :type="showImageGenKey ? 'text' : 'password'"
              class="input"
              placeholder="留空则关闭画图功能"
              autocomplete="off"
            />
            <button
              type="button"
              class="icon-btn key-toggle"
              :title="showImageGenKey ? '隐藏' : '显示'"
              @click="showImageGenKey = !showImageGenKey"
            >{{ showImageGenKey ? '🙈' : '👁️' }}</button>
          </div>
          <p class="field-hint">已设置的密钥以掩码形式回显，原样保存即保留原密钥；密钥仅保存在服务端</p>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="field-label" for="image-gen-base-url">Base URL</label>
            <input
              id="image-gen-base-url"
              v-model="imageGenSettings.baseUrl"
              type="text"
              class="input"
              placeholder="https://ark.cn-beijing.volces.com/api/v3"
            />
          </div>
          <div class="form-group">
            <label class="field-label" for="image-gen-size">尺寸</label>
            <select id="image-gen-size" v-model="imageGenSettings.size" class="input">
              <option value="2K">2K</option>
              <option value="3K">3K</option>
              <option value="4K">4K</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="field-label" for="image-gen-model">模型 ID</label>
          <input
            id="image-gen-model"
            v-model="imageGenSettings.model"
            type="text"
            class="input"
            placeholder="doubao-seedream-5-0-lite-260128"
          />
          <p class="field-hint">模型 ID 带日期后缀，以方舟控制台模型列表为准</p>
        </div>

        <div class="form-group">
          <div class="caps-checkboxes">
            <label class="caps-checkbox">
              <input v-model="imageGenSettings.watermark" type="checkbox" />
              <span>🔖 添加「AI 生成」水印</span>
            </label>
          </div>
        </div>
      </section>

      <!-- 提示词模板 -->
      <section class="card settings-card">
        <div class="card-header preset-header">
          <div>
            <h3>💬 提示词模板</h3>
            <p class="card-subtitle">聊天欢迎页的快捷短语，点击即发送。</p>
          </div>
          <button type="button" class="btn-outline btn-sm" @click="addTemplate">＋ 添加模板</button>
        </div>

        <div v-if="promptTemplates.length === 0" class="empty-state">
          <div class="empty-state-icon">💬</div>
          <p>暂无模板，点击右上角「添加模板」创建</p>
        </div>

        <div v-else class="template-list">
          <div v-for="(tpl, index) in promptTemplates" :key="tpl.id" class="template-item">
            <div class="template-item-head">
              <input
                v-model="tpl.title"
                type="text"
                class="input template-title-input"
                placeholder="模板标题（50 字以内）"
                maxlength="50"
              />
              <button
                type="button"
                class="icon-btn"
                title="删除模板"
                @click="removeTemplate(index)"
              >🗑️</button>
            </div>
            <textarea
              v-model="tpl.prompt"
              class="input prompt-input"
              rows="2"
              maxlength="2000"
              placeholder="点击后发送的完整提示词内容（2000 字以内）"
            ></textarea>
          </div>
        </div>
      </section>

      <!-- 保存栏 -->
      <div class="save-bar">
        <button type="button" class="btn-primary" :disabled="saving" @click="saveSettings">
          <span v-if="saving" class="spinner"></span>
          {{ saving ? '保存中…' : '💾 保存设置' }}
        </button>
        <span class="save-hint">保存后即时生效，无需重启服务</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  AdminAISettings - AI 设置管理组件
 *  - GET/POST /api/admin/settings 读取与保存
 *  - 管理范围：默认配置、多预设、全局能力开关（视觉/音频/
 *    深度思考/联网搜索/自定义系统提示词）、AI 画图（imageGen）、
 *    提示词模板（promptTemplates）
 *  - 密钥处理约定：
 *    · 服务端 GET 返回掩码密钥（如 ****abcd），绝不返回明文
 *    · 输入框留空 + 文件存储来源 → 回传掩码串，服务端识别后保留原值
 *    · 输入框留空 + 环境变量来源 → 提交 undefined（存空串），
 *      服务端继续回退使用环境变量 Key（避免把掩码串误存为真实密钥）
 *    · 输入新值 → 直接提交新密钥
 *    · AI 画图密钥直接回显掩码值，原样提交即保留原密钥
 *  ============================================================
 */

const { success, error } = useToast()

// ---------- 类型 ----------
// 预设编辑表单：在服务端预设字段基础上附加 UI 专用字段（提交前需剥离）
interface PresetForm {
  name: string
  apiKeyInput: string    // 用户输入的新密钥（空 = 不修改）
  apiKeyMasked: string   // 服务端返回的掩码，用于 placeholder 展示与留空回传
  baseUrl: string
  model: string
  systemPrompt: string
  supportsVision: boolean
  supportsAudio: boolean
  supportsThinking: boolean
  supportsWebSearch: boolean
  allowCustomSystemPrompt: boolean
  avatar: string
  collapsed: boolean     // 是否折叠
  showKey: boolean       // 密钥可见性切换
  avatarFailed: boolean  // 头像预览加载失败标记
}

// 提示词模板：聊天欢迎页快捷短语（字段与服务端契约一致）
interface PromptTemplateForm {
  id: string
  title: string
  prompt: string
}

// ---------- 状态 ----------
const loading = ref(true)
const saving = ref(false)
const settingsSource = ref<'file' | 'env'>('env')
const defaultSettings = ref({
  baseUrl: '',
  model: '',
  systemPrompt: '',
  supportsVision: false,
  supportsAudio: false,
  supportsThinking: false,
  supportsWebSearch: false,
  allowCustomSystemPrompt: false,
})
const defaultApiKeyInput = ref('')
const defaultApiKeyMasked = ref('')
const showDefaultKey = ref(false)
const presetForms = ref<PresetForm[]>([])
// AI 画图（火山方舟 seedream）：apiKey 直接回显服务端掩码，原样提交即保留原密钥
const imageGenSettings = ref({
  apiKey: '',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  model: 'doubao-seedream-5-0-lite-260128',
  size: '2K',
  watermark: false,
})
const showImageGenKey = ref(false)
// 提示词模板列表
const promptTemplates = ref<PromptTemplateForm[]>([])

// ---------- 数据加载 ----------
const loadSettings = async () => {
  loading.value = true
  try {
    const res = await $fetch<any>('/api/admin/settings')
    if (res.success) {
      settingsSource.value = res.data.source
      defaultSettings.value = {
        baseUrl: res.data.baseUrl,
        model: res.data.model,
        systemPrompt: res.data.systemPrompt || '',
        supportsVision: res.data.supportsVision || false,
        supportsAudio: res.data.supportsAudio || false,
        supportsThinking: res.data.supportsThinking || false,
        supportsWebSearch: res.data.supportsWebSearch || false,
        allowCustomSystemPrompt: res.data.allowCustomSystemPrompt || false,
      }
      defaultApiKeyInput.value = ''
      defaultApiKeyMasked.value = res.data.apiKey || ''
      presetForms.value = (res.data.presets || []).map((p: any) => ({
        name: p.name,
        apiKeyInput: '',
        apiKeyMasked: p.apiKey || '',
        baseUrl: p.baseUrl,
        model: p.model,
        systemPrompt: p.systemPrompt,
        supportsVision: p.supportsVision || false,
        supportsAudio: p.supportsAudio || false,
        supportsThinking: p.supportsThinking || false,
        supportsWebSearch: p.supportsWebSearch || false,
        allowCustomSystemPrompt: p.allowCustomSystemPrompt || false,
        avatar: p.avatar || '',
        collapsed: true,
        showKey: false,
        avatarFailed: false,
      }))
      // AI 画图配置：apiKey 为掩码值，原样回显、原样提交即可保留原密钥
      const imageGen = res.data.imageGen || {}
      imageGenSettings.value = {
        apiKey: imageGen.apiKey || '',
        baseUrl: imageGen.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
        model: imageGen.model || 'doubao-seedream-5-0-lite-260128',
        size: imageGen.size || '2K',
        watermark: imageGen.watermark || false,
      }
      // 提示词模板：兼容旧数据无此字段的情况
      promptTemplates.value = (res.data.promptTemplates || []).map((t: any) => ({
        id: t.id,
        title: t.title || '',
        prompt: t.prompt || '',
      }))
    }
  } catch (e: any) {
    error(e?.data?.message || '加载设置失败')
  } finally {
    loading.value = false
  }
}

// ---------- 预设操作 ----------
const addPreset = () => {
  presetForms.value.push({
    name: '',
    apiKeyInput: '',
    apiKeyMasked: '',
    baseUrl: '',
    model: '',
    systemPrompt: '',
    supportsVision: false,
    supportsAudio: false,
    supportsThinking: false,
    supportsWebSearch: false,
    allowCustomSystemPrompt: false,
    avatar: '/images/头像.png',
    collapsed: false,
    showKey: false,
    avatarFailed: false,
  })
}

const removePreset = (index: number) => {
  presetForms.value.splice(index, 1)
}

// ---------- 提示词模板操作 ----------
const addTemplate = () => {
  promptTemplates.value.push({ id: 'tpl_' + Date.now(), title: '', prompt: '' })
}

const removeTemplate = (index: number) => {
  promptTemplates.value.splice(index, 1)
}

// 密钥提交值：新输入 > 回传掩码（保留原值）> undefined（存空串，回退环境变量）
// 注意：仅「文件存储」来源的掩码才可安全回传（服务端凭 existing 文件还原原值）；
// 「环境变量」来源尚无设置文件，若回传掩码会被服务端当作真实密钥写入文件，
// 因此留空时必须提交 undefined，让服务端存空串并继续回退到环境变量 Key
const resolveKeyPayload = (input: string, masked: string): string | undefined => {
  const v = input.trim()
  if (v) return v
  if (settingsSource.value === 'file') return masked || undefined
  return undefined
}

// ---------- 保存 ----------
const saveSettings = async () => {
  saving.value = true
  try {
    const res = await $fetch<any>('/api/admin/settings', {
      method: 'POST',
      body: {
        apiKey: resolveKeyPayload(defaultApiKeyInput.value, defaultApiKeyMasked.value),
        baseUrl: defaultSettings.value.baseUrl,
        model: defaultSettings.value.model,
        systemPrompt: defaultSettings.value.systemPrompt?.trim() || undefined,
        supportsVision: defaultSettings.value.supportsVision,
        supportsAudio: defaultSettings.value.supportsAudio,
        supportsThinking: defaultSettings.value.supportsThinking,
        supportsWebSearch: defaultSettings.value.supportsWebSearch,
        allowCustomSystemPrompt: defaultSettings.value.allowCustomSystemPrompt,
        // AI 画图配置：apiKey 若为掩码值（**** 开头）原样回传，服务端保留原密钥
        imageGen: {
          apiKey: imageGenSettings.value.apiKey,
          baseUrl: imageGenSettings.value.baseUrl,
          model: imageGenSettings.value.model,
          size: imageGenSettings.value.size,
          watermark: imageGenSettings.value.watermark,
        },
        // 提示词模板：仅提交 {id,title,prompt}，长度与条数限制由服务端清洗
        promptTemplates: promptTemplates.value.map(t => ({
          id: t.id,
          title: t.title,
          prompt: t.prompt,
        })),
        presets: presetForms.value
          .filter(p => p.name && p.model)
          // 显式逐字段构造，避免将 apiKeyInput/collapsed 等 UI 字段提交到服务端
          .map(p => ({
            name: p.name,
            apiKey: resolveKeyPayload(p.apiKeyInput, p.apiKeyMasked),
            baseUrl: p.baseUrl,
            model: p.model,
            systemPrompt: p.systemPrompt,
            supportsVision: p.supportsVision,
            supportsAudio: p.supportsAudio,
            supportsThinking: p.supportsThinking,
            supportsWebSearch: p.supportsWebSearch,
            allowCustomSystemPrompt: p.allowCustomSystemPrompt,
            avatar: p.avatar,
          })),
      },
    })
    if (res.success) {
      success('设置已保存并即时生效')
      // 重新加载以刷新掩码与来源状态
      await loadSettings()
    }
  } catch (e: any) {
    error(e?.data?.message || '保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
/* 加载骨架 */
.settings-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.skeleton-banner {
  height: 72px;
  border-radius: var(--radius-lg);
}

.skeleton-card {
  height: 240px;
  border-radius: var(--radius-lg);
}

/* 配置来源横幅 */
.source-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
}

.source-file {
  background: var(--color-accent-bg);
  border: 1px solid var(--color-accent);
}

.source-env {
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
}

.source-icon {
  font-size: var(--text-xl);
  line-height: 1.4;
}

.source-text strong {
  display: block;
  margin-bottom: 2px;
}

.source-text p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.source-text code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background: var(--color-bg-tertiary);
  padding: 1px var(--space-1);
  border-radius: var(--radius-sm);
}

/* 分区卡片 */
.settings-card {
  padding: var(--space-6);
  margin-bottom: var(--space-4);
}

.card-header {
  margin-bottom: var(--space-4);
}

.card-header h3 {
  margin: 0 0 var(--space-1);
  font-size: var(--text-base);
}

.card-subtitle {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.preset-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

/* 表单通用 */
.form-group {
  margin-bottom: var(--space-4);
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.prompt-input {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  resize: vertical;
}

/* 密钥输入框 + 显隐切换 */
.input-with-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.input-with-btn .input {
  flex: 1;
}

.key-toggle {
  flex-shrink: 0;
}

/* 预设列表 */
.preset-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.preset-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.preset-summary {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: background var(--transition-fast);
  user-select: none;
}

.preset-summary:hover {
  background: var(--color-bg-secondary);
}

.preset-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
}

.preset-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  font-size: var(--text-base);
}

.preset-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preset-name {
  font-weight: 600;
  font-size: var(--text-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-model {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-caps {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* 密钥状态小圆点 */
.key-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border);
}

.key-dot.set {
  background: var(--color-success);
}

.preset-chevron {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  transition: transform var(--transition-fast);
  flex-shrink: 0;
}

.preset-chevron.expanded {
  transform: rotate(180deg);
}

.preset-body {
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

/* 头像输入 + 预览 */
.avatar-field {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.avatar-field .input {
  flex: 1;
}

.avatar-preview {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
}

/* 能力复选框 */
.caps-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.caps-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: var(--text-sm);
}

.caps-checkbox input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

/* 提示词模板列表 */
.template-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.template-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
}

.template-item-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.template-title-input {
  flex: 1;
}

/* 全局能力开关行 */
.switch-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
}

.switch-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.switch-title {
  font-weight: 500;
  font-size: var(--text-sm);
}

.switch-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* 滑动开关（自绘，站点无现成 switch 样式） */
.switch {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 100%;
  height: 100%;
  position: absolute;
  margin: 0;
  cursor: pointer;
  z-index: 1;
}

.switch-slider {
  position: absolute;
  inset: 0;
  background: var(--color-border);
  border-radius: var(--radius-full);
  transition: background var(--transition-fast);
  pointer-events: none;
}

.switch-slider::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-bg-primary);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.switch input:checked + .switch-slider {
  background: var(--color-accent);
}

.switch input:checked + .switch-slider::after {
  transform: translateX(20px);
}

/* 保存栏 */
.save-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.save-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* 响应式 */
@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .settings-card {
    padding: var(--space-4);
  }

  .preset-model {
    display: none;
  }
}
</style>
