<!--
============================================================
  雪年个人网站 - 首页英雄区域
  角色主视觉：立绘 + 名字 + 标签语轮播 + 简介 + CTA 按钮组
  动效：立绘 3D 视差倾斜 / 名字流光渐变 / 背景光晕漂移 + 滚动视差 / 雪花浮动
        / 画布雪花粒子（SnowfallCanvas）/ 文字错落入场 / CTA 磁吸按钮
============================================================
-->
<template>
  <section ref="heroRef" class="hero-section">
    <!-- 背景装饰：柔和的蓝色光晕与雪花（纯装饰，对辅助技术隐藏）。
         每个光晕外包一层 glow-parallax 容器：容器由 JS 做滚动视差位移，
         内层光晕保留 CSS 漂移动画，两者 transform 互不干扰 -->
    <div class="hero-bg-decor" aria-hidden="true">
      <div ref="glow1El" class="glow-parallax glow-parallax--1">
        <div class="decor-glow decor-glow--1"></div>
      </div>
      <div ref="glow2El" class="glow-parallax glow-parallax--2">
        <div class="decor-glow decor-glow--2"></div>
      </div>
      <div ref="glow3El" class="glow-parallax glow-parallax--3">
        <div class="decor-glow decor-glow--3"></div>
      </div>
      <span class="decor-snow decor-snow--1">❄</span>
      <span class="decor-snow decor-snow--2">❆</span>
      <span class="decor-snow decor-snow--3">❅</span>
    </div>

    <!-- 画布雪花粒子：三层景深 + 鼠标风场（位于背景装饰之上、内容之下） -->
    <HomeSnowfallCanvas />

    <div class="container-page hero-content">
      <!-- 左侧：角色立绘（白色相框 + 背后光晕）
           结构分三层：.hero-image（入场动画）→ .hero-tilt（JS 视差倾斜 + 滚动视差）
           → .hero-image-wrapper（CSS 上下浮动），各管各的 transform 互不干扰 -->
      <div class="hero-image">
        <div ref="tiltRef" class="hero-tilt">
          <div class="hero-image-wrapper">
            <img
              src="/images/立绘.png"
              alt="雪年立绘"
              class="hero-portrait"
              width="400"
              height="500"
              loading="eager"
              fetchpriority="high"
            />
          </div>
        </div>
      </div>

      <!-- 右侧：徽章、名字、标签语轮播、简介与 CTA 按钮组 -->
      <div class="hero-text">
        <span class="badge hero-badge">🐾 一只小狼w</span>
        <h1 class="hero-name">
          <span class="name-chinese">雪年</span>
          <span class="name-english">XueNian</span>
        </h1>
        <!-- 标签语轮播：装饰性内容，对屏幕阅读器隐藏避免反复朗读 -->
        <div class="hero-tagline" aria-hidden="true">
          <Transition name="tagline" mode="out-in">
            <span :key="taglineIndex" class="tagline-text">「 {{ taglines[taglineIndex] }} 」</span>
          </Transition>
        </div>
        <p class="hero-description">
          这里是我的数字小窝——画画、写码、记录生活。
          欢迎常来坐坐！
        </p>
        <div class="hero-actions">
          <NuxtLink to="/chat" class="btn-primary" :ref="magnetic.bind">
            💬 和我聊天
          </NuxtLink>
          <NuxtLink to="/blog" class="btn-outline" :ref="magnetic.bind">
            📝 阅读博客
          </NuxtLink>
          <NuxtLink to="/gallery" class="btn-outline" :ref="magnetic.bind">
            🖼️ 欣赏画廊
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- 向下滚动提示 -->
    <div class="scroll-hint" aria-hidden="true">
      <span class="scroll-arrow">⌄</span>
      <span class="scroll-text">向下滚动</span>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * ============================================================
 *  HeroSection - 首页英雄区域组件
 *  - 桌面端左图右文，移动端上下堆叠居中
 *  - 动效细节：
 *    · 立绘 3D 视差倾斜：跟随鼠标方向轻微转动，lerp 平滑逼近，
 *      离开英雄区后缓慢回正；触屏与减弱动效用户不启用
 *    · 立绘滚动视差：向下滚动时立绘随滚动轻微滞后下坠，
 *      与页面拉开速度差，营造纵深（合并在倾斜的同一帧循环里）
 *    · 背景光晕滚动视差：三个光晕各以不同速度随滚动漂移（useParallax）
 *    · 中文名流光渐变：background-position 循环移动，
 *      渐变首尾同为 accent 色，循环处无跳变
 *    · 标签语轮播：每 3.2 秒切换一句（上浮淡入），减弱动效时固定第一句
 *    · 背景光晕：color-mix 基于 --color-accent 取色并缓慢漂移，
 *      亮/暗主题切换时色相自动跟随
 *    · 画布雪花：SnowfallCanvas 三层景深飘落，鼠标横向移动生风
 *    · CTA 磁吸：按钮向指针轻微吸附、离开回弹（useMagnetic）
 *  - 入场使用全局 fade-in-up 关键帧（backwards 填充，
 *    避免动画结束后的 fill 状态覆盖悬停 transform）；
 *    文字区改为子元素各自错落入场，层次更细腻
 * ============================================================
 */

