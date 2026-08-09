<!--
============================================================
  雪年个人网站 - 默认布局
  所有页面的外层框架：导航栏 + 内容区 + 页脚 + 全局 Toast
============================================================
-->
<template>
  <div class="layout-default">
    <!-- 顶部滚动进度条（fixed 3px 渐变条，z-index 高于吸顶导航） -->
    <CommonScrollProgress />

    <!-- 顶部导航栏（吸顶固定） -->
    <CommonAppHeader />

    <!-- 页面主体内容 -->
    <main class="layout-main">
      <slot />
    </main>

    <!-- 页脚 -->
    <CommonAppFooter />

    <!-- 全局 Toast 轻提示（配合 useToast() 使用） -->
    <CommonAppToast />
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  默认布局组件
 *  使用 Nuxt 的 <slot /> 渲染子页面内容
 *  此处无需额外逻辑，子组件处理各自功能
 * ============================================================
 */
</script>

<style scoped>
.layout-default {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  /* 移动端动态视口高度，避免浏览器工具栏遮挡 */
  min-height: 100dvh;
}

.layout-main {
  flex: 1;
  /* 顶部留出吸顶导航栏的高度（与 --header-height 保持一致） */
  padding-top: var(--header-height);
}
</style>
