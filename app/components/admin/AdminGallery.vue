<!--
============================================================
  管理后台 - 图片管理组件
  浏览、上传、删除 public/images/ 下的图片
============================================================
-->
<template>
  <div class="admin-gallery">
    <!-- 操作栏 -->
    <div class="section-actions">
      <h3>图片列表（{{ images.length }} 张）</h3>
      <div class="upload-area">
        <input
          ref="fileInput"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          class="file-input-hidden"
          @change="handleFilesSelected"
        />
        <button class="btn-primary btn-sm" :disabled="uploading" @click="triggerUpload">
          {{ uploading ? '上传中...' : '+ 上传图片' }}
        </button>
      </div>
    </div>

    <!-- 上传状态 -->
    <div v-if="uploadMsg" class="upload-msg" :class="uploadOk ? 'upload-ok' : 'upload-err'">
      {{ uploadMsg }}
    </div>

    <!-- 图片网格 -->
    <div v-if="loading" class="loading-text">加载中...</div>
    <div v-else class="gallery-grid">
      <div v-for="img in images" :key="img.filename" class="gallery-item card">
        <div class="gallery-img-wrap">
          <img :src="img.path" :alt="img.filename" loading="lazy" />
        </div>
        <div class="gallery-info">
          <p class="gallery-name" :title="img.title || img.filename">{{ img.title || img.filename }}</p>
          <p class="gallery-meta">
            <span class="gallery-size">{{ img.sizeFormatted }}</span>
            <span v-if="img.category && img.category !== 'other'" class="gallery-category">{{ categoryLabel(img.category) }}</span>
          </p>
        </div>
        <div class="gallery-actions">
          <button
            class="btn-copy"
            :title="'复制路径'"
            @click="copyPath(img.path)"
          >📋</button>
          <button
            class="btn-edit-icon"
            title="编辑信息"
            @click="openEdit(img)"
          >✏️</button>
          <button
            class="btn-delete-icon"
            title="删除"
            @click="handleDelete(img)"
          >🗑️</button>
        </div>
      </div>

      <div v-if="images.length === 0" class="empty-state">
        <p>暂无图片</p>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal card modal-sm">
        <h3>编辑图片信息</h3>
        <div class="edit-preview" v-if="editTarget">
          <img :src="editTarget.path" :alt="editTarget.filename" />
        </div>
        <div class="form-group">
          <label class="form-label">文件名</label>
          <input class="form-input" :value="editTarget?.filename" disabled />
        </div>
        <div class="form-group">
          <label class="form-label">标题</label>
          <input
            class="form-input"
            v-model="editForm.title"
            placeholder="输入图片标题"
          />
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea
            class="form-input form-textarea"
            v-model="editForm.description"
            placeholder="输入图片描述（可选）"
            rows="3"
          ></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">分类</label>
          <select class="form-input" v-model="editForm.category">
            <option value="illustration">插画</option>
            <option value="avatar">头像</option>
            <option value="logo">Logo</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn-outline" @click="showEditModal = false">取消</button>
          <button class="btn-primary btn-sm" :disabled="saving" @click="confirmEdit">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal card modal-sm">
        <h3>确认删除</h3>
        <p>确定要删除「{{ deleteTarget?.filename }}」吗？</p>
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
 * AdminGallery - 图片管理组件
 * 浏览、上传、删除 public/images/ 下的图片
 */

/** 管理后台图片条目（文件系统信息 + 元数据） */
interface AdminGalleryImage {
  filename: string
  path: string
  size: number
  sizeFormatted: string
  modifiedAt: string
  title: string
  description: string
  category: string
}

/** 编辑表单 */
interface EditForm {
  title: string
  description: string
  category: string
}

const images = ref<AdminGalleryImage[]>([])
const loading = ref(true)

// 上传
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadMsg = ref('')
const uploadOk = ref(true)

// 编辑
const showEditModal = ref(false)
const editTarget = ref<AdminGalleryImage | null>(null)
const editForm = reactive<EditForm>({ title: '', description: '', category: 'other' })
const saving = ref(false)

// 删除
const showDeleteConfirm = ref(false)
const deleteTarget = ref<AdminGalleryImage | null>(null)
const deleting = ref(false)

/** 加载图片列表 */
async function loadImages() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: AdminGalleryImage[] }>('/api/admin/gallery/list')
    images.value = res.data || []
  } catch (e: any) {
    console.error('加载图片失败：', e)
  }
  loading.value = false
}

