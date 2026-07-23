<template>
  <!-- 空会话欢迎面板：问候语 + 推荐问题 -->
  <div class="chat-welcome">
    <img
      :src="welcomeAvatar"
      alt="雪年头像"
      class="welcome-avatar"
      @error="onAvatarError"
    />
    <h3 class="welcome-title">你好，这里是雪年！</h3>
    <p class="welcome-desc">我是雪年，一只喜欢画画和雪的小动物～想聊点什么都可以，或者从下面挑一个话题开始：</p>
    <div class="quick-prompts">
      <!-- 优先展示后台配置的提示词模板 -->
      <template v-if="promptTemplates.length > 0">
        <button
          v-for="tpl in promptTemplates"
          :key="tpl.id"
          class="prompt-chip"
          @click="ask(tpl.prompt)"
        >
          {{ tpl.title }}
        </button>
      </template>
      <!-- 无模板时回退到内置快捷短语 -->
      <template v-else>
        <button
          v-for="prompt in quickPrompts"
          :key="prompt"
          class="prompt-chip"
          @click="ask(prompt)"
        >
          {{ prompt }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  ChatWelcome - 聊天空状态欢迎面板
 *  - 显示 AI 预设头像（加载失败回退默认头像）与问候语
 *  - 推荐问题点击后直接作为用户消息发送
 *  - 推荐问题优先使用后台提示词模板，为空时回退内置快捷短语
 * ============================================================
 */
import { computed, ref } from 'vue'
import { useChat } from '~/composables/useChat'

const { currentPresetAvatar, sendMessage, promptTemplates } = useChat()

const DEFAULT_AVATAR = '/images/头像.png'

// 预设头像加载失败时回退到默认头像
const avatarFailed = ref(false)
const welcomeAvatar = computed(() =>
  avatarFailed.value ? DEFAULT_AVATAR : (currentPresetAvatar.value || DEFAULT_AVATAR)
)
const onAvatarError = () => { avatarFailed.value = true }

// 内置快捷短语：当后台未配置提示词模板（promptTemplates 为空）时回退展示
const quickPrompts = [
  '你好呀，介绍一下你自己吧！',
  '你平时喜欢画什么样的作品？',
  '可以给我讲个故事吗？',
  '有什么推荐的 furry 画师吗？',
]

const ask = (prompt: string) => {
  sendMessage(prompt)
}
</script>

<style scoped>
.chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-2xl) var(--space-lg);
  gap: var(--space-sm);
  animation: fade-in-up var(--transition-slow) both;
}

.welcome-avatar {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-full);
  object-fit: cover;
  border: 3px solid var(--color-accent-bg);
  box-shadow: var(--shadow-md);
  margin-bottom: var(--space-xs);
}

.welcome-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.welcome-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin: 0;
  max-width: 320px;
}

.quick-prompts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}

.prompt-chip {
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.prompt-chip:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-bg);
}
</style>
