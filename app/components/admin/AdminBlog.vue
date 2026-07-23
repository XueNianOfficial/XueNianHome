<!--
============================================================
  管理后台 - 博客管理组件
  列表、新建、编辑、删除博客文章
  - 列表：标题/日期/草稿徽章/操作，骨架屏加载，空态提示
  - 编辑弹窗：设计系统表单控件 + Markdown 等宽编辑框 + 草稿开关
  - 删除经 AdminConfirm 二次确认，操作结果统一 Toast 反馈
============================================================
-->
<template>
  <div class="admin-blog">
    <!-- 操作栏 -->
    <div class="section-actions">
      <h3 class="section-title-sm">
        文章列表 <span class="badge">{{ posts.length }} 篇</span>
      </h3>
      <button type="button" class="btn-primary btn-sm" @click="openEditor(null)">
        ＋ 新建文章
      </button>
    </div>

    <!-- 加载中：骨架屏 -->
    <div v-if="loading" class="blog-list">
      <div v-for="i in 3" :key="i" class="skeleton blog-skeleton"></div>
    </div>

    <!-- 空列表 -->
    <div v-else-if="posts.length === 0" class="empty-state card">
      <span class="empty-state-icon">📭</span>
      <p>暂无文章，点击「新建文章」开始写作吧</p>
    </div>

    <!-- 文章列表 -->
    <div v-else class="blog-list">
      <div v-for="post in posts" :key="post.slug" class="blog-item card">
        <div class="blog-item-info">
          <div class="blog-item-header">
            <h4 class="blog-item-title">{{ post.title }}</h4>
            <span v-if="post.draft" class="badge badge-warning">草稿</span>
          </div>
          <p class="blog-item-meta">
            <span>📅 {{ post.date || '无日期' }}</span>
            <span class="blog-item-slug">🔗 {{ post.slug }}</span>
          </p>
          <p v-if="post.tags.length" class="blog-item-tags">
            <span v-for="tag in post.tags" :key="tag" class="badge">{{ tag }}</span>
          </p>
          <p class="blog-item-desc">{{ post.description || '无摘要' }}</p>
        </div>
        <div class="blog-item-actions">
          <button type="button" class="btn-outline btn-sm" @click="openEditor(post)">编辑</button>
          <button type="button" class="btn-danger btn-sm" @click="handleDelete(post)">删除</button>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="showEditor" class="modal-overlay" @click.self="closeEditor">
      <div class="modal card">
        <div class="modal-header">
          <h3 class="modal-title">{{ editingPost ? '编辑文章' : '新建文章' }}</h3>
          <button type="button" class="icon-btn" title="关闭" @click="closeEditor">✕</button>
        </div>

        <div class="form-group">
          <label class="field-label" for="blog-title">标题 *</label>
          <input id="blog-title" v-model="form.title" class="input" placeholder="文章标题" />
        </div>

        <div class="form-row">
          <div class="form-group form-group-flex">
            <label class="field-label" for="blog-slug">Slug *</label>
            <input id="blog-slug" v-model="form.slug" class="input" placeholder="url-slug" />
            <p class="field-hint">文章的 URL 标识，如 hello-world</p>
          </div>
          <div class="form-group form-group-flex">
            <label class="field-label" for="blog-date">日期</label>
            <input id="blog-date" v-model="form.date" class="input" type="date" />
          </div>
        </div>

        <div class="form-group">
          <label class="field-label" for="blog-desc">摘要</label>
          <input id="blog-desc" v-model="form.description" class="input" placeholder="一句话描述文章内容" />
        </div>

        <div class="form-row">
          <div class="form-group form-group-flex">
            <label class="field-label" for="blog-tags">标签</label>
            <input id="blog-tags" v-model="tagsInput" class="input" placeholder="标签1, 标签2" />
            <p class="field-hint">多个标签用逗号分隔</p>
          </div>
          <div class="form-group form-group-flex">
            <label class="field-label" for="blog-cover">封面图</label>
            <input id="blog-cover" v-model="form.cover" class="input" placeholder="/images/xxx.png" />
            <p class="field-hint">public/images/ 下的图片路径</p>
          </div>
        </div>

        <!-- 草稿开关 -->
        <div class="form-group draft-row">
          <div class="draft-row-text">
            <span class="field-label">设为草稿</span>
            <p class="field-hint">草稿不会在网站博客列表中显示</p>
          </div>
          <label class="switch">
            <input v-model="form.draft" type="checkbox" />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="form-group">
          <label class="field-label" for="blog-body">正文（Markdown）</label>
          <textarea
            id="blog-body"
            v-model="form.body"
            class="input editor-textarea"
            rows="12"
            placeholder="使用 Markdown 格式编写文章内容..."
          ></textarea>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-ghost" :disabled="saving" @click="closeEditor">取消</button>
          <button
            type="button"
            class="btn-primary"
            :disabled="!form.title || !form.slug || saving"
            @click="handleSave"
          >{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 删除确认（二次确认弹窗） -->
    <AdminConfirm
      :show="showDeleteConfirm"
      title="删除文章"
      :description="`确定要删除「${deleteTarget?.title}」吗？此操作不可撤销。`"
      confirm-text="确认删除"
      loading-text="删除中…"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * AdminBlog - 博客管理组件
 *
 * 接口契约：
 *   GET  /api/admin/blog/list   → { success, data: AdminBlogPost[] }
 *   POST /api/admin/blog/save   { slug, title, date, description, cover, tags, draft, body, oldSlug? }
 *   POST /api/admin/blog/delete { slug }
 */
import type { BlogPost } from '~/types'
import AdminConfirm from './AdminConfirm.vue'

/** 管理后台扩展的博客类型（含文件名和正文） */
interface AdminBlogPost extends BlogPost {
  filename: string
  body: string
}

const { success, error } = useToast()

const posts = ref<AdminBlogPost[]>([])
const loading = ref(true)

// 编辑器
const showEditor = ref(false)
const editingPost = ref<AdminBlogPost | null>(null)
const saving = ref(false)
const tagsInput = ref('')

const form = reactive({
  slug: '',
  title: '',
  date: '',
  description: '',
  cover: '',
  tags: [] as string[],
  draft: false,
  body: ''
})

// 删除
const showDeleteConfirm = ref(false)
const deleteTarget = ref<AdminBlogPost | null>(null)
const deleting = ref(false)

/** 加载文章列表 */
async function loadPosts() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: AdminBlogPost[] }>('/api/admin/blog/list')
    posts.value = res.data || []
  } catch (e: any) {
    error(e?.data?.message || '加载文章列表失败')
  }
  loading.value = false
}

