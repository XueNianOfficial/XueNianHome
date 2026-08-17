<!--
  ============================================================
  ImageShatter - 高级镜面碎片效果
  - 精确边缘拼合的碎片
  - 实时鼠标跟随反光
  - 3D悬停交互效果
  ============================================================
-->
<template>
  <div
    ref="containerRef"
    class="image-shatter"
    :class="{ 'is-assembled': isVisible }"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- 碎片容器 - 设置透视 -->
    <div class="shatter-perspective">
      <div
        v-for="(piece, i) in shards"
        :key="i"
        ref="shardRefs"
        class="shard-wrapper"
        :style="shardWrapperStyle(piece, i)"
        :data-shard-index="i"
      >
        <!-- 碎片本体 - 3D翻转在这里 -->
        <div class="shard-3d" :style="shard3dStyle(piece, i)">
          <!-- 正面：图片 + 动态高光 -->
          <div class="shard-face shard-front" :style="{ clipPath: piece.clip }">
            <img class="shard-img" :src="src" :alt="alt" loading="lazy" />
            <!-- 动态反光层 -->
            <div
              class="shard-reflection"
              :style="reflectionStyle(i)"
            ></div>
          </div>
          <!-- 背面：深色镜面 -->
          <div class="shard-face shard-back" :style="{ clipPath: piece.clip }">
            <div class="shard-back-gradient"></div>
          </div>
        </div>
      </div>
    </div>
    <!-- 裂纹闪光 -->
    <div class="crack-glow"></div>
    <!-- 兜底完整图 -->
    <img class="shatter-base" :src="src" :alt="alt" loading="lazy" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  src: string
  alt?: string
  delay?: number
  seed?: number
}>()

const containerRef = ref<HTMLElement | null>(null)
const shardRefs = ref<HTMLElement[]>([])
const isVisible = ref(false)
const isHovered = ref(false)
const mousePos = ref({ x: 0.5, y: 0.5 }) // 归一化坐标 0-1
const shardRotations = ref<Array<{ x: number; y: number }>>([])

// 伪随机数生成器
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

