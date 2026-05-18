<!--
============================================================
  雪年个人网站 - 移动端菜单
  汉堡菜单打开时下拉显示，包含所有导航链接
============================================================
-->
<template>
  <Transition name="mobile-menu">
    <nav
      v-if="isOpen"
      class="mobile-menu"
      aria-label="移动端导航"
      @click.self="$emit('close')"
    >
      <div class="mobile-menu-inner">
        <NuxtLink
          to="/"
          class="mobile-nav-link"
          active-class="mobile-nav-link--active"
          @click="$emit('close')"
        >
          <span>🏠</span> 首页
        </NuxtLink>
        <NuxtLink
          to="/blog"
          class="mobile-nav-link"
          active-class="mobile-nav-link--active"
          @click="$emit('close')"
        >
          <span>📝</span> 博客
        </NuxtLink>
        <NuxtLink
          to="/gallery"
          class="mobile-nav-link"
          active-class="mobile-nav-link--active"
          @click="$emit('close')"
        >
          <span>🖼️</span> 画作
        </NuxtLink>
        <NuxtLink
          to="/friends"
          class="mobile-nav-link"
          active-class="mobile-nav-link--active"
          @click="$emit('close')"
        >
          <span>🔗</span> 友链
        </NuxtLink>
        <NuxtLink
          to="/chat"
          class="mobile-nav-link"
          active-class="mobile-nav-link--active"
          @click="$emit('close')"
        >
          <span>💬</span> 聊天
        </NuxtLink>
      </div>
    </nav>
  </Transition>
</template>

<script setup lang="ts">
/**
 * MobileMenu - 移动端下拉菜单组件
 * 通过 isOpen prop 控制显示/隐藏
 * 点击链接后触发 close 事件关闭菜单
 */
defineProps<{
  isOpen: boolean
}>()

defineEmits<{
  close: []
}>()
</script>

<style scoped>
/* ---------- 菜单容器 ---------- */
.mobile-menu {
  position: absolute;
  top: 64px;  /* 导航栏高度 */
  left: 0;
  right: 0;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  padding: 12px 0;
  z-index: 999;
}

.mobile-menu-inner {
  display: flex;
  flex-direction: column;
  padding: 8px 16px;
}

/* ---------- 菜单链接 ---------- */
.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--color-text-primary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast),
              color var(--transition-fast);
}

.mobile-nav-link:hover {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.mobile-nav-link--active {
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 600;
}

/* ---------- 过渡动画 ---------- */
.mobile-menu-enter-active {
  transition: opacity var(--transition-fast),
              transform var(--transition-fast);
}

.mobile-menu-leave-active {
  transition: opacity 0.15s ease,
              transform 0.15s ease;
}

.mobile-menu-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