/** 打开编辑弹窗 */
function openEdit(img: AdminGalleryImage) {
  editTarget.value = img
  editForm.title = img.title || ''
  editForm.description = img.description || ''
  editForm.category = img.category || 'other'
  showEditModal.value = true
}

/** 保存编辑 */
async function confirmEdit() {
  if (!editTarget.value) return
  saving.value = true
  try {
    await $fetch('/api/admin/gallery/update', {
      method: 'POST',
      body: {
        filename: editTarget.value.filename,
        title: editForm.title,
        description: editForm.description,
        category: editForm.category
      }
    })
    showEditModal.value = false
    await loadImages()
  } catch (e: any) {
    console.error('保存失败：', e)
  }
  saving.value = false
}

/** 触发文件选择 */
function triggerUpload() {
  fileInput.value?.click()
}

/** 文件选择后上传 */
async function handleFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  uploading.value = true
  uploadMsg.value = ''
  uploadOk.value = true

  const formData = new FormData()
  for (const file of files) {
    formData.append('images', file)
  }

  try {
    const res = await $fetch<{ success: boolean; message: string; data?: any }>('/api/admin/gallery/upload', {
      method: 'POST',
      body: formData
    })
    uploadMsg.value = res.message || '上传成功'
    uploadOk.value = true
    await loadImages()
  } catch (e: any) {
    uploadMsg.value = e?.data?.message || '上传失败'
    uploadOk.value = false
  }

  uploading.value = false
  input.value = '' // 清空以允许重复上传同一文件
}

/** 复制路径 */
async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path)
  } catch {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = path
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

/** 确认删除 */
function handleDelete(img: AdminGalleryImage) {
  deleteTarget.value = img
  showDeleteConfirm.value = true
}

/** 执行删除 */
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await $fetch('/api/admin/gallery/delete', {
      method: 'POST',
      body: { filename: deleteTarget.value.filename }
    })
    showDeleteConfirm.value = false
    await loadImages()
  } catch (e: any) {
    console.error('删除失败：', e)
  }
  deleting.value = false
}

/** 分类标签映射 */
function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    illustration: '插画',
    avatar: '头像',
    logo: 'Logo',
    other: '其他'
  }
  return map[cat] || cat
}

onMounted(() => {
  loadImages()
})
</script>

<style scoped>
.section-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.section-actions h3 { margin: 0; font-size: 1.1rem; }

.file-input-hidden { display: none; }

.upload-msg {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  margin-bottom: 12px;
}
.upload-ok { background: #ECFDF5; color: #065F46; }
.upload-err { background: #FEF2F2; color: #DC2626; }
html.dark .upload-ok { background: #064E3B; color: #A7F3D0; }
html.dark .upload-err { background: #3B1111; color: #FCA5A5; }

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.gallery-item {
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.gallery-img-wrap {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.gallery-img-wrap img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.gallery-info {
  padding: 6px 4px 0;
  flex: 1;
}

.gallery-name {
  font-size: 0.75rem;
  color: var(--color-text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-size {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  margin: 2px 0 0;
}

.gallery-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  margin: 2px 0 0;
}

.gallery-category {
  font-size: 0.65rem;
  color: var(--color-primary);
  background: var(--color-bg-hover);
  padding: 1px 6px;
  border-radius: 3px;
}

.gallery-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  padding: 0 4px;
}

.btn-copy, .btn-edit-icon, .btn-delete-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background var(--transition-fast);
}
.btn-copy:hover { background: var(--color-bg-hover); }
.btn-edit-icon:hover { background: #DBEAFE; }
.btn-delete-icon:hover { background: #FEE2E2; }

.empty-state { text-align: center; padding: 40px; color: var(--color-text-muted); }
.loading-text { text-align: center; padding: 20px; color: var(--color-text-muted); }

/* 弹窗 */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 40px; z-index: 100;
}
.modal { width: 720px; max-width: 95vw; padding: 24px; }
.modal-sm { width: 400px; }
.modal h3 { margin: 0 0 16px; font-size: 1.15rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }

.btn-sm { padding: 4px 14px; font-size: 0.8rem; }
.btn-danger {
  padding: 4px 14px; font-size: 0.8rem;
  background: #DC2626; color: #fff; border: none;
  border-radius: var(--radius-sm); cursor: pointer;
}
.btn-danger:hover { opacity: 0.85; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

/* 编辑弹窗 */
.edit-preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.edit-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.form-group {
  margin-bottom: 14px;
}
.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.form-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  outline: none;
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}
.form-input:focus {
  border-color: var(--color-primary);
}
.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.form-textarea {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}
</style>