/** CTA 按钮磁吸（仅精确指针 + 未减弱动效时生效） */
const magnetic = useMagnetic({ strength: 0.3, maxOffset: 6 })

/** 轮播标签语：雪年的「一句话状态」 */
const taglines = [
  '用色彩描绘毛茸茸的世界',
  '用代码编织有趣的梦境',
  '在雪地上留下温暖的脚印',
  '把每一天过成喜欢的样子'
]
const taglineIndex = ref(0)
let taglineTimer: ReturnType<typeof setInterval> | undefined

// ---------- 背景光晕滚动视差（三个光晕速度各异，拉出层次） ----------
const glow1El = useParallax(0.06)
const glow2El = useParallax(0.1)
const glow3El = useParallax(-0.05)

// ---------- 立绘 3D 视差倾斜 + 滚动视差 ----------
const heroRef = ref<HTMLElement | null>(null)
const tiltRef = ref<HTMLElement | null>(null)
/** 目标倾斜量（-0.5 ~ 0.5，相对英雄区中心的鼠标位置） */
let targetX = 0
let targetY = 0
/** 当前倾斜量（每帧 lerp 逼近目标，形成阻尼感） */
let currentX = 0
let currentY = 0
let tiltRaf = 0

function onHeroMouseMove(e: MouseEvent): void {
  if (!heroRef.value) return
  const rect = heroRef.value.getBoundingClientRect()
  targetX = (e.clientX - rect.left) / rect.width - 0.5
  targetY = (e.clientY - rect.top) / rect.height - 0.5
}

/** 鼠标离开英雄区后立绘缓慢回正 */
function onHeroMouseLeave(): void {
  targetX = 0
  targetY = 0
}

/**
 * 倾斜动画主循环：小系数 lerp 让转动带有重量感；
 * 同时把滚动视差并入同一 transform——向下滚动时立绘轻微下坠补偿，
 * 视觉上比页面「慢半拍」，形成纵深
 */
function tiltTick(): void {
  currentX += (targetX - currentX) * 0.08
  currentY += (targetY - currentY) * 0.08
  if (tiltRef.value) {
    const rotateY = currentX * 10 // 左右最大约 ±5°
    const rotateX = -currentY * 8 // 上下最大约 ±4°
    // 滚动视差：只取前 800px 滚动量，避免离开首屏后无限累积
    const scrollLift = Math.min(window.scrollY, 800) * 0.06
    tiltRef.value.style.transform =
      `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(${scrollLift}px)`
  }
  tiltRaf = requestAnimationFrame(tiltTick)
}

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // 标签语轮播：减弱动效时固定显示第一句，不打扰用户
  if (!reducedMotion) {
    taglineTimer = setInterval(() => {
      taglineIndex.value = (taglineIndex.value + 1) % taglines.length
    }, 3200)
  }

  // 视差倾斜：仅「鼠标 + 未要求减弱动效」时启用
  const finePointer = window.matchMedia('(pointer: fine)').matches
  if (finePointer && !reducedMotion && heroRef.value) {
    heroRef.value.addEventListener('mousemove', onHeroMouseMove, { passive: true })
    heroRef.value.addEventListener('mouseleave', onHeroMouseLeave)
    tiltRaf = requestAnimationFrame(tiltTick)
  }
})

