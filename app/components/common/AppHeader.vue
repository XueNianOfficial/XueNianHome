<!--
============================================================
  雪年个人网站 - 顶部导航栏
  吸顶固定：页面滚动时切换为毛玻璃背景（backdrop-filter）
  + 细边框 + 浅阴影；包含 Logo、桌面端导航链接
  （当前路由下划线高亮）、主题切换按钮与移动端汉堡菜单
============================================================
-->
<template>
  <header class="app-header" :class="{ 'is-scrolled': isScrolled }">
    <div class="header-inner">
      <!-- Logo 区域：点击返回首页 -->
      <NuxtLink to="/" class="header-logo" aria-label="返回首页">
        <img
          src="/images/头像.png"
          alt="雪年的头像"
          class="logo-img"
          width="36"
          height="36"
          loading="eager"
        />
        <span class="logo-text">雪年</span>
      </NuxtLink>

      <!-- 桌面端导航链接（≤768px 时隐藏，改用下方汉堡菜单） -->
      <nav class="header-nav" aria-label="主导航">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ 'nav-link--active': isActive(item.path) }"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- 右侧操作区：主题切换 + 移动端汉堡按钮 -->
      <div class="header-actions">
        <!-- 亮/暗主题切换 -->
        <CommonThemeToggle />

        <!-- 移动端汉堡菜单按钮（三线 ↔ 叉 动画） -->
        <button
          class="mobile-menu-btn"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
          :aria-label="isMobileMenuOpen ? '关闭菜单' : '打开菜单'"
          :aria-expanded="isMobileMenuOpen"
        >
          <span class="hamburger-line" :class="{ 'is-open': isMobileMenuOpen }"></span>
          <span class="hamburger-line" :class="{ 'is-open': isMobileMenuOpen }"></span>
          <span class="hamburger-line" :class="{ 'is-open': isMobileMenuOpen }"></span>
        </button>
      </div>
    </div>

    <!-- 移动端下拉菜单（含遮罩，点击链接或遮罩后关闭） -->
    <CommonMobileMenu :is-open="isMobileMenuOpen" @close="isMobileMenuOpen = false" />
  </header>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  AppHeader - 顶部导航栏组件
 *  - 固定吸顶，滚动超过阈值后切换为毛玻璃 + 细边框样式
 *  - 通过 useRoute() 判断当前路由，高亮对应导航链接
 *    （/ 精确匹配，其余按前缀匹配，使 /blog/xxx 也点亮「博客」）
 *  - 桌面端显示导航链接，移动端显示汉堡菜单
 * ============================================================
 */
import { ref, onMounted, onUnmounted } from 'vue'

/** 导航项配置：移动端菜单（MobileMenu）中保留一份相同结构的列表 */
const navItems = [
  { path: '/', label: '首页' },
  { path: '/blog', label: '博客' },
  { path: '/gallery', label: '画廊' },
  { path: '/friends', label: '友链' },
  { path: '/chat', label: '聊天' }
]

/** 当前路由（用于激活态高亮） */
const route = useRoute()

/** 移动端菜单开关状态 */
const isMobileMenuOpen = ref(false)

/** 页面是否已滚动（用于切换毛玻璃背景） */
const isScrolled = ref(false)

/**
 * 判断导航项是否为当前路由
 * 首页需精确匹配，避免在任何页面下「首页」都保持高亮；
 * 其余栏目按前缀匹配，使子路由（如 /blog/某篇文章）也归属对应栏目
 */
function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

/** 监听滚动：超过 10px 即视为已滚动（rAF 节流，滚动事件高频触发） */
let scrollRafId = 0
function handleScroll() {
  if (scrollRafId) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = 0
    isScrolled.value = window.scrollY > 10
  })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  // 初始化一次状态，处理刷新时页面已处于滚动位置的情况
  isScrolled.value = window.scrollY > 10
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (scrollRafId) cancelAnimationFrame(scrollRafId)
})
</script>

<style scoped>
/* ---------- 导航栏容器：吸顶固定 ---------- */
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-header);
  /* 未滚动时保持透明，让页面顶色自然透出 */
  background: transparent;
  border-bottom: 1px solid transparent;
  transition:
    background-color var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal),
    backdrop-filter var(--transition-normal);
}

/* 滚动后：毛玻璃背景 + 细边框 + 浅阴影
   背景色由主题令牌经 color-mix 透出，亮/暗主题自动适配 */
.app-header.is-scrolled {
  background: color-mix(in srgb, var(--color-bg-primary) 85%, transparent);
  backdrop-filter: blur(12px) saturate(1.6);
  -webkit-backdrop-filter: blur(12px) saturate(1.6);
  border-bottom-color: var(--color-border);
  box-shadow: var(--shadow-sm);
}

/* ---------- 导航栏内部布局 ---------- */
.header-inner {
  max-width: var(--container-max);
  margin: 0 auto;
  padding: 0 var(--space-6);
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
}

/* ---------- Logo ---------- */
.header-logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  flex-shrink: 0;
}

.logo-img {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  object-fit: cover;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-spring);
}

/* 悬停时头像轻微放大，增加「活泼」感 */
.header-logo:hover .logo-img {
  transform: scale(1.08);
}

.logo-text {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text-primary);
  transition: color var(--transition-fast);
}

.header-logo:hover .logo-text {
  color: var(--color-accent);
}

/* ---------- 桌面端导航链接 ---------- */
.header-nav {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);
}

/* 下划线指示条：默认收起，激活态展开 */
.nav-link::after {
  content: '';
  position: absolute;
  left: var(--space-3);
  right: var(--space-3);
  bottom: 2px;
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  transform: scaleX(0);
  transition: transform var(--transition-normal);
}

.nav-link:hover {
  color: var(--color-accent);
  background: var(--color-bg-hover);
}

/* 当前路由高亮：强调色文字 + 下划线展开 */
.nav-link--active {
  color: var(--color-accent);
  font-weight: 600;
}

.nav-link--active::after {
  transform: scaleX(1);
}

/* ---------- 右侧操作区 ---------- */
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* ---------- 汉堡菜单按钮（默认隐藏，移动端显示） ---------- */
.mobile-menu-btn {
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: var(--space-2);
  background: none;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.mobile-menu-btn:hover {
  background: var(--color-bg-hover);
}

.hamburger-line {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--color-text-primary);
  border-radius: var(--radius-full);
  transition:
    transform var(--transition-fast),
    opacity var(--transition-fast);
}

/* 菜单打开时三线变形为叉 */
.hamburger-line.is-open:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.hamburger-line.is-open:nth-child(2) {
  opacity: 0;
}

.hamburger-line.is-open:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

/* ---------- 响应式：≤768px 隐藏桌面导航，显示汉堡按钮 ---------- */
@media (max-width: 768px) {
  .header-nav {
    display: none;
  }

  .mobile-menu-btn {
    display: flex;
  }
}
</style>
