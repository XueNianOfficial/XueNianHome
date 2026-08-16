<!--
============================================================
  管理后台 - 图片管理组件
  浏览、上传、编辑元数据、删除 public/images/ 下的图片
  - 上传区域：虚线点击上传卡片（含格式提示与上传中状态）
  - 图片网格：悬停显示操作（复制路径/编辑信息/删除）
  - 删除经 AdminConfirm 二次确认，操作结果统一 Toast 反馈
============================================================
-->
<template>
  <div class="admin-gallery">
    <!-- 操作栏 -->
    <div class="section-actions">
      <h3 class="section-title-sm">
        图片列表 <span class="badge">{{ images.length }} 张</span>
      </h3>
    </div>

    <!-- 上传区域（点击选择文件，样式为拖拽区提示） -->
    <div
      class="upload-zone card"
      :class="{ 'upload-zone--busy': uploading }"
      role="button"
      tabindex="0"
      @click="triggerUpload"
      @keydown.enter="triggerUpload"
    >
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        class="file-input-hidden"
        @change="handleFilesSelected"
      />
      <template v-if="uploading">
        <span class="spinner"></span>
        <p class="upload-zone-text">上传中…</p>
      </template>
      <template v-else>
        <span class="upload-zone-icon">🖼️</span>
        <p class="upload-zone-text">点击选择图片上传</p>
        <p class="upload-zone-hint">支持 PNG / JPG / GIF / WebP / SVG，可多选</p>
      </template>
    </div>

    <!-- 加载中：骨架屏网格 -->
    <div v-if="loading" class="gallery-grid">
      <div v-for="i in 6" :key="i" class="skeleton gallery-skeleton"></div>
    </div>

    <!-- 空列表 -->
    <div v-else-if="images.length === 0" class="empty-state card">
      <span class="empty-state-icon">🖼️</span>
      <p>暂无图片，点击上方区域上传第一张吧</p>
    </div>

    <!-- 图片网格 -->
    <div v-else class="gallery-grid">
      <div v-for="img in images" :key="img.filename" class="gallery-item card">
        <div class="gallery-img-wrap">
          <img :src="img.path" :alt="img.title || img.filename" loading="lazy" />
          <!-- 悬停操作层（触屏设备常显） -->
          <div class="gallery-hover-actions">
            <button
              type="button"
              class="icon-btn gallery-action-btn"
              title="复制路径"
              @click.stop="copyPath(img.path)"
            >📋</button>
            <button
              type="button"
              class="icon-btn gallery-action-btn"
              title="编辑信息"
              @click.stop="openEdit(img)"
            >✏️</button>
            <button
              type="button"
              class="icon-btn gallery-action-btn gallery-action-btn--danger"
              title="删除"
              @click.stop="handleDelete(img)"
            >🗑️</button>
          </div>
        </div>
        <div class="gallery-info">
          <p class="gallery-name" :title="img.title || img.filename">{{ img.title || img.filename }}</p>
          <p class="gallery-meta">
            <span class="gallery-size">{{ img.sizeFormatted }}</span>
            <span v-if="img.category && img.category !== 'other'" class="badge">{{ categoryLabel(img.category) }}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- 编辑元数据弹窗 -->
    <div v-if="showEditModal" class="modal-overlay modal-overlay--top" @click.self="closeEdit">
      <div class="modal-panel card modal-panel--sm">
        <div class="modal-header">
          <h3 class="modal-title">编辑图片信息</h3>
          <button type="button" class="icon-btn" title="关闭" @click="closeEdit">✕</button>
        </div>

        <div v-if="editTarget" class="edit-preview">
          <img :src="editTarget.path" :alt="editTarget.filename" />
        </div>

        <div class="form-group">
          <label class="field-label" for="gallery-filename">文件名</label>
          <input id="gallery-filename" class="input" :value="editTarget?.filename" disabled />
          <p class="field-hint">文件名不可修改</p>
        </div>

        <div class="form-group">
          <label class="field-label" for="gallery-title">标题</label>
          <input
            id="gallery-title"
            v-model="editForm.title"
            class="input"
            placeholder="输入图片标题"
          />
        </div>

        <div class="form-group">
          <label class="field-label" for="gallery-desc">描述</label>
          <textarea
            id="gallery-desc"
            v-model="editForm.description"
            class="input edit-textarea"
            placeholder="输入图片描述（可选）"
            rows="3"
          ></textarea>
        </div>

        <div class="form-group">
          <label class="field-label" for="gallery-category">分类</label>
          <select id="gallery-category" v-model="editForm.category" class="input">
            <option value="illustration">插画</option>
            <option value="avatar">头像</option>
            <option value="logo">Logo</option>
            <option value="other">其他</option>
          </select>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-ghost" :disabled="saving" @click="closeEdit">取消</button>
          <button type="button" class="btn-primary" :disabled="saving" @click="confirmEdit">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认（二次确认弹窗） -->
    <AdminConfirm
      :show="showDeleteConfirm"
      title="删除图片"
      :description="`确定要删除「${deleteTarget?.filename}」吗？此操作不可撤销。`"
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
 * AdminGallery - 图片管理组件
 *
 * 接口契约：
 *   GET  /api/admin/gallery/list            → { success, data: AdminGalleryImage[] }
 *   POST /api/admin/gallery/upload          FormData（字段名 images，可多文件）→ { success, message }
 *   POST /api/admin/gallery/update          { filename, title, description, category }
 *   POST /api/admin/gallery/delete          { filename }
 * 图片类型/大小校验由服务端执行，失败时直接展示服务端返回的中文 message
 */
