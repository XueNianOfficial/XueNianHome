<!--
============================================================
  雪年个人网站 - 友链页面
  友链卡片网格：头像 + 名称 + 描述 + 链接箭头，整卡可点击
  数据优先走 /api/friends，失败时回退到 app/data/friends.ts
============================================================
-->
<template>
  <div class="page-friends">
    <div class="container-page">
      <!-- 页面标题 -->
      <header class="page-header">
        <h1 class="section-title">🔗 友链</h1>
        <p class="section-subtitle">好朋友们的站点，欢迎交换友链</p>
        <span class="badge friends-count">共有 {{ friendLinks.length }} 位好友</span>
      </header>

      <!-- 加载状态：卡片形骨架屏 -->
      <div v-if="loading" class="friends-grid" aria-label="友链加载中">
        <div v-for="i in 6" :key="i" class="friend-skeleton card">
          <div class="skeleton skeleton-avatar"></div>
          <div class="skeleton-lines">
            <div class="skeleton skeleton-line skeleton-line--name"></div>
            <div class="skeleton skeleton-line skeleton-line--desc"></div>
          </div>
        </div>
      </div>

      <!-- 友链网格 -->
      <div v-else-if="friendLinks.length > 0" class="friends-grid">
        <a
          v-for="(friend, index) in friendLinks"
          :key="friend.url"
          :href="friend.url"
          target="_blank"
          rel="noopener noreferrer"
          class="friend-card card"
          :style="{ animationDelay: `${Math.min(index, 11) * 45}ms` }"
        >
          <!-- 头像：加载失败时回退为首字符占位圆 -->
          <div class="friend-avatar">
            <img
              v-if="!failedAvatars.includes(friend.url)"
              :src="friend.avatar"
              :alt="friend.name"
              class="avatar-img"
              loading="lazy"
              width="64"
              height="64"
              @error="handleAvatarError(friend)"
            />
            <span v-else class="avatar-fallback" aria-hidden="true">
              {{ friend.name.charAt(0) }}
            </span>
          </div>
          <div class="friend-info">
            <h3 class="friend-name">{{ friend.name }}</h3>
            <p class="friend-desc">{{ friend.description }}</p>
          </div>
          <span class="friend-arrow" aria-hidden="true">→</span>
        </a>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <p class="empty-state-icon">🔗</p>
        <p>暂未添加友链</p>
        <p class="empty-hint">编辑 <code>app/data/friends.ts</code> 文件来添加好友</p>
      </div>

      <!-- 交换友链说明 -->
      <section class="exchange-section card">
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
      </section>
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

/** 友链数据（先展示静态兜底数据，API 成功后替换） */
const friendLinks = ref<FriendLink[]>(staticFriendLinks)

/** 是否正在请求 API（用于骨架屏展示） */
const loading = ref(true)

/** 头像加载失败的友链（以 url 为唯一标识），失败时改用首字符占位圆 */
const failedAvatars = ref<string[]>([])

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
 * 头像加载失败时记录该友链
 * 模板据此将 <img> 替换为首字符占位圆
 */
function handleAvatarError(friend: FriendLink) {
  if (!failedAvatars.value.includes(friend.url)) {
    failedAvatars.value = [...failedAvatars.value, friend.url]
  }
}
</script>

<style scoped>
/* ---------- 页面标题 ---------- */
.page-header {
  text-align: center;
  margin-bottom: var(--space-12);
}

.friends-count {
  margin-top: var(--space-3);
}

/* ---------- 友链网格 ---------- */
.friends-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-6);
  margin-bottom: var(--space-16);
}

/* ---------- 骨架屏卡片 ---------- */
.friend-skeleton {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
}

.skeleton-avatar {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
}

.skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.skeleton-line {
  height: 14px;
}

.skeleton-line--name {
  width: 45%;
}

.skeleton-line--desc {
  width: 85%;
}

/* ---------- 友链卡片 ---------- */
.friend-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  text-decoration: none;
  cursor: pointer;
  animation: fade-in-up var(--transition-slow) both;
}

/* 悬停上浮 + 品牌蓝发光阴影 */
.friend-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-accent);
}

.friend-avatar {
  flex-shrink: 0;
}

.avatar-img,
.avatar-fallback {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
}

.avatar-img {
  display: block;
  object-fit: cover;
  border: 2px solid var(--color-border);
  transition: border-color var(--transition-fast);
}

.friend-card:hover .avatar-img {
  border-color: var(--color-accent);
}

/* 首字符占位圆：品牌蓝渐变底 + 反白字符 */
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-gradient);
  color: var(--color-text-inverse);
  font-size: var(--text-xl);
  font-weight: 700;
  user-select: none;
}

.friend-info {
  flex: 1;
  min-width: 0;
}

.friend-name {
  margin: 0 0 var(--space-1);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}

.friend-desc {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 链接箭头：悬停时滑入 */
.friend-arrow {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  font-size: var(--text-base);
  color: var(--color-accent);
  background: var(--color-accent-bg);
  border-radius: var(--radius-full);
  opacity: 0;
  transform: translateX(-4px);
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.friend-card:hover .friend-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* ---------- 交换友链区域 ---------- */
.exchange-section {
  max-width: 600px;
  margin: 0 auto;
  padding: var(--space-8);
  text-align: center;
}

.exchange-title {
  margin: 0 0 var(--space-3);
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
}

.exchange-desc {
  margin: 0 0 var(--space-6);
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.exchange-info {
  padding: var(--space-4);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  text-align: left;
}

.info-item {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  font-weight: 600;
  color: var(--color-text-primary);
}

/* ---------- 空状态补充 ---------- */
.empty-hint {
  font-size: var(--text-sm);
}

.empty-hint code {
  padding: 2px 6px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.9em;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .friends-grid {
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  .friend-card,
  .friend-skeleton {
    padding: var(--space-4);
  }

  .exchange-section {
    padding: var(--space-6) var(--space-4);
  }
}
</style>
