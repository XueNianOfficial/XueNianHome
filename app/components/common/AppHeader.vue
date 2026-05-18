<!--
============================================================
  雪年个人网站 - 顶部导航栏
  固定顶部，白色半透明背景，包含 Logo、导航链接、
  主题切换按钮、移动端汉堡菜单
============================================================
-->
<template>
  <header class="app-header" :class="{ 'is-scrolled': isScrolled }">
    <div class="header-inner">
      <!-- Logo 区域 -->
      <NuxtLink to="/" class="header-logo" aria-label="返回首页">
        <img
          src="/images/头像.png"
          alt="雪年 Logo"
          class="logo-img"
          width="36"
          height="36"
          loading="eager"
        />
        <span class="logo-text">雪年</span>
      </NuxtLink>

      <!-- 桌面端导航链接 -->
      <nav class="header-nav" aria-label="主导航">
        <NuxtLink to="/" class="nav-link" active-class="nav-link--active">
          <span class="nav-icon">🏠</span> 首页
        </NuxtLink>
        <NuxtLink to="/blog" class="nav-link" active-class="nav-link--active">
          <span class="nav-icon">📝</span> 博客
        </NuxtLink>
        <NuxtLink to="/gallery" class="nav-link" active-class="nav-link--active">
          <span class="nav-icon">🖼️</span> 画廊
        </NuxtLink>
        <NuxtLink to="/friends" class="nav-link" active-class="nav-link--active">
          <span class="nav-icon">🔗</span> 友链
        </NuxtLink>
        <NuxtLink to="/chat" class="nav-link" active-class="nav-link--active">
          <span class="nav-icon">💬</span> 聊天
        </NuxtLink>
      </nav>

      <!-- 右侧操作区 -->
      <div class="header-actions">
        <!-- 主题切换按钮 -->
        <CommonThemeToggle />

        <!-- 移动端汉堡菜单按钮 -->
        <button
          class="mobile-menu-btn"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
          :aria-label="isMobileMenuOpen ? '关闭菜单' : '打开菜单'"
          aria-expanded="isMobileMenuOpen"
        >
          <span class="hamburger-line" :class="{ 'is-open': isMobileMenuOpen }"></span>
          <span class="hamburger-line" :class="{ 'is-open': isMobileMenuOpen }"></span>
          <span class="hamburger-line" :class="{ 'is-open': isMobileMenuOpen }"></span>
        </button>
      </div>
    </div>

    <!-- 移动端下拉菜单 -->
    <CommonMobileMenu :is-open="isMobileMenuOpen" @close="isMobileMenuOpen = false" />
  </header>
</template>

<script setup lang="ts">
/**
 * AppHeader - 顶部导航栏组件
 * 功能：
 * - 固定顶部，滚动时添加阴影和背景模糊
 * - 桌面端显示导航链接，移动端显示汉堡菜单
 * - 集成主题切换按钮
 */
import { ref, onMounted, onUnmounted } from 'vue'

/** 移动端菜单开关状态 */
const isMobileMenuOpen = ref(false)

/** 页面是否已滚动（用于添加阴影效果） */
const isScrolled = ref(false)

/** 监听滚动事件 */
function handleScroll() {
  isScrolled.value = window.scrollY > 10
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
/* ---------- 导航栏容器 ---------- */
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid transparent;
  transition: background var(--transition-normal),
              border-color var(--transition-normal),
              box-shadow var(--transition-normal);
}

/* 滚动后的阴影效果 */
.app-header.is-scrolled {
  background: rgba(255, 255, 255, 0.95);
  border-bottom-color: var(--color-border);
  box-shadow: var(--shadow-sm);
}

/* ---------- 导航栏内部布局 ---------- */
.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

/* ---------- Logo ---------- */
.header-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex-shrink: 0;
}

.logo-img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  transition: color var(--transition-fast);
}

.header-logo:hover .logo-text {
  color: var(--color-accent);
}

/* ---------- 导航链接 ---------- */
.header-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast),
              background var(--transition-fast);
}

.nav-link:hover {
  color: var(--color-accent);
  background: var(--color-accent-bg);
}

/* 当前活跃路由高亮 */
.nav-link--active {
  color: var(--color-accent);
  background: var(--color-accent-bg);
}

.nav-icon {
  font-size: 1rem;
}

/* ---------- 右侧操作区 ---------- */
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ---------- 汉堡菜单按钮（移动端） ---------- */
.mobile-menu-btn {
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 8px;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.mobile-menu-btn:hover {
  background: var(--color-bg-tertiary);
}

.hamburger-line {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--color-text-primary);
  border-radius: 2px;
  transition: transform var(--transition-fast),
              opacity var(--transition-fast);
}

/* 汉堡菜单打开时的动画 */
.hamburger-line.is-open:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.hamburger-line.is-open:nth-child(2) {
  opacity: 0;
}

.hamburger-line.is-open:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

/* ---------- 响应式：移动端隐藏桌面导航，显示汉堡菜单 ---------- */
@media (max-width: 768px) {
  .header-nav {
    display: none;
  }

  .mobile-menu-btn {
    display: flex;
  }
}

/* ---------- 暗色主题适配 ---------- */
html.dark .app-header {
  background: rgba(15, 23, 42, 0.85);
}

html.dark .app-header.is-scrolled {
  background: rgba(15, 23, 42, 0.95);
}
</style>
