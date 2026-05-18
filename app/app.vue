<template>
  <!--
    ============================================================
    雪年个人网站 - 根组件
    Nuxt 4 使用 app/ 目录下的 app.vue 作为根组件
    提供 NuxtLayout + NuxtPage 的基础框架
    ============================================================
  -->
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
/**
 * 根组件逻辑
 * - 全局 CSS 样式在 nuxt.config.ts 的 css 配置中引入
 * - 使用 useHead 设置全局 SEO 元数据
 */

useHead({
  titleTemplate: '%s · 雪年',
  htmlAttrs: { lang: 'zh-CN' },
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'description', content: '雪年 XueNian - 一只热爱艺术与代码的小狼w' },
    { name: 'theme-color', content: '#4A90D9' },
    { property: 'og:title', content: '雪年 · XueNian' },
    { property: 'og:description', content: '一只热爱艺术与代码的小狼w' },
    { property: 'og:type', content: 'website' }
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/images/logo.png' }
  ]
})
</script>
