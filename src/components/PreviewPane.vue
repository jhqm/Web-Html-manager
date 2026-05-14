<template>
  <!--
    预览内核（重构版 v3 / BUILD-108A）
    设计原则：
      1) 统一加载协议：通过 app://preview/<path> 加载，dev/prod 行为一致
      2) 零侵入：绝不读写 iframe.contentDocument，绝不注入 CSS / 监听 DOM
      3) 单一缩放方案：
           stage  = viewport × zoom        ← 撑滚动空间（layout 尺寸）
           iframe = stage × (1/zoom)        ← 反比，使布局尺寸恒等于 viewport
           transform: scale(zoom), origin (0,0)
         数学保证：iframe 视觉尺寸 = viewport × zoom，恰好填满 stage
         不论 zoom 大于、等于、小于 1，都不会留白也不会溢出
      4) 无拖拽：滚动完全交给浏览器原生行为
  -->
  <div ref="viewportRef" class="pp-viewport">
    <div class="pp-stage" :style="stageStyle">
      <iframe
        ref="frameRef"
        class="pp-frame"
        :src="src"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        :style="frameStyle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  /** 预览文件的绝对路径；为空则展示空白页 */
  filePath: string | null
  /** 缩放比例，1 = 100% */
  zoom: number
}>()

const viewportRef = ref<HTMLDivElement | null>(null)
const frameRef = ref<HTMLIFrameElement | null>(null)

// ============================================================
// 资源加载：统一走 app://preview/<encoded-absolute-path>
// 不再使用 file://，dev/prod 同源同协议，行为一致
// ============================================================
function toAppUrl(filePath: string): string {
  // 兼容 Windows：把 "C:\foo\bar.html" 标准化成 "C:/foo/bar.html"
  // 然后去掉前导斜杠（如果有），最终拼到 app://preview/ 之后
  const normalized = filePath.replace(/\\+/g, '/')
  const trimmed = normalized.startsWith('/') ? normalized.slice(1) : normalized
  return `app://preview/${encodeURI(trimmed)}`
}

const src = computed(() => (
  props.filePath ? toAppUrl(props.filePath) : 'about:blank'
))

// ============================================================
// 缩放方案数学推导：
//
//   设 viewport 宽 = V，缩放比 = z
//
//   stage.width  = V * z          （layout 尺寸，撑滚动空间）
//   iframe.width = stage * (1/z)  = V    （iframe 内 HTML 按原始 V 布局）
//   iframe 视觉  = iframe * z     = V * z = stage      ✅ 完美填满
//
//   滚动空间    = stage layout    = V * z
//     z = 0.5 → stage = 0.5V，无滚动条，视觉填满
//     z = 1.0 → stage = V，  无滚动条
//     z = 2.0 → stage = 2V， 出滚动条，鼠标/滚轮/触控板自然滚动
// ============================================================
function clampZoom(z: number): number {
  if (!Number.isFinite(z) || z <= 0) return 1
  return Math.min(2, Math.max(0.25, z))
}

const stageStyle = computed(() => {
  const z = clampZoom(props.zoom)
  const pct = `${z * 100}%`
  return {
    width: pct,
    height: pct
  }
})

const frameStyle = computed(() => {
  const z = clampZoom(props.zoom)
  const inv = `${(1 / z) * 100}%`
  return {
    width: inv,
    height: inv,
    transform: `scale(${z})`,
    transformOrigin: '0 0'
  }
})

// 切换文件时复位滚动位置（更符合直觉）
watch(() => props.filePath, () => {
  const el = viewportRef.value
  if (el) { el.scrollLeft = 0; el.scrollTop = 0 }
})

// ============================================================
// 暴露最小 API：给父组件做"全屏 / 重新加载"等可选操作
// ============================================================
defineExpose({
  /** 让 iframe 进入全屏 */
  requestFullscreen() {
    frameRef.value?.requestFullscreen?.()
  },
  /** 重新加载当前 src（保持当前 zoom 与滚动） */
  reload() {
    const f = frameRef.value
    if (!f) return
    const cur = f.src
    f.src = 'about:blank'
    requestAnimationFrame(() => { f.src = cur })
  },
  /** 获取底层 iframe 元素引用（仅在必要时使用） */
  getFrameEl(): HTMLIFrameElement | null {
    return frameRef.value
  }
})
</script>

<style scoped>
.pp-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;        /* 缩放 > 1 时由此产生滚动条 */
  background: #fff;
}

.pp-stage {
  /* 真实尺寸由内联 style 控制（与 zoom 同比） */
  position: relative;
  /* 关键：必须为绝对定位/块级容器，避免 iframe 反比尺寸时撑破 stage 视觉边界 */
  overflow: hidden;
}

.pp-frame {
  /* width/height/transform 由内联 style 控制（与 zoom 反比 + scale） */
  display: block;
  border: none;
  /* origin 已在 inline style 设置，但加一份保险 */
  transform-origin: 0 0;
}
</style>
