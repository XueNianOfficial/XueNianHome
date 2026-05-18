<!--
============================================================
  管理后台 - 博客管理组件
  列表、新建、编辑、删除博客文章
============================================================
-->
<template>
  <div class="admin-blog">
    <!-- 操作栏 -->
    <div class="section-actions">
      <h3>文章列表（{{ posts.length }} 篇）</h3>
      <button class="btn-primary btn-sm" @click="openEditor(null)">+ 新建文章</button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-text">加载中...</div>

    <!-- 文章列表 -->
    <div v-else class="blog-list">
      <div v-for="post in posts" :key="post.slug" class="blog-item card">
        <div class="blog-item-info">
          <div class="blog-item-header">
            <h4>{{ post.title }}</h4>
            <span v-if="post.draft" class="draft-badge">草稿</span>
          </div>
          <p class="blog-item-meta">
            <span>📅 {{ post.date || '无日期' }}</span>
            <span>🔗 {{ post.slug }}</span>
            <span v-if="post.tags.length">🏷️ {{ post.tags.join(', ') }}</span>
          </p>
          <p class="blog-item-desc">{{ post.description || '无摘要' }}</p>
        </div>
        <div class="blog-item-actions">
          <button class="btn-outline btn-sm" @click="openEditor(post)">编辑</button>
          <button class="btn-danger btn-sm" @click="handleDelete(post)">删除</button>
        </div>
      </div>

      <div v-if="posts.length === 0" class="empty-state">
        <p>暂无文章，点击「新建文章」开始</p>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="showEditor" class="modal-overlay" @click.self="closeEditor">
      <div class="modal card">
        <h3>{{ editingPost ? '编辑文章' : '新建文章' }}</h3>

        <div class="form-group">
          <label>标题 *</label>
          <input v-model="form.title" class="form-input" placeholder="文章标题" />
        </div>

        <div class="form-row">
          <div class="form-group form-group-flex">
            <label>Slug *</label>
            <input v-model="form.slug" class="form-input" placeholder="url-slug" />
          </div>
          <div class="form-group form-group-flex">
            <label>日期</label>
            <input v-model="form.date" class="form-input" type="date" />
          </div>
        </div>

        <div class="form-group">
          <label>摘要</label>
          <input v-model="form.description" class="form-input" placeholder="简短描述" />
        </div>

        <div class="form-row">
          <div class="form-group form-group-flex">
            <label>标签（逗号分隔）</label>
            <input v-model="tagsInput" class="form-input" placeholder="标签1, 标签2" />
          </div>
          <div class="form-group form-group-flex">
            <label>封面图</label>
            <input v-model="form.cover" class="form-input" placeholder="/images/xxx.png" />
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input v-model="form.draft" type="checkbox" />
            草稿（不在网站显示）
          </label>
        </div>

        <div class="form-group">
          <label>正文（Markdown）</label>
          <textarea
            v-model="form.body"
            class="form-textarea"
            rows="12"
            placeholder="使用 Markdown 格式编写文章内容..."
          ></textarea>
        </div>

        <p v-if="saveError" class="form-error">{{ saveError }}</p>

        <div class="modal-actions">
          <button class="btn-outline" @click="closeEditor">取消</button>
          <button
            class="btn-primary"
            :disabled="!form.title || !form.slug || saving"
            @click="handleSave"
          >{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal card modal-sm">
        <h3>确认删除</h3>
        <p>确定要删除「{{ deleteTarget?.title }}」吗？此操作不可撤销。</p>
        <div class="modal-actions">
          <button class="btn-outline" @click="showDeleteConfirm = false">取消</button>
          <button class="btn-danger" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * AdminBlog - 博客管理组件
 * 列表、新建、编辑、删除博客文章
 */
import type { BlogPost } from '~/types'

/** 管理后台扩展的博客类型（含文件名和正文） */
interface AdminBlogPost extends BlogPost {
  filename: string
  body: string
}

const posts = ref<AdminBlogPost[]>([])
const loading = ref(true)

// 编辑器
const showEditor = ref(false)
const editingPost = ref<AdminBlogPost | null>(null)
const saving = ref(false)
const saveError = ref('')
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
    console.error('加载文章失败：', e)
  }
  loading.value = false
}

/** 打开编辑器 */
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
  saveError.value = ''
  showEditor.value = true
}

/** 关闭编辑器 */
function closeEditor() {
  showEditor.value = false
  editingPost.value = null
}

/** 保存文章 */
async function handleSave() {
  saving.value = true
  saveError.value = ''

  // 从输入解析标签
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
    closeEditor()
    await loadPosts()
  } catch (e: any) {
    saveError.value = e?.data?.message || '保存失败'
  }
  saving.value = false
}

/** 确认删除 */
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
    await loadPosts()
  } catch (e: any) {
    console.error('删除失败：', e)
  }
  deleting.value = false
}

onMounted(() => {
  loadPosts()
})
</script>

<style scoped>
.section-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-actions h3 {
  margin: 0;
  font-size: 1.1rem;
}

.blog-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.blog-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
}

.blog-item-info { flex: 1; min-width: 0; }
.blog-item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.blog-item-header h4 { margin: 0; font-size: 1rem; }
.draft-badge {
  font-size: 0.7rem;
  background: #FEF3C7;
  color: #92400E;
  padding: 1px 8px;
  border-radius: 10px;
}
html.dark .draft-badge { background: #422006; color: #FBBF24; }

.blog-item-meta {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 4px 0;
}

.blog-item-desc {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 4px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-item-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-sm { padding: 4px 14px; font-size: 0.8rem; }
.btn-danger {
  padding: 4px 14px;
  font-size: 0.8rem;
  background: #DC2626;
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.btn-danger:hover { opacity: 0.85; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--color-text-muted);
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 40px;
  z-index: 100;
  overflow-y: auto;
}

.modal {
  width: 720px;
  max-width: 95vw;
  padding: 24px;
  margin-bottom: 40px;
}

.modal-sm { width: 400px; }

.modal h3 { margin: 0 0 20px; font-size: 1.15rem; }

/* 表单 */
.form-group { margin-bottom: 14px; }
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
.form-input:focus, .form-textarea:focus {
  border-color: var(--color-accent);
}
.form-textarea { resize: vertical; font-family: var(--font-mono); line-height: 1.6; }

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 6px;
  font-weight: 400 !important;
  cursor: pointer;
}
.checkbox-label input { width: auto; }

.form-error { color: #DC2626; font-size: 0.85rem; margin: 0 0 8px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }

@media (max-width: 640px) {
  .form-row { flex-direction: column; }
  .blog-item { flex-direction: column; }
}
</style>
