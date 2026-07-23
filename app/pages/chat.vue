<!--
============================================================
  雪年个人网站 - AI 聊天页面
  与雪年的 AI 分身对话，讨论各类话题
============================================================
-->
<template>
  <div class="page-chat">
    <div class="container-page">
      <!-- 页面标题 -->
      <header class="page-header">
        <h1 class="section-title">聊天</h1>
        <p class="section-subtitle">和雪年聊聊天吧~</p>
      </header>

      <!-- 聊天窗口 -->
      <div class="chat-wrapper">
        <ChatWindow />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * AI 聊天页面
 * 组合 ChatWindow 组件，提供与服务端 API 的交互
 */
useHead({
  title: '聊天'
})
</script>

<style scoped>
/* ---------- 页面标题 ---------- */
.page-header {
  text-align: center;
  margin-bottom: var(--space-xl);
}

/* ---------- 聊天窗口容器 ---------- */
.chat-wrapper {
  max-width: 768px;
  margin: 0 auto;
  height: calc(100vh - 280px);
  min-height: 500px;
}

/* 移动端：标题区收窄，聊天窗口占满剩余可视高度 */
@media (max-width: 640px) {
  .page-header {
    margin-bottom: var(--space-md);
  }

  .chat-wrapper {
    /* 100dvh 适配移动端动态工具栏；减去导航栏、标题区与页面留白 */
    height: calc(100dvh - var(--header-height) - 190px);
    min-height: 380px;
  }
}
</style>