onUnmounted(() => {
  clearInterval(taglineTimer)
  cancelAnimationFrame(tiltRaf)
  heroRef.value?.removeEventListener('mousemove', onHeroMouseMove)
  heroRef.value?.removeEventListener('mouseleave', onHeroMouseLeave)
})
</script>

<style scoped>
/* ---------- 英雄区域容器 ---------- */
.hero-section {
  position: relative;
  /* 减去顶部导航栏高度，使首屏刚好占满可视区 */
  min-height: calc(100vh - var(--header-height));
  display: flex;
  align-items: center;
  overflow: hidden;
  background: linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-tertiary) 100%);
}

/* ---------- 背景装饰：径向渐变光晕（滚动视差 + 缓慢漂移） ---------- */
.hero-bg-decor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

/* 视差容器：承担定位与 JS 滚动位移（transform 由 useParallax 每帧写入） */
.glow-parallax {
  position: absolute;
  will-change: transform;
}

.glow-parallax--1 {
  width: 480px;
  height: 480px;
  top: -140px;
  right: -80px;
}

.glow-parallax--2 {
  width: 380px;
  height: 380px;
  bottom: -100px;
  left: -100px;
}

.glow-parallax--3 {
  width: 320px;
  height: 320px;
  top: 40%;
  left: 45%;
}

/* 光晕统一为「中心浓、边缘消散」的圆，透明度用 color-mix 控制，
   不引入任何硬编码颜色，暗色主题下自然融入；
   填满视差容器，自身只保留 CSS 漂移动画 */
.decor-glow {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  will-change: transform;
}

.decor-glow--1 {
  background: radial-gradient(circle, color-mix(in srgb, var(--color-accent) 26%, transparent) 0%, transparent 70%);
  animation: glow-drift-1 14s ease-in-out infinite alternate;
}

.decor-glow--2 {
  background: radial-gradient(circle, color-mix(in srgb, var(--color-accent-light) 22%, transparent) 0%, transparent 70%);
  animation: glow-drift-2 18s ease-in-out infinite alternate;
}

.decor-glow--3 {
  background: radial-gradient(circle, color-mix(in srgb, var(--color-accent) 14%, transparent) 0%, transparent 70%);
  animation: glow-drift-3 16s ease-in-out infinite alternate;
}

/* 光晕漂移：小幅度位移 + 轻微缩放，让背景「呼吸」起来 */
@keyframes glow-drift-1 {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(-42px, 30px) scale(1.08); }
}

@keyframes glow-drift-2 {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(52px, -26px) scale(1.1); }
}

@keyframes glow-drift-3 {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(-30px, -38px) scale(0.94); }
}

/* ---------- 背景装饰：雪花点缀（低透明度缓慢浮动，不喧宾夺主） ---------- */
.decor-snow {
  position: absolute;
  color: var(--color-accent);
  user-select: none;
  animation: snow-float 7s ease-in-out infinite;
}

.decor-snow--1 {
  top: 18%;
  left: 12%;
  font-size: var(--text-xl);
  opacity: 0.4;
}

.decor-snow--2 {
  top: 26%;
  right: 16%;
  font-size: var(--text-lg);
  opacity: 0.3;
  animation-delay: 1.5s;
}

.decor-snow--3 {
  bottom: 24%;
  left: 42%;
  font-size: var(--text-base);
  opacity: 0.26;
  animation-delay: 3s;
}

@keyframes snow-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-12px) rotate(8deg); }
}

/* ---------- 内容布局 ---------- */
.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-16);
  padding-top: var(--space-8);
  padding-bottom: var(--space-16);
}

/* ---------- 立绘图片 ---------- */
.hero-image {
  position: relative;
  flex-shrink: 0;
  /* 入场：上浮淡入 */
  animation: fade-in-up 0.6s ease backwards;
}

/* 立绘背后的 accent 光晕：溢出相框边缘，营造「被柔光托起」的感觉 */
.hero-image::before {
  content: '';
  position: absolute;
  inset: -10%;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-accent) 22%, transparent) 0%, transparent 70%);
}

/* 视差倾斜层：transform 由 JS 每帧写入（rotateX/rotateY + 滚动位移 + 透视） */
.hero-tilt {
  position: relative;
  will-change: transform;
}

