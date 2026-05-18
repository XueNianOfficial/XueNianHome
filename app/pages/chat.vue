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
  margin-bottom: 32px;
}

/* ---------- 聊天窗口容器 ---------- */
.chat-wrapper {
  max-width: 720px;
  margin: 0 auto;
  height: calc(100vh - 280px);
  min-height: 500px;
}
</style>
