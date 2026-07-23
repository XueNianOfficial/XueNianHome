<!--
============================================================
  雪年个人网站 - 全局 Toast 轻提示渲染组件
  固定定位在页面右上角，渲染 useToast() 中的提示队列，
  支持自动消失与点击关闭。已在 layouts/default.vue 全局挂载。
============================================================
-->
<template>
  <!-- 提示列表容器：aria-live 供屏幕阅读器播报 -->
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast-item"
          :class="`toast-${toast.type}`"
          role="status"
          @click="removeToast(toast.id)"
        >
          <!-- 类型图标 -->
          <span class="toast-icon" aria-hidden="true">
            {{ iconMap[toast.type] }}
          </span>
          <!-- 提示文本 -->
          <span class="toast-message">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Toast 渲染组件
 * 逻辑全部在 useToast() 中，本组件只负责展示与关闭
 */

/** 各类型对应的图标（emoji，避免引入图标库） */
const iconMap: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ'
}

const { toasts, removeToast } = useToast()
</script>

<style scoped>
/* ---------- 容器：固定于视口右上角，层叠最高 ---------- */
.toast-container {
  position: fixed;
  top: calc(var(--header-height) + 12px);
  right: 16px;
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  pointer-events: none; /* 容器本身不挡点击，仅条目可点 */
}

/* ---------- 单条提示 ---------- */
.toast-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 220px;
  max-width: 360px;
  padding: 12px 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  pointer-events: auto;
}

/* 类型图标：圆形底色徽章 */
.toast-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
}

/* 成功：绿 */
.toast-success .toast-icon {
  background: var(--color-success-bg);
  color: var(--color-success);
}

/* 错误：红 */
.toast-error .toast-icon {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

/* 信息：蓝 */
.toast-info .toast-icon {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.toast-message {
  line-height: 1.5;
  word-break: break-word;
}

/* ---------- 进出动画：从右侧滑入 + 淡入 ---------- */
.toast-enter-active,
.toast-leave-active {
  transition: all var(--transition-normal);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(24px) scale(0.95);
}

/* 列表重排时的平滑移动 */
.toast-move {
  transition: transform var(--transition-normal);
}
</style>
