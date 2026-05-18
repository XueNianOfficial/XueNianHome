<!--
============================================================
  雪年个人网站 - 首页
  包含英雄区域（立绘 + 介绍）、特色导航卡片、简介文字
============================================================
-->
<template>
  <div class="page-home">
    <!-- 英雄区域：立绘展示 + 名字 + 副标题 -->
    <HomeHeroSection />

    <!-- 简介文字区域 -->
    <section class="about-section">
      <div class="container-page">
        <div class="about-content">
          <h2 class="section-title">你好，这里是雪年</h2>
          <p class="section-subtitle">一只热爱艺术与代码的小狼w</p>
          <div class="about-text">
            <p>
              欢迎来到我的个人空间！这里是我的数字小窝，一个分享创作、记录生活的地方。
            </p>
            <p>
              在这个网站上，你可以浏览我的<NuxtLink to="/blog">博客文章</NuxtLink>，
              欣赏我的<NuxtLink to="/gallery">画作</NuxtLink>，
              和我<NuxtLink to="/friends">交换友链</NuxtLink>，
              或者和我<NuxtLink to="/chat">聊聊天</NuxtLink>。
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- 特色导航卡片 -->
    <section class="features-section">
      <div class="container-page">
        <h2 class="section-title">✨ 探索更多</h2>
        <p class="section-subtitle">点击下方卡片，发现精彩内容</p>
        <HomeFeatureCards />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * 首页组件
 * 组合 HeroSection（英雄区）、简介文字、FeatureCards（导航卡片）
 */
useHead({
  title: '首页'
})
</script>

<style scoped>
.page-home {
  /* 页面整体无额外样式，由子组件负责 */
}

/* ---------- 简介区域 ---------- */
.about-section {
  padding: 60px 0 20px;
}

.about-content {
  max-width: 720px;
  margin: 0 auto;
  text-align: center;
}

.about-text {
  text-align: left;
  line-height: 1.9;
}

.about-text p {
  margin-bottom: 1rem;
  color: var(--color-text-secondary);
  font-size: 1.05rem;
}

.about-text a {
  font-weight: 500;
}

/* ---------- 特色卡片区域 ---------- */
.features-section {
  padding: 40px 0 80px;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .about-section {
    padding: 40px 0 0;
  }

  .about-text {
    text-align: left;
  }

  .about-text p {
    font-size: 0.98rem;
  }
}
</style>
