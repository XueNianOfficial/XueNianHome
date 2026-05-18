<!--
============================================================
  雪年个人网站 - 特色导航卡片
  首页的三个导航卡片：博客、画作、AI 聊天
============================================================
-->
<template>
  <div class="feature-cards">
    <div class="cards-grid">
      <!-- 博客卡片 -->
      <NuxtLink to="/blog" class="feature-card card">
        <div class="card-icon card-icon--blog">📝</div>
        <h3 class="card-title">博客</h3>
        <p class="card-desc">记录创作心得、技术分享和生活随笔</p>
        <span class="card-link">
          查看全部 <span class="card-arrow">→</span>
        </span>
      </NuxtLink>

      <!-- 画作卡片 -->
      <NuxtLink to="/gallery" class="feature-card card">
        <div class="card-icon card-icon--gallery">🖼️</div>
        <h3 class="card-title">画廊</h3>
        <p class="card-desc">毛茸茸的角色设计、插画和创意作品</p>
        <span class="card-link">
          欣赏画作 <span class="card-arrow">→</span>
        </span>
      </NuxtLink>

      <!-- AI 聊天卡片 -->
      <NuxtLink to="/chat" class="feature-card card">
        <div class="card-icon card-icon--chat">💬</div>
        <h3 class="card-title">聊天</h3>
        <p class="card-desc">和雪年聊聊天吧~</p>
        <span class="card-link">
          开始对话 <span class="card-arrow">→</span>
        </span>
      </NuxtLink>

      <!-- 友链卡片 -->
      <NuxtLink to="/friends" class="feature-card card">
        <div class="card-icon card-icon--friends">🔗</div>
        <h3 class="card-title">友链</h3>
        <p class="card-desc">好朋友们的站点，欢迎交换友链</p>
        <span class="card-link">
          看看朋友 <span class="card-arrow">→</span>
        </span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * FeatureCards - 特色导航卡片组件
 * 展示网站主要功能入口，带悬停动画效果
 */
</script>

<style scoped>
/* ---------- 卡片网格 ---------- */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

/* ---------- 单个卡片 ---------- */
.feature-card {
  display: flex;
  flex-direction: column;
  padding: 32px 28px;
  text-decoration: none;
  cursor: pointer;
  transition: transform var(--transition-normal),
              box-shadow var(--transition-normal);
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-accent);
}

/* ---------- 卡片图标 ---------- */
.card-icon {
  font-size: 2.5rem;
  margin-bottom: 16px;
  transition: transform var(--transition-normal);
}

.feature-card:hover .card-icon {
  transform: scale(1.1);
}

/* ---------- 卡片标题 ---------- */
.card-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

/* ---------- 卡片描述 ---------- */
.card-desc {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: 0 0 20px;
  flex: 1;
}

/* ---------- 卡片链接 ---------- */
.card-link {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-accent);
}

.card-arrow {
  transition: transform var(--transition-fast);
}

.feature-card:hover .card-arrow {
  transform: translateX(4px);
}
</style>
