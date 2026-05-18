<!--
============================================================
  雪年个人网站 - 首页英雄区域
  展示立绘、名字、副标题，白色背景 + 蓝色渐变装饰
============================================================
-->
<template>
  <section class="hero-section">
    <!-- 背景装饰：蓝色渐变圆 -->
    <div class="hero-bg-decor">
      <div class="decor-circle decor-circle--1"></div>
      <div class="decor-circle decor-circle--2"></div>
      <div class="decor-circle decor-circle--3"></div>
    </div>

    <div class="container-page hero-content">
      <!-- 左侧：立绘图片 -->
      <div class="hero-image">
        <div class="hero-image-wrapper">
          <img
            src="/images/立绘.png"
            alt="雪年立绘"
            class="hero-portrait"
            width="400"
            height="500"
            loading="eager"
            fetchpriority="high"
          />
        </div>
      </div>

      <!-- 右侧：文字介绍 -->
      <div class="hero-text">
        <h1 class="hero-name">
          <span class="name-chinese">雪年</span>
          <span class="name-english">XueNian</span>
        </h1>
        <p class="hero-tagline">一只小狼w</p>
        <p class="hero-description">
          用色彩描绘毛茸茸的世界，用代码编织有趣的梦境。
          这里是我的数字小窝，欢迎你的到来！
        </p>
        <div class="hero-actions">
          <NuxtLink to="/blog" class="btn-primary">
            📝 阅读博客
          </NuxtLink>
          <NuxtLink to="/gallery" class="btn-outline">
            🖼️ 欣赏画作
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- 向下滚动提示 -->
    <div class="scroll-hint">
      <span class="scroll-arrow">⌄</span>
      <span class="scroll-text">向下滚动</span>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * HeroSection - 首页英雄区域组件
 * 展示雪年立绘和核心介绍信息
 */
</script>

<style scoped>
/* ---------- 英雄区域容器 ---------- */
.hero-section {
  position: relative;
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  overflow: hidden;
  background: linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-tertiary) 100%);
}

/* ---------- 背景装饰圆 ---------- */
.hero-bg-decor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.decor-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.15;
  filter: blur(60px);
}

.decor-circle--1 {
  width: 400px;
  height: 400px;
  background: var(--color-accent);
  top: -100px;
  right: -50px;
}

.decor-circle--2 {
  width: 300px;
  height: 300px;
  background: var(--color-accent-light);
  bottom: 10%;
  left: -80px;
}

.decor-circle--3 {
  width: 200px;
  height: 200px;
  background: var(--color-accent);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* ---------- 内容布局 ---------- */
.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 60px;
  padding-top: 40px;
  padding-bottom: 80px;
}

/* ---------- 立绘图片 ---------- */
.hero-image {
  flex-shrink: 0;
}

.hero-image-wrapper {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  background: var(--color-bg-secondary);
  padding: 8px;
}

.hero-portrait {
  display: block;
  max-width: 350px;
  height: auto;
  border-radius: 18px;
}

/* ---------- 文字区域 ---------- */
.hero-text {
  max-width: 480px;
}

.hero-greeting {
  font-size: 1.3rem;
  color: var(--color-accent);
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.hero-name {
  margin: 0 0 8px;
}

.name-chinese {
  display: block;
  font-size: 3.2rem;
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.name-english {
  display: block;
  font-size: 1.3rem;
  font-weight: 400;
  color: var(--color-text-muted);
  letter-spacing: 2px;
}

.hero-tagline {
  font-size: 1.1rem;
  color: var(--color-accent);
  font-weight: 500;
  margin-bottom: 1rem;
}

.hero-description {
  font-size: 1.05rem;
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin-bottom: 2rem;
}

/* ---------- 操作按钮 ---------- */
.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* ---------- 滚动提示 ---------- */
.scroll-hint {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--color-text-muted);
  animation: bounce 2s ease-in-out infinite;
}

.scroll-arrow {
  font-size: 1.5rem;
}

.scroll-text {
  font-size: 0.8rem;
}

@keyframes bounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(8px); }
}

/* ---------- 响应式 ---------- */
@media (max-width: 860px) {
  .hero-content {
    flex-direction: column;
    text-align: center;
    gap: 40px;
    padding-top: 60px;
    padding-bottom: 100px;
  }

  .hero-portrait {
    max-width: 260px;
  }

  .hero-text {
    max-width: 100%;
  }

  .name-chinese {
    font-size: 2.5rem;
  }

  .hero-actions {
    justify-content: center;
  }
}
</style>
