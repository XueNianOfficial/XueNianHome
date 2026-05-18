<!--
============================================================
  雪年个人网站 - 友链页面
  展示好友链接列表，响应式网格布局
  白色卡片 + 蓝色悬停效果
============================================================
-->
<template>
  <div class="page-friends">
    <div class="container-page">
      <!-- 页面标题 -->
      <header class="page-header">
        <h1 class="section-title">🔗 友链</h1>
        <p class="section-subtitle">好朋友们的站点，欢迎交换友链</p>
        <div class="friends-count">共有 {{ friendLinks.length }} 位好友</div>
      </header>

      <!-- 友链网格 -->
      <div v-if="friendLinks.length > 0" class="friends-grid">
        <a
          v-for="friend in friendLinks"
          :key="friend.url"
          :href="friend.url"
          target="_blank"
          rel="noopener noreferrer"
          class="friend-card card"
        >
          <div class="friend-avatar">
            <img
              :src="friend.avatar"
              :alt="friend.name"
              class="avatar-img"
              loading="lazy"
              width="64"
              height="64"
              @error="handleAvatarError"
            />
          </div>
          <div class="friend-info">
            <h3 class="friend-name">{{ friend.name }}</h3>
            <p class="friend-desc">{{ friend.description }}</p>
          </div>
          <span class="friend-arrow">→</span>
        </a>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <p class="empty-icon">🔗</p>
        <p>暂未添加友链</p>
        <p class="empty-hint">编辑 <code>data/friends.ts</code> 文件来添加好友</p>
      </div>

      <!-- 交换友链说明 -->
      <div class="exchange-section">
        <h2 class="exchange-title">🤝 交换友链</h2>
        <p class="exchange-desc">
          欢迎和我交换友链！请通过以下社交平台联系我，并附上你的站点信息：
          名称、描述、链接和头像。
        </p>
        <div class="exchange-info">
          <div class="info-item">
            <span class="info-label">站点名称：</span>
            <span>雪年 · XueNian</span>
          </div>
          <div class="info-item">
            <span class="info-label">站点描述：</span>
            <span>一只热爱艺术与代码的小狼w</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 友链页面
 * 优先从 API 获取数据，回退到 data/friends.ts 静态文件
 */
import { friendLinks as staticFriendLinks } from '~/data/friends'
import type { FriendLink } from '~/types'

useHead({
  title: '友链'
})

/** 友链数据 */
const friendLinks = ref<FriendLink[]>(staticFriendLinks)

/** 从 API 加载友链数据 */
async function loadFriends() {
  try {
    const res = await $fetch<{ success: boolean; data: FriendLink[] }>('/api/friends')
    if (res.success && res.data && res.data.length > 0) {
      friendLinks.value = res.data
    }
  } catch {
    // API 不可用时使用静态数据
  }
  loading.value = false
}

onMounted(() => {
  loadFriends()
})

/**
 * 头像加载失败时的回退处理
 * 使用默认占位符
 */
function handleAvatarError(e: Event) {
  const img = e.target as HTMLImageElement
  img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23e5e7eb" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239ca3af" font-size="40"></text></svg>'
}
</script>

<style scoped>
/* ---------- 页面标题 ---------- */
.page-header {
  text-align: center;
  margin-bottom: 48px;
}

.friends-count {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  margin-top: 8px;
}

/* ---------- 友链网格 ---------- */
.friends-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 60px;
}

/* ---------- 友链卡片 ---------- */
.friend-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  text-decoration: none;
  transition: transform var(--transition-normal),
              box-shadow var(--transition-normal);
}

.friend-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-accent);
}

.friend-avatar {
  flex-shrink: 0;
}

.avatar-img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--color-border);
  transition: border-color var(--transition-fast);
}

.friend-card:hover .avatar-img {
  border-color: var(--color-accent);
}

.friend-info {
  flex: 1;
  min-width: 0;
}

.friend-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 4px;
}

.friend-desc {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friend-arrow {
  font-size: 1.2rem;
  color: var(--color-accent);
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity var(--transition-fast),
              transform var(--transition-fast);
  flex-shrink: 0;
}

.friend-card:hover .friend-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* ---------- 交换友链区域 ---------- */
.exchange-section {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
}

.exchange-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 12px;
}

.exchange-desc {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin-bottom: 20px;
}

.exchange-info {
  text-align: left;
  padding: 16px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
}

.info-item {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.info-label {
  font-weight: 600;
  color: var(--color-text-primary);
}

/* ---------- 空状态 ---------- */
.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--color-text-muted);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-hint {
  font-size: 0.9rem;
  margin-top: 8px;
}

.empty-hint code {
  background: var(--color-bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .friends-grid {
    grid-template-columns: 1fr;
  }

  .exchange-section {
    padding: 24px 16px;
  }
}
</style>