// 生成精确拼合的不规则碎片（使用共享边界 + 边缘破碎效果）
function generateShards(seed: number) {
  const rand = seededRandom(seed)
  const shards = []

  // 使用3x3网格
  const rows = 3
  const cols = 3

  // 生成网格角点（4x4个点）
  const gridPoints: Array<Array<{ x: number; y: number }>> = []

  for (let r = 0; r <= rows; r++) {
    gridPoints[r] = []
    for (let c = 0; c <= cols; c++) {
      const baseX = (c / cols) * 100
      const baseY = (r / rows) * 100

      // 边界点不抖动，内部点添加抖动
      const isEdge = r === 0 || r === rows || c === 0 || c === cols
      const jitter = isEdge ? 0 : 6

      gridPoints[r][c] = {
        x: Math.max(0, Math.min(100, baseX + (rand() - 0.5) * jitter)),
        y: Math.max(0, Math.min(100, baseY + (rand() - 0.5) * jitter))
      }
    }
  }

  // 生成共享的边缘中间点（让边缘不规则但仍能拼合）
  // 水平边的中间点
  const horizontalEdges: Array<Array<{ x: number; y: number }[]>> = []
  for (let r = 0; r <= rows; r++) {
    horizontalEdges[r] = []
    for (let c = 0; c < cols; c++) {
      const p1 = gridPoints[r][c]
      const p2 = gridPoints[r][c + 1]
      const midPoints = []

      // 每条边添加1-2个中间点，制造不规则效果
      const numMidPoints = 1 + Math.floor(rand() * 2) // 1或2个点
      for (let i = 0; i < numMidPoints; i++) {
        const t = (i + 1) / (numMidPoints + 1)
        const midX = p1.x + (p2.x - p1.x) * t
        const midY = p1.y + (p2.y - p1.y) * t

        // 添加垂直于边的偏移（制造锯齿效果）
        const offset = (rand() - 0.5) * 8
        const isTopOrBottom = r === 0 || r === rows

        midPoints.push({
          x: Math.max(0, Math.min(100, midX + (isTopOrBottom ? 0 : offset * 0.3))),
          y: Math.max(0, Math.min(100, midY + (isTopOrBottom ? 0 : offset)))
        })
      }
      horizontalEdges[r][c] = midPoints
    }
  }

  // 垂直边的中间点
  const verticalEdges: Array<Array<{ x: number; y: number }[]>> = []
  for (let c = 0; c <= cols; c++) {
    verticalEdges[c] = []
    for (let r = 0; r < rows; r++) {
      const p1 = gridPoints[r][c]
      const p2 = gridPoints[r + 1][c]
      const midPoints = []

      const numMidPoints = 1 + Math.floor(rand() * 2)
      for (let i = 0; i < numMidPoints; i++) {
        const t = (i + 1) / (numMidPoints + 1)
        const midX = p1.x + (p2.x - p1.x) * t
        const midY = p1.y + (p2.y - p1.y) * t

        const offset = (rand() - 0.5) * 8
        const isLeftOrRight = c === 0 || c === cols

        midPoints.push({
          x: Math.max(0, Math.min(100, midX + (isLeftOrRight ? 0 : offset))),
          y: Math.max(0, Math.min(100, midY + (isLeftOrRight ? 0 : offset * 0.3)))
        })
      }
      verticalEdges[c][r] = midPoints
    }
  }

  // 生成每个碎片的不规则多边形
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tl = gridPoints[r][c]
      const tr = gridPoints[r][c + 1]
      const bl = gridPoints[r + 1][c]
      const br = gridPoints[r + 1][c + 1]

      // 构建多边形顶点（顺时针）：左上 -> 顶边中间点 -> 右上 -> 右边中间点 -> 右下 -> 底边中间点 -> 左下 -> 左边中间点
      const points = []

      // 左上角
      points.push(tl)

      // 顶边中间点
      horizontalEdges[r][c].forEach(p => points.push(p))

      // 右上角
      points.push(tr)

      // 右边中间点
      verticalEdges[c + 1][r].forEach(p => points.push(p))

      // 右下角
      points.push(br)

      // 底边中间点（反向）
      horizontalEdges[r + 1][c].slice().reverse().forEach(p => points.push(p))

      // 左下角
      points.push(bl)

      // 左边中间点（反向）
      verticalEdges[c][r].slice().reverse().forEach(p => points.push(p))

      const clipStr = `polygon(${points.map(p => `${p.x}% ${p.y}%`).join(', ')})`

      // 飞入参数
      const angle = rand() * Math.PI * 2
      const distance = 120 + rand() * 80
      const fromX = Math.cos(angle) * distance
      const fromY = Math.sin(angle) * distance
      const rotation = (rand() - 0.5) * 140

      // 3D翻转参数
      const flipAxis = rand() > 0.5 ? 'X' : 'Y'
      const flipDeg = 90 + rand() * 90

      const delay = Math.floor(rand() * 400)

      // 碎片中心位置（用于计算反光）
      const centerX = (tl.x + tr.x + bl.x + br.x) / 4
      const centerY = (tl.y + tr.y + bl.y + br.y) / 4

      shards.push({
        clip: clipStr,
        from: { x: fromX, y: fromY, rot: rotation },
        flip: { axis: flipAxis, deg: flipDeg },
        center: { x: centerX / 100, y: centerY / 100 },
        delay
      })
    }
  }

  return shards
}

const seedVal = computed(() => props.seed || Math.floor(Math.random() * 10000))
const shards = computed(() => generateShards(seedVal.value))

// 初始化碎片旋转数组
watch(shards, (newShards) => {
  shardRotations.value = newShards.map(() => ({ x: 0, y: 0 }))
}, { immediate: true })

function shardWrapperStyle(piece: any, index: number) {
  const rotation = shardRotations.value[index] || { x: 0, y: 0 }

  return {
    '--from-x': `${piece.from.x}px`,
    '--from-y': `${piece.from.y}px`,
    '--from-rot': `${piece.from.rot}deg`,
    '--delay': `${(props.delay || 0) + piece.delay}ms`,
    '--hover-rot-x': `${rotation.x}deg`,
    '--hover-rot-y': `${rotation.y}deg`
  }
}

