<!--
============================================================
  雪年个人网站 - 默认布局
  所有页面的外层框架：导航栏 + 内容区 + 页脚
============================================================
-->
<template>
  <div class="layout-default">
    <!-- 顶部导航栏 -->
    <CommonAppHeader />

    <!-- 页面主体内容 -->
    <main class="layout-main">
      <slot />
    </main>

    <!-- 页脚 -->
    <CommonAppFooter />
  </div>
</template>

<script setup lang="ts">
/**
 * 默认布局组件
 * 使用 Nuxt 的 <slot /> 渲染子页面内容
 * 此处无需额外逻辑，子组件处理各自功能
 */
</script>

<style scoped>
.layout-default {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.layout-main {
  flex: 1;
  /* 顶部留出导航栏高度的空间 */
  padding-top: 64px;
}
</style>
