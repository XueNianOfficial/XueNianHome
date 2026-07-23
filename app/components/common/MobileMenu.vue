<!--
============================================================
  雪年个人网站 - 移动端菜单
  汉堡菜单打开时自导航栏下滑出，带全屏遮罩；
  菜单项依次淡入，点击链接 / 遮罩 / Esc 键均可关闭
============================================================
-->
<template>
  <!-- 整体淡入淡出；面板另有下滑位移动画（见样式区过渡定义） -->
  <Transition name="mobile-menu">
    <!-- 遮罩层：覆盖导航栏以下的视口区域，点击空白处关闭 -->
    <div
      v-if="isOpen"
      class="mobile-menu-mask"
      @click.self="emit('close')"
    >
      <nav class="mobile-menu-panel" aria-label="移动端导航">
        <NuxtLink
          v-for="(item, index) in navItems"
          :key="item.path"
          :to="item.path"
          class="mobile-nav-link"
          :class="{ 'mobile-nav-link--active': isActive(item.path) }"
          :style="{ '--i': index }"
          @click="emit('close')"
        >
          <span class="mobile-nav-icon" aria-hidden="true">{{ item.icon }}</span>
          {{ item.label }}
        </NuxtLink>
      </nav>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  MobileMenu - 移动端下拉菜单组件
 *  - 通过 isOpen prop 控制显示/隐藏，close 事件通知父组件关闭
 *  - 打开期间锁定 body 滚动，Esc 键可关闭
 *  - 菜单项通过 --i 自定义属性实现依次淡入的阶梯动画
 *  注意：本组件渲染在 AppHeader 内部（header 为 fixed 定位），
 *  因此遮罩使用 absolute 定位即可相对视口顶部对齐
 * ============================================================
 */
import { watch, onBeforeUnmount } from 'vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

/** 导航项配置：与 AppHeader 桌面导航保持一致 */
const navItems = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/blog', label: '博客', icon: '📝' },
  { path: '/gallery', label: '画廊', icon: '🖼️' },
  { path: '/friends', label: '友链', icon: '🔗' },
  { path: '/chat', label: '聊天', icon: '💬' }
]

/** 当前路由（用于激活态高亮） */
const route = useRoute()

/** 判断导航项是否为当前路由（首页精确匹配，其余前缀匹配） */
function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

/** Esc 键关闭菜单 */
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

/**
 * 监听开关状态：
 * - 打开时锁定 body 滚动并注册 Esc 监听
 * - 关闭时还原，避免残留副作用
 */
watch(() => props.isOpen, (open) => {
  if (open) {
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeydown)
  } else {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', handleKeydown)
  }
})

// 组件卸载兜底：防止菜单打开状态下组件被销毁导致 body 无法滚动
onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* ---------- 遮罩层：覆盖导航栏以下的整个视口 ----------
   父级 header 为 fixed 定位，故 absolute 相对其定位即对齐视口顶部 */
.mobile-menu-mask {
  position: absolute;
  top: var(--header-height);
  left: 0;
  right: 0;
  height: calc(100vh - var(--header-height));
  height: calc(100dvh - var(--header-height));
  background: var(--color-bg-mask);
}

/* ---------- 菜单面板：自顶部滑出 ---------- */
.mobile-menu-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

/* ---------- 菜单项：打开时依次淡入（--i 为序号，延迟递增） ---------- */
.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-primary);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
  animation: mobile-item-in var(--transition-normal) both;
  animation-delay: calc(var(--i, 0) * 45ms);
}

.mobile-nav-icon {
  font-size: var(--text-lg);
}

.mobile-nav-link:hover {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

/* 当前路由高亮 */
.mobile-nav-link--active {
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 600;
}

/* ---------- 进出过渡：遮罩淡入淡出 + 面板下滑/回收 ---------- */
.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: opacity var(--transition-normal);
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
}

.mobile-menu-enter-active .mobile-menu-panel {
  transition: transform var(--transition-normal);
}

.mobile-menu-leave-active .mobile-menu-panel {
  transition: transform var(--transition-fast);
}

.mobile-menu-enter-from .mobile-menu-panel,
.mobile-menu-leave-to .mobile-menu-panel {
  transform: translateY(-12px);
}

/* ---------- 菜单项入场关键帧 ---------- */
@keyframes mobile-item-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ---------- 兜底：窗口拉宽到桌面断点以上时强制隐藏，避免遮罩残留 ---------- */
@media (min-width: 768px) {
  .mobile-menu-mask {
    display: none;
  }
}
</style>