function shard3dStyle(piece: any, index: number) {
  return {
    '--flip-x-deg': piece.flip.axis === 'X' ? `${piece.flip.deg}deg` : '0deg',
    '--flip-y-deg': piece.flip.axis === 'Y' ? `${piece.flip.deg}deg` : '0deg'
  }
}

// 计算动态反光样式（基于碎片旋转角度和光源位置）
function reflectionStyle(index: number) {
  const shard = shards.value[index]
  if (!shard) return {}

  const rotation = shardRotations.value[index] || { x: 0, y: 0 }

  // 假设光源在鼠标位置（悬停时）或默认位置（非悬停时）
  let lightX = 0.5
  let lightY = 0.5

  if (isHovered.value) {
    lightX = mousePos.value.x
    lightY = mousePos.value.y
  }

  // 计算碎片中心到光源的向量
  const dx = lightX - shard.center.x
  const dy = lightY - shard.center.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // 计算碎片的法线方向（基于3D旋转）
  // rotateX(rx) rotateY(ry) 后，法线 (0, 0, 1) 变为：
  const rx = rotation.x * (Math.PI / 180)
  const ry = rotation.y * (Math.PI / 180)

  // 旋转后的法线向量（简化计算）
  const normalX = Math.sin(ry)
  const normalY = -Math.sin(rx)
  const normalZ = Math.cos(rx) * Math.cos(ry)

  // 光源方向向量（从碎片指向光源，假设光源在屏幕前方）
  const lightDirX = dx
  const lightDirY = dy
  const lightDirZ = 0.8 // 光源在屏幕外一定距离

  // 归一化光源方向
  const lightLen = Math.sqrt(lightDirX * lightDirX + lightDirY * lightDirY + lightDirZ * lightDirZ)
  const lx = lightDirX / lightLen
  const ly = lightDirY / lightLen
  const lz = lightDirZ / lightLen

  // 计算法线和光源的点积（反光强度）
  const dotProduct = Math.max(0, normalX * lx + normalY * ly + normalZ * lz)

  // 反光强度：考虑旋转角度和距离
  const angleFactor = Math.pow(dotProduct, 2) // 平方使高光更集中
  const distanceFactor = isHovered.value ? Math.max(0, 1 - distance * 1.2) : 0.3
  const intensity = angleFactor * distanceFactor

  // 计算反光的梯度角度（基于光源方向）
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)

  return {
    '--reflection-angle': `${angle + 135}deg`,
    '--reflection-intensity': intensity.toFixed(3),
    '--rotation-factor': dotProduct.toFixed(3)
  }
}

function onMouseEnter() {
  isHovered.value = true
}

function onMouseMove(e: MouseEvent) {
  if (!containerRef.value || !isVisible.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height

  mousePos.value = { x, y }

  // 更新每个碎片的3D旋转
  shards.value.forEach((shard, i) => {
    // 计算碎片中心到鼠标的距离和方向
    const dx = x - shard.center.x
    const dy = y - shard.center.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // 根据距离计算倾斜角度（最大10度）
    const maxTilt = 10
    const tiltIntensity = Math.max(0, 1 - distance * 1.2)

    // 碎片朝向鼠标方向倾斜
    shardRotations.value[i] = {
      x: -dy * maxTilt * tiltIntensity,
      y: dx * maxTilt * tiltIntensity
    }
  })
}

function onMouseLeave() {
  isHovered.value = false
  // 重置所有旋转
  shardRotations.value = shardRotations.value.map(() => ({ x: 0, y: 0 }))
  // 重置鼠标位置到中心
  mousePos.value = { x: 0.5, y: 0.5 }
}

onMounted(() => {
  if (!containerRef.value) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isVisible.value) {
          isVisible.value = true
        }
      })
    },
    { threshold: 0.25 }
  )

  observer.observe(containerRef.value)
  onUnmounted(() => observer.disconnect())
})
</script>

