<!--
  ============================================================
  AdminFriends - 友链管理
  - 卡片式编辑友链（名称 / 链接 / 头像 / 描述），头像实时预览
  - 删除走 AdminConfirm 二次确认（本地删除，保存后才生效）
  - 底部「保存友链」一次性提交完整列表
  ============================================================
-->
<template>
  <div class="admin-friends">
    <!-- 操作栏 -->
    <div class="section-actions">
      <h3>友链列表（{{ friends.length }} 条）</h3>
      <button type="button" class="btn-primary btn-sm" @click="addFriend">＋ 添加友链</button>
    </div>

    <!-- 加载骨架 -->
    <div v-if="loading" class="friends-skeleton">
      <div v-for="i in 3" :key="i" class="skeleton skeleton-card"></div>
    </div>

    <template v-else>
      <!-- 空状态 -->
      <div v-if="friends.length === 0" class="empty-state">
        <div class="empty-state-icon">🔗</div>
        <p>暂无友链，点击「添加友链」开始</p>
      </div>

      <!-- 友链编辑卡片列表 -->
      <div class="friends-list">
        <div
          v-for="(friend, index) in friends"
          :key="index"
          class="friend-edit-card card"
        >
          <div class="friend-card-header">
            <span class="friend-index">#{{ index + 1 }}</span>
            <button
              type="button"
              class="icon-btn"
              title="删除该友链"
              @click="askRemove(index)"
            >🗑️</button>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="field-label">名称</label>
              <input v-model="friend.name" type="text" class="input" placeholder="好友名称" />
            </div>
            <div class="form-group">
              <label class="field-label">链接</label>
              <input v-model="friend.url" type="text" class="input" placeholder="https://..." />
            </div>
          </div>

          <div class="form-group">
            <label class="field-label">头像 URL</label>
            <div class="avatar-field">
              <input
                v-model="friend.avatar"
                type="text"
                class="input"
                placeholder="/images/xxx.png 或 https://..."
              />
              <!-- 头像预览：加载失败时隐藏，避免破图影响观感 -->
              <img
                v-if="friend.avatar"
                :src="friend.avatar"
                alt="头像预览"
                class="avatar-preview"
                :style="{ opacity: avatarFailed[index] ? 0 : 1 }"
                @error="avatarFailed[index] = true"
                @load="avatarFailed[index] = false"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="field-label">描述</label>
            <input v-model="friend.description" type="text" class="input" placeholder="简短描述" />
          </div>
        </div>
      </div>

      <!-- 保存栏 -->
      <div class="save-bar">
        <button
          type="button"
          class="btn-primary"
          :disabled="saving"
          @click="handleSave"
        >
          <span v-if="saving" class="spinner"></span>
          {{ saving ? '保存中…' : '💾 保存友链' }}
        </button>
        <span class="save-hint">所有修改（含删除）需点击保存后才会生效</span>
      </div>
    </template>

    <!-- 删除确认弹窗（仅本地移除，保存后生效，无需 loading） -->
    <AdminConfirm
      :show="deleteIndex !== null"
      title="删除友链"
      :description="`确定要删除「${deleteIndex !== null ? friends[deleteIndex]?.name || `#${deleteIndex + 1}` : ''}」吗？删除后需点击「保存友链」才会生效。`"
      confirm-text="删除"
      @confirm="confirmRemove"
      @cancel="deleteIndex = null"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  AdminFriends - 友链管理组件
 *  - GET  /api/admin/friends/list 读取列表
 *  - POST /api/admin/friends/save 提交完整列表（body: { friends }）
 *  ============================================================
 */
import type { FriendLink } from '~/types'
import AdminConfirm from './AdminConfirm.vue'

const { success, error } = useToast()

const friends = ref<FriendLink[]>([])
const loading = ref(true)
const saving = ref(false)
/** 待删除的友链下标（null = 无待确认删除） */
const deleteIndex = ref<number | null>(null)
/** 各行头像预览加载失败标记（按下标记录） */
const avatarFailed = ref<Record<number, boolean>>({})

/** 加载友链列表 */
async function loadFriends() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: FriendLink[] }>('/api/admin/friends/list')
    if (res.success && res.data) {
      friends.value = res.data
    }
  } catch (e: any) {
    error(e?.data?.message || '加载友链失败')
  } finally {
    loading.value = false
  }
}

/** 添加新友链（头像默认站点 Logo，链接默认 https:// 前缀） */
function addFriend() {
  friends.value.push({
    name: '',
    avatar: '/images/头像.png',
    description: '',
    url: 'https://'
  })
}

/** 发起删除确认 */
function askRemove(index: number) {
  deleteIndex.value = index
}

/** 确认删除：仅从本地列表移除，点击「保存友链」后生效 */
function confirmRemove() {
  if (deleteIndex.value !== null) {
    friends.value.splice(deleteIndex.value, 1)
    deleteIndex.value = null
  }
}

/** 保存友链（整体提交） */
async function handleSave() {
  saving.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string }>('/api/admin/friends/save', {
      method: 'POST',
      body: { friends: friends.value }
    })
    success(res.message || '保存成功')
  } catch (e: any) {
    error(e?.data?.message || '保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadFriends()
})
</script>

<style scoped>
.section-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.section-actions h3 {
  margin: 0;
  font-size: var(--text-base);
}

/* 加载骨架 */
.friends-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.skeleton-card {
  height: 180px;
  border-radius: var(--radius-lg);
}

/* 友链编辑卡片 */
.friends-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.friend-edit-card {
  padding: var(--space-4);
}

.friend-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.friend-index {
  font-weight: 600;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-family: var(--font-mono);
}

.form-group {
  margin-bottom: var(--space-3);
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
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
  transition: opacity var(--transition-fast);
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
    gap: 0;
  }
}
</style>
