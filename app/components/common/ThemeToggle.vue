<!--
============================================================
  雪年个人网站 - 主题切换按钮
  切换亮色/暗色主题；太阳与月亮图标以「旋转 + 缩放」
  过渡动画交替出现
============================================================
-->
<template>
  <button
    class="theme-toggle"
    @click="toggleTheme"
    :aria-label="isDark ? '切换到亮色模式' : '切换到暗色模式'"
    :title="isDark ? '切换到亮色模式' : '切换到暗色模式'"
  >
    <!-- mode="out-in"：旧图标旋出后新图标再旋入，避免重叠 -->
    <Transition name="theme-icon-swap" mode="out-in">
      <!-- 月亮图标（暗色模式显示，点击切回亮色） -->
      <svg
        v-if="isDark"
        key="moon"
        class="theme-icon"
        viewBox="0 0 24 24"
        fill="currentColor"
        width="20"
        height="20"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>

      <!-- 太阳图标（亮色模式显示，点击切到暗色） -->
      <svg
        v-else
        key="sun"
        class="theme-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="20"
        height="20"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    </Transition>
  </button>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  ThemeToggle - 主题切换按钮组件
 *  使用 useTheme composable 进行主题管理（html.dark 类切换，
 *  localStorage 持久化，逻辑见 app/composables/useTheme.ts）
 * ============================================================
 */
import { useTheme } from '~/composables/useTheme'

const { isDark, toggleTheme } = useTheme()
</script>

<style scoped>
/* ---------- 切换按钮：圆形图标按钮 ---------- */
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
}

.theme-toggle:hover {
  color: var(--color-accent);
  background: var(--color-accent-bg);
  border-color: var(--color-accent-light);
}

.theme-toggle:active {
  transform: scale(0.92);
}

/* ---------- 图标交替动画：旋转 + 缩放 + 淡入淡出 ---------- */
.theme-icon-swap-enter-active,
.theme-icon-swap-leave-active {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal);
}

/* 新图标从 -90° 旋入并放大 */
.theme-icon-swap-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.4);
}

/* 旧图标向 90° 旋出并缩小 */
.theme-icon-swap-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.4);
}
</style>
