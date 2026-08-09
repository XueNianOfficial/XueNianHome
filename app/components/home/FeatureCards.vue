<!--
============================================================
  雪年个人网站 - 特色导航卡片
  首页的四个功能入口：博客、画廊、AI 聊天、友链
  入场时依次上浮淡入，悬停时卡片上浮、图标轻晃
============================================================
-->
<template>
  <div class="feature-cards">
    <div class="cards-grid">
      <!-- 博客卡片 -->
      <NuxtLink to="/blog" class="feature-card card" :ref="tilt.bind">
        <div class="card-icon">📝</div>
        <h3 class="card-title">博客</h3>
        <p class="card-desc">记录创作心得、技术分享和生活随笔</p>
        <span class="card-link">
          查看全部 <span class="card-arrow">→</span>
        </span>
      </NuxtLink>

      <!-- 画廊卡片 -->
      <NuxtLink to="/gallery" class="feature-card card" :ref="tilt.bind">
        <div class="card-icon">🖼️</div>
        <h3 class="card-title">画廊</h3>
        <p class="card-desc">毛茸茸的角色设计、插画和创意作品</p>
        <span class="card-link">
          欣赏画作 <span class="card-arrow">→</span>
        </span>
      </NuxtLink>

      <!-- AI 聊天卡片 -->
      <NuxtLink to="/chat" class="feature-card card" :ref="tilt.bind">
        <div class="card-icon">💬</div>
        <h3 class="card-title">聊天</h3>
        <p class="card-desc">和雪年聊聊天吧~</p>
        <span class="card-link">
          开始对话 <span class="card-arrow">→</span>
        </span>
      </NuxtLink>

      <!-- 友链卡片 -->
      <NuxtLink to="/friends" class="feature-card card" :ref="tilt.bind">
        <div class="card-icon">🔗</div>
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
 * ============================================================
 *  FeatureCards - 特色导航卡片组件
 *  - 卡片本体复用全局 .card 工具类（背景/边框/阴影）
 *  - 入场动画用 fade-in-up + animation-delay 阶梯依次出现；
 *    填充模式取 backwards（仅延迟期间套用 from 状态），
 *    结束后归还样式控制权，避免覆盖悬停时的 transform
 *  - 悬停动效统一走 --transition-spring 弹性曲线
 *  - 悬停 3D 倾斜 + 跟随指针的径向眩光（useTilt 写入 --glare-x/y，
 *    ::after 伪元素渲染；非精确指针设备回退为纯 CSS 上浮）
 * ============================================================
 */

/** 卡片 3D 倾斜（仅精确指针 + 未减弱动效时生效） */
const tilt = useTilt({ maxTilt: 7, lift: 6, scale: 1.02 })
</script>

<style scoped>
/* ---------- 卡片网格 ---------- */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-6);
  max-width: 1080px;
  margin: 0 auto;
}

/* ---------- 单个卡片（在全局 .card 基础上叠加布局与动效） ---------- */
.feature-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: var(--space-8) var(--space-6);
  text-decoration: none;
  cursor: pointer;
  /* 裁进圆角，配合眩光 ::after */
  overflow: hidden;
  animation: fade-in-up 0.55s ease backwards;
  transition:
    transform var(--transition-spring),
    box-shadow var(--transition-normal);
}

/* 入场延迟阶梯：每张卡片比上一张晚 90ms 出现 */
.feature-card:nth-child(1) { animation-delay: 0.05s; }
.feature-card:nth-child(2) { animation-delay: 0.14s; }
.feature-card:nth-child(3) { animation-delay: 0.23s; }
.feature-card:nth-child(4) { animation-delay: 0.32s; }

/* 悬停：明显上浮 + 品牌蓝发光阴影（边框染色由 .card 工具类负责；
   3D 倾斜启用时由内联 transform 接管，此处作无鼠标设备回退） */
.feature-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-accent);
}

/* 眩光层：跟随 --glare-x/--glare-y 的径向高光（useTilt 逐帧写入变量） */
.feature-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    300px circle at var(--glare-x, 50%) var(--glare-y, 50%),
    color-mix(in srgb, var(--color-accent-light) 20%, transparent) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity var(--transition-normal);
  pointer-events: none;
}

.feature-card:hover::after {
  opacity: 1;
}

/* ---------- 卡片图标：accent 浅底圆角块 + emoji 居中 ---------- */
.card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  font-size: var(--text-2xl);
  background: var(--color-accent-bg);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  transition: transform var(--transition-spring);
}

/* 悬停时图标放大并轻轻歪头，增加一点俏皮感 */
.feature-card:hover .card-icon {
  transform: scale(1.1) rotate(-4deg);
}

/* ---------- 卡片标题 ---------- */
.card-title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2);
}

/* ---------- 卡片描述（flex:1 撑开，使底部链接对齐） ---------- */
.card-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin: 0 0 var(--space-6);
  flex: 1;
}

/* ---------- 卡片底部链接 ---------- */
.card-link {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-accent);
}

.card-arrow {
  transition: transform var(--transition-fast);
}

/* 悬停时箭头右移，引导点击 */
.feature-card:hover .card-arrow {
  transform: translateX(4px);
}

/* ---------- 响应式：窄屏强制单列 ---------- */
@media (max-width: 640px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