/** 打开编辑器（传 null 为新建） */
function openEditor(post: AdminBlogPost | null) {
  editingPost.value = post
  if (post) {
    form.slug = post.slug
    form.title = post.title
    form.date = post.date
    form.description = post.description
    form.cover = post.cover || ''
    form.tags = [...post.tags]
    form.draft = post.draft
    form.body = post.body
    tagsInput.value = post.tags.join(', ')
  } else {
    form.slug = ''
    form.title = ''
    form.date = new Date().toISOString().slice(0, 10)
    form.description = ''
    form.cover = ''
    form.tags = []
    form.draft = false
    form.body = ''
    tagsInput.value = ''
  }
  showEditor.value = true
}

/** 关闭编辑器 */
function closeEditor() {
  if (saving.value) return
  showEditor.value = false
  editingPost.value = null
}

/** 保存文章（新建或更新） */
async function handleSave() {
  saving.value = true

  // 从输入解析标签（兼容中英文逗号）
  form.tags = tagsInput.value
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(Boolean)

  try {
    await $fetch('/api/admin/blog/save', {
      method: 'POST',
      body: {
        ...form,
        oldSlug: editingPost.value?.slug
      }
    })
    showEditor.value = false
    editingPost.value = null
    success('保存成功')
    await loadPosts()
  } catch (e: any) {
    error(e?.data?.message || '保存失败')
  }
  saving.value = false
}

/** 打开删除确认弹窗 */
function handleDelete(post: AdminBlogPost) {
  deleteTarget.value = post
  showDeleteConfirm.value = true
}

/** 执行删除 */
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await $fetch('/api/admin/blog/delete', {
      method: 'POST',
      body: { slug: deleteTarget.value.slug }
    })
    showDeleteConfirm.value = false
    success('删除成功')
    await loadPosts()
  } catch (e: any) {
    error(e?.data?.message || '删除失败')
  }
  deleting.value = false
}

onMounted(() => {
  loadPosts()
})
</script>

<style scoped>
/* ---------- 操作栏 ---------- */
.section-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.section-title-sm {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-lg);
}

/* ---------- 文章列表 ---------- */
.blog-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.blog-skeleton {
  height: 96px;
}

.blog-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-4);
}

.blog-item-info {
  flex: 1;
  min-width: 0;
}

.blog-item-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.blog-item-title {
  margin: 0;
  font-size: var(--text-base);
}

.blog-item-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: var(--space-1) 0;
}

.blog-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin: var(--space-1) 0;
}

.blog-item-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: var(--space-1) 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-item-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* ---------- 弹窗 ---------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-bg-mask);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  z-index: var(--z-modal);
  overflow-y: auto;
  animation: modal-fade-in var(--transition-fast);
}

.modal {
  width: 720px;
  max-width: 95vw;
  padding: var(--space-6);
  margin-bottom: var(--space-8);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.modal-title {
  margin: 0;
  font-size: var(--text-lg);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-6);
}

/* ---------- 表单 ---------- */
.form-group {
  margin-bottom: var(--space-4);
}

.form-row {
  display: flex;
  gap: var(--space-3);
}

.form-group-flex {
  flex: 1;
  min-width: 0;
}

/* Markdown 编辑框：等宽字体 */
.editor-textarea {
  resize: vertical;
  font-family: var(--font-mono);
  line-height: 1.6;
}

/* ---------- 草稿开关行 ---------- */
.draft-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
}

.draft-row .field-label {
  margin-bottom: 0;
}

.draft-row .field-hint {
  margin-top: var(--space-1);
}

/* 开关控件 */
.switch {
  position: relative;
  display: inline-block;
  width: 42px;
  height: 24px;
  flex-shrink: 0;
  cursor: pointer;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  inset: 0;
  background: var(--color-border);
  border-radius: var(--radius-full);
  transition: background-color var(--transition-fast);
}

.switch-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  top: 3px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.switch input:checked + .switch-slider {
  background: var(--color-accent);
}

.switch input:checked + .switch-slider::before {
  transform: translateX(18px);
}

.switch input:focus-visible + .switch-slider {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* ---------- 动画 ---------- */
@keyframes modal-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .form-row {
    flex-direction: column;
    gap: 0;
  }

  .blog-item {
    flex-direction: column;
  }
}
</style>