/* 白色相框：悬浮卡片质感 + 轻微上下浮动 */
.hero-image-wrapper {
  position: relative;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  background: var(--color-bg-secondary);
  padding: var(--space-2);
  animation: float-y 6s ease-in-out infinite;
}

.hero-portrait {
  display: block;
  max-width: 340px;
  width: 100%;
  height: auto;
  border-radius: var(--radius-lg);
}

/* 立绘浮动动画（prefers-reduced-motion 由全局样式统一降级） */
@keyframes float-y {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* ---------- 文字区域 ----------
   整块入场动画已下放到各子元素：错落延迟依次浮现，层次更细腻 */
.hero-text {
  max-width: 480px;
}

.hero-text > .hero-badge {
  animation: fade-in-up 0.6s ease 0.25s backwards;
}

.hero-text > .hero-name {
  animation: fade-in-up 0.6s ease 0.35s backwards;
}

.hero-text > .hero-tagline {
  animation: fade-in-up 0.6s ease 0.45s backwards;
}

.hero-text > .hero-description {
  animation: fade-in-up 0.6s ease 0.55s backwards;
}

.hero-text > .hero-actions {
  animation: fade-in-up 0.6s ease 0.7s backwards;
}

/* 角色标签：复用全局 .badge（accent 浅底胶囊） */
.hero-badge {
  padding: 6px 16px;
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
}

.hero-name {
  margin: 0 0 var(--space-3);
}

/* 中文名：大标题 + 流光渐变文字，作为整页视觉焦点。
   渐变首尾同为 accent 色，background-position 循环一周无跳变；
   中间插入 sheen 高光 stop，流光扫过时有一道亮痕 */
.name-chinese {
  display: block;
  font-size: var(--text-4xl);
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
  background: linear-gradient(
    120deg,
    var(--color-accent) 0%,
    var(--color-accent-sheen) 28%,
    var(--color-accent-light) 45%,
    var(--color-accent-sheen) 62%,
    var(--color-accent) 100%
  );
  background-size: 220% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: name-shine 6s linear infinite;
}

@keyframes name-shine {
  from { background-position: 0% center; }
  to { background-position: -220% center; }
}

/* 英文名：小字宽字距，弱化处理 */
.name-english {
  display: block;
  margin-top: var(--space-2);
  font-size: var(--text-xl);
  font-weight: 400;
  color: var(--color-text-muted);
  letter-spacing: 4px;
}

/* ---------- 标签语轮播 ---------- */
/* 固定高度 + 溢出隐藏：切换时下方内容不跳动 */
.hero-tagline {
  height: 1.9em;
  margin: 0 0 var(--space-3);
  overflow: hidden;
}

.tagline-text {
  display: inline-block;
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-accent);
  letter-spacing: 0.02em;
}

/* 轮播过渡：新句自下方浮入，旧句向上淡出 */
.tagline-enter-active,
.tagline-leave-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}

.tagline-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.tagline-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

.hero-description {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin: 0 0 var(--space-8);
}

/* ---------- CTA 按钮组（主按钮 + 两个描边按钮） ---------- */
.hero-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* ---------- 向下滚动提示 ---------- */
.scroll-hint {
  position: absolute;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-text-muted);
  /* 弹跳提示常驻 + 首屏延迟淡入（fade-in 只动 opacity，与 transform 动画互补） */
  animation:
    bounce-hint 2s ease-in-out infinite,
    fade-in 0.8s ease 1.2s backwards;
}

.scroll-arrow {
  font-size: var(--text-2xl);
  line-height: 1;
}

.scroll-text {
  font-size: var(--text-xs);
}

@keyframes bounce-hint {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(8px); }
}

/* ---------- 响应式：移动端上下堆叠、标题缩小、按钮居中 ---------- */
@media (max-width: 860px) {
  .hero-content {
    flex-direction: column;
    text-align: center;
    gap: var(--space-8);
    padding-top: var(--space-12);
    /* 底部多留空间，避免与滚动提示重叠 */
    padding-bottom: calc(var(--space-16) + var(--space-8));
  }

  .hero-portrait {
    max-width: 240px;
  }

  .hero-text {
    max-width: 100%;
  }

  .name-chinese {
    font-size: var(--text-3xl);
  }

  .hero-description {
    font-size: var(--text-base);
  }

  .hero-actions {
    justify-content: center;
  }
}
</style>
