<!--
============================================================
  雪年个人网站 - 主题切换按钮
  切换亮色/暗色主题，含月亮和太阳图标动画
============================================================
-->
<template>
  <button
    class="theme-toggle"
    @click="toggleTheme"
    :aria-label="isDark ? '切换到亮色模式' : '切换到暗色模式'"
    :title="isDark ? '切换到亮色模式' : '切换到暗色模式'"
  >
    <!-- 太阳图标（亮色模式显示） -->
    <svg
      v-show="!isDark"
      class="theme-icon sun-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      width="20"
      height="20"
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

    <!-- 月亮图标（暗色模式显示） -->
    <svg
      v-show="isDark"
      class="theme-icon moon-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      width="20"
      height="20"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </button>
</template>

<script setup lang="ts">
/**
 * ThemeToggle - 主题切换按钮组件
 * 使用 useTheme composable 进行主题管理
 */
import { useTheme } from '~/composables/useTheme'

const { isDark, toggleTheme } = useTheme()
</script>

<style scoped>
/* ---------- 切换按钮 ---------- */
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: color var(--transition-fast),
              background var(--transition-fast),
              border-color var(--transition-fast);
}

.theme-toggle:hover {
  color: var(--color-accent);
  background: var(--color-accent-bg);
  border-color: var(--color-accent-light);
}

/* 图标动画 */
.theme-icon {
  transition: transform var(--transition-normal),
              opacity var(--transition-normal);
}

/* 太阳旋转动画 */
.sun-icon {
  animation: spin 20s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 月亮轻微浮动 */
.moon-icon {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
</style>
