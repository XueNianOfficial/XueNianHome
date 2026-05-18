<!--
============================================================
  管理后台 - 友链管理组件
  添加、编辑、删除友链
============================================================
-->
<template>
  <div class="admin-friends">
    <!-- 操作栏 -->
    <div class="section-actions">
      <h3>友链列表（{{ friends.length }} 条）</h3>
      <button class="btn-primary btn-sm" @click="addFriend">+ 添加友链</button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-text">加载中...</div>

    <!-- 友链列表 -->
    <template v-else>
      <div v-if="friends.length === 0" class="empty-state">
        <p>暂无友链，点击「添加友链」开始</p>
      </div>

      <div class="friends-list">
        <div
          v-for="(friend, index) in friends"
          :key="index"
          class="friend-edit-card card"
        >
          <div class="friend-card-header">
            <span class="friend-index">#{{ index + 1 }}</span>
            <button class="btn-delete-text" @click="removeFriend(index)">删除</button>
          </div>

          <div class="form-row">
            <div class="form-group form-group-flex">
              <label>名称</label>
              <input v-model="friend.name" class="form-input" placeholder="好友名称" />
            </div>
            <div class="form-group form-group-flex">
              <label>链接</label>
              <input v-model="friend.url" class="form-input" placeholder="https://..." />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group form-group-flex">
              <label>头像 URL</label>
              <input v-model="friend.avatar" class="form-input" placeholder="/images/xxx.png 或 https://..." />
            </div>
          </div>

          <div class="form-group">
            <label>描述</label>
            <input v-model="friend.description" class="form-input" placeholder="简短描述" />
          </div>
        </div>
      </div>

      <!-- 保存栏 -->
      <div class="save-bar">
        <p v-if="saveMsg" class="save-msg" :class="saveOk ? 'save-ok' : 'save-err'">
          {{ saveMsg }}
        </p>
        <button
          class="btn-primary"
          :disabled="saving"
          @click="handleSave"
        >{{ saving ? '保存中...' : '💾 保存友链' }}</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * AdminFriends - 友链管理组件
 * 添加、编辑、删除友链
 */
import type { FriendLink } from '~/types'

const friends = ref<FriendLink[]>([])
const loading = ref(true)
const saving = ref(false)
const saveMsg = ref('')
const saveOk = ref(true)

/** 加载友链列表 */
async function loadFriends() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: FriendLink[] }>('/api/admin/friends/list')
    if (res.success && res.data) {
      friends.value = res.data
    }
  } catch (e: any) {
    console.error('加载友链失败：', e)
  }
  loading.value = false
}

/** 添加新友链 */
function addFriend() {
  friends.value.push({
    name: '',
    avatar: '/images/头像.png',
    description: '',
    url: 'https://'
  })
}

/** 删除友链 */
function removeFriend(index: number) {
  friends.value.splice(index, 1)
}

/** 保存友链 */
async function handleSave() {
  saving.value = true
  saveMsg.value = ''
  saveOk.value = true

  try {
    const res = await $fetch<{ success: boolean; message: string }>('/api/admin/friends/save', {
      method: 'POST',
      body: { friends: friends.value }
    })
    saveMsg.value = res.message || '保存成功'
    saveOk.value = true
  } catch (e: any) {
    saveMsg.value = e?.data?.message || '保存失败'
    saveOk.value = false
  }

  saving.value = false
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
  margin-bottom: 16px;
}
.section-actions h3 { margin: 0; font-size: 1.1rem; }

.friends-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.friend-edit-card {
  padding: 16px;
}

.friend-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.friend-index {
  font-weight: 600;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.form-group { margin-bottom: 10px; }
.form-group label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.form-row { display: flex; gap: 10px; }
.form-group-flex { flex: 1; }

.form-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 0.88rem;
  font-family: var(--font-sans);
  outline: none;
  transition: border-color var(--transition-fast);
}
.form-input:focus { border-color: var(--color-accent); }

.btn-delete-text {
  background: none;
  border: none;
  color: #DC2626;
  cursor: pointer;
  font-size: 0.8rem;
  font-family: var(--font-sans);
}
.btn-delete-text:hover { text-decoration: underline; }

.save-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 0;
}

.save-msg { font-size: 0.85rem; margin: 0; }
.save-ok { color: #065F46; }
.save-err { color: #DC2626; }

.btn-sm { padding: 4px 14px; font-size: 0.8rem; }
.loading-text { text-align: center; padding: 40px; color: var(--color-text-muted); }
.empty-state { text-align: center; padding: 40px; color: var(--color-text-muted); }

@media (max-width: 640px) {
  .form-row { flex-direction: column; }
}
</style>