import AdminConfirm from './AdminConfirm.vue'

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

const { success, error } = useToast()

const images = ref<AdminGalleryImage[]>([])
const loading = ref(true)

// 上传
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

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
    error(e?.data?.message || '加载图片列表失败')
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

/** 关闭编辑弹窗 */
function closeEdit() {
  if (saving.value) return
  showEditModal.value = false
}

/** 保存元数据编辑 */
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
    success('保存成功')
    await loadImages()
  } catch (e: any) {
    error(e?.data?.message || '保存失败')
  }
  saving.value = false
}

/** 触发文件选择（上传中禁止重复触发） */
function triggerUpload() {
  if (uploading.value) return
  fileInput.value?.click()
}

/** 文件选择后上传 */
async function handleFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  uploading.value = true

  const formData = new FormData()
  for (const file of files) {
    formData.append('images', file)
  }

  try {
    const res = await $fetch<{ success: boolean; message: string; data?: any }>('/api/admin/gallery/upload', {
      method: 'POST',
      body: formData
    })
    success(res.message || '上传成功')
    await loadImages()
  } catch (err: any) {
    error(err?.data?.message || '上传失败')
  }

  uploading.value = false
  input.value = '' // 清空以允许重复上传同一文件
}

/** 复制图片路径到剪贴板 */
async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path)
    success('路径已复制')
  } catch {
    // 剪贴板 API 不可用时的降级方案
    try {
      const ta = document.createElement('textarea')
      ta.value = path
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      success('路径已复制')
    } catch {
      error('复制失败，请手动复制')
    }
  }
}

/** 打开删除确认弹窗 */
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
    success('删除成功')
    await loadImages()
  } catch (e: any) {
    error(e?.data?.message || '删除失败')
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

/* ---------- 上传区域 ---------- */
.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  margin-bottom: var(--space-4);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  text-align: center;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast);
}

.upload-zone:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-bg);
}

.upload-zone--busy {
  cursor: wait;
  opacity: 0.7;
}

.upload-zone-icon {
  font-size: 2rem;
  opacity: 0.7;
}

.upload-zone-text {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.upload-zone-hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.file-input-hidden {
  display: none;
}

/* ---------- 图片网格 ---------- */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
}

.gallery-skeleton {
  aspect-ratio: 1;
}

.gallery-item {
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
}

.gallery-img-wrap {
  position: relative;
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

/* 悬停操作层：默认隐藏，悬停/聚焦时淡入 */
.gallery-hover-actions {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--color-bg-mask);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.gallery-item:hover .gallery-hover-actions,
.gallery-item:focus-within .gallery-hover-actions {
  opacity: 1;
}

.gallery-action-btn {
  background: var(--color-bg-secondary);
  box-shadow: var(--shadow-sm);
}

.gallery-action-btn:hover {
  background: var(--color-bg-secondary);
  transform: scale(1.08);
}

.gallery-action-btn--danger:hover {
  background: var(--color-danger-bg);
}

/* 触屏设备无悬停，操作按钮常显 */
@media (hover: none) {
  .gallery-hover-actions {
    opacity: 1;
    background: none;
    inset: auto var(--space-1) var(--space-1) auto;
    gap: var(--space-1);
  }
}

.gallery-info {
  padding: var(--space-2) var(--space-1) 0;
  flex: 1;
}

.gallery-name {
  font-size: var(--text-xs);
  color: var(--color-text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin: var(--space-1) 0 0;
}

.gallery-size {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* ---------- 弹窗（基础样式见 main.css 全局 .modal-* 体系） ---------- */
.modal-title {
  margin: 0;
  font-size: var(--text-lg);
}

.modal-actions {
  margin-top: var(--space-6);
}

/* 编辑弹窗图片预览 */
.edit-preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  margin-bottom: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* ---------- 表单 ---------- */
.form-group {
  margin-bottom: var(--space-4);
}

.edit-textarea {
  resize: vertical;
  min-height: 60px;
}

</style>