<style scoped>
.image-shatter {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-lg);
  box-shadow: none;
  transition: box-shadow 0.3s ease 1.8s;
  cursor: pointer;
}

.image-shatter.is-assembled {
  box-shadow: var(--shadow-sm);
}

.shatter-perspective {
  position: absolute;
  inset: 0;
  perspective: 1200px;
  perspective-origin: 50% 50%;
  z-index: 2;
}

.shard-wrapper {
  position: absolute;
  inset: 0;
  /* 初始状态：飞出 + 旋转 */
  transform: translate3d(var(--from-x), var(--from-y), 0) rotate(var(--from-rot));
  opacity: 0;
  transition:
    transform 1.4s cubic-bezier(0.19, 1.4, 0.28, 1),
    opacity 0.6s ease-out;
  transition-delay: var(--delay);
}

.is-assembled .shard-wrapper {
  transform: translate3d(0, 0, 0) rotate(0deg);
  opacity: 1;
}

.shard-3d {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  /* 初始3D翻转 */
  transform:
    rotateX(var(--flip-x-deg))
    rotateY(var(--flip-y-deg));
  transition: transform 1.4s cubic-bezier(0.19, 1.4, 0.28, 1);
  transition-delay: var(--delay);
}

.is-assembled .shard-3d {
  transform:
    rotateX(calc(var(--hover-rot-x, 0deg)))
    rotateY(calc(var(--hover-rot-y, 0deg)));
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.shard-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
}

.shard-front {
  z-index: 2;
}

.shard-back {
  z-index: 1;
  transform: rotateY(180deg);
}

.shard-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  user-select: none;
}

/* 动态反光效果 - 基于3D旋转角度实时计算 */
.shard-reflection {
  position: absolute;
  inset: 0;
  pointer-events: none;
  mix-blend-mode: overlay;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

/* 拼合完成前：不显示反光 */
.shard-reflection {
  opacity: 0;
}

/* 拼合完成后：显示基于物理的实时反光 */
.is-assembled .shard-reflection {
  background: radial-gradient(
    ellipse 100% 100% at 50% 50%,
    rgba(255, 255, 255, 1) 0%,
    rgba(255, 255, 255, 0.85) 15%,
    rgba(255, 255, 255, 0.4) 35%,
    transparent 60%
  );
  background-size: 300% 300%;
  /* 反光强度由旋转角度决定 */
  opacity: calc(var(--reflection-intensity, 0) * 1.2);
  /* 根据旋转因子偏移反光位置，模拟真实光照 */
  transform: translate(
    calc(var(--rotation-factor, 0) * 15px),
    calc(var(--rotation-factor, 0) * 15px)
  ) scale(calc(0.8 + var(--rotation-factor, 0) * 0.6));
  filter: blur(3px);
}

.shard-back-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%);
}

.crack-glow {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 255, 255, 0.5) 25%,
    rgba(135, 206, 250, 0.3) 40%,
    transparent 65%
  );
}

.is-assembled .crack-glow {
  animation: crack-flash 1s ease-out 0.6s both;
}

@keyframes crack-flash {
  0% { opacity: 0; transform: scale(0.6) rotate(0deg); }
  15% { opacity: 1; transform: scale(1) rotate(3deg); }
  35% { opacity: 0.9; transform: scale(1.2) rotate(-2deg); }
  60% { opacity: 0.4; transform: scale(1.5) rotate(1deg); }
  100% { opacity: 0; transform: scale(2) rotate(0deg); }
}

.shatter-base {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.5s ease 2s;
  user-select: none;
}

.is-assembled .shatter-base {
  opacity: 1;
}

/* 减少动画模式 */
@media (prefers-reduced-motion: reduce) {
  .shard-wrapper,
  .shard-3d {
    transform: none !important;
    transition: opacity 0.3s ease;
  }
  .shard-wrapper { opacity: 1 !important; }
  .shatter-base { opacity: 1 !important; }
  .crack-glow,
  .shard-reflection { display: none; }
}
</style>
