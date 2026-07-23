<!--
============================================================
  管理后台 - 通用二次确认弹窗
  用于删除文章/图片/友链、清空聊天记录等破坏性操作
  - 遮罩 + 卡片 + 危险按钮，支持自定义标题/描述/确认文案
  - ESC 键或点击遮罩可取消（执行中不可取消）
============================================================
-->
<template>
  <!-- 遮罩层：点击自身（非卡片区域）触发取消 -->
  <div
    v-if="show"
    class="confirm-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    @click.self="handleCancel"
  >
    <div class="confirm-card card">
      <!-- 警示图标 -->
      <div class="confirm-icon">⚠️</div>

      <h3 class="confirm-title">{{ title }}</h3>
      <p v-if="description" class="confirm-desc">{{ description }}</p>

      <!-- 额外内容插槽（如需要补充说明时由父组件传入） -->
      <slot />

      <div class="confirm-actions">
        <button
          type="button"
          class="btn-ghost"
          :disabled="loading"
          @click="handleCancel"
        >{{ cancelText }}</button>
        <button
          type="button"
          class="btn-danger confirm-btn"
          :disabled="loading"
          @click="emit('confirm')"
        >{{ loading ? loadingText : confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * AdminConfirm - 通用二次确认弹窗
 *
 * 用法示例：
 *   <AdminConfirm
 *     :show="showDelete" title="删除文章"
 *     description="确定要删除「xxx」吗？此操作不可撤销。"
 *     confirm-text="确认删除" loading-text="删除中…" :loading="deleting"
 *     @confirm="doDelete" @cancel="showDelete = false"
 *   />
 *
 * 说明：
 * - show 由父组件控制；取消（ESC/遮罩/取消按钮）只派发 cancel 事件，由父组件关闭
 * - loading 期间禁用按钮且禁止取消，防止重复提交
 */

const props = withDefaults(defineProps<{
  /** 是否显示弹窗 */
  show: boolean
  /** 弹窗标题 */
  title?: string
  /** 描述文本（说明操作后果） */
  description?: string
  /** 确认按钮文案 */
  confirmText?: string
  /** 取消按钮文案 */
  cancelText?: string
  /** 执行中（禁用按钮、切换确认按钮文案、禁止取消） */
  loading?: boolean
  /** 执行中确认按钮文案 */
  loadingText?: string
}>(), {
  title: '确认操作',
  description: '',
  confirmText: '确认',
  cancelText: '取消',
  loading: false,
  loadingText: '处理中…'
})

const emit = defineEmits<{
  /** 点击确认按钮 */
  confirm: []
  /** 取消（ESC / 遮罩点击 / 取消按钮） */
  cancel: []
}>()

/** 触发取消：执行中不允许取消 */
function handleCancel() {
  if (props.loading) return
  emit('cancel')
}

/** ESC 键取消（仅在弹窗显示且非执行中时生效） */
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show && !props.loading) {
    emit('cancel')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* ---------- 遮罩层 ---------- */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-bg-mask);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  z-index: var(--z-modal);
  overflow-y: auto;
  animation: confirm-fade-in var(--transition-fast);
}

/* ---------- 弹窗卡片 ---------- */
.confirm-card {
  width: 100%;
  max-width: 400px;
  padding: var(--space-6);
  text-align: center;
  animation: confirm-pop var(--transition-spring);
}

.confirm-icon {
  font-size: 2rem;
  margin-bottom: var(--space-3);
}

.confirm-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-lg);
  color: var(--color-text-primary);
}

.confirm-desc {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
  word-break: break-word;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

/* main.css 的 .btn-danger 未定义禁用态，此处补齐 */
.confirm-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.confirm-btn:disabled:hover {
  background: transparent;
  color: var(--color-danger);
}

/* ---------- 动画 ---------- */
@keyframes confirm-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes confirm-pop {
  from {
    opacity: 0;
    transform: scale(0.94) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
