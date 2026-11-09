<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { absoluteBox } from '#shared/document/geometry'
import { findNode } from '#shared/document/tree'
import { provideCanvasGestures } from '../../composables/useCanvasGestures'
import { useDocumentActions } from '../../composables/useDocumentActions'
import { useDocumentStore } from '../../stores/document'
import { useEditorStore } from '../../stores/editor'

const documents = useDocumentStore()
const editor = useEditorStore()
const actions = useDocumentActions()
const viewport = ref<HTMLElement | null>(null)
const artboard = ref<HTMLElement | null>(null)
const gestures = provideCanvasGestures(artboard)
const spacePressed = computed(() => gestures.spacePressed.value)

onMounted(() => editor.bindViewport(viewport.value))
onUnmounted(() => editor.bindViewport(null))

const page = computed(() =>
  documents.document.pages.find(item => item.id === editor.activePageId) ?? documents.document.pages[0] ?? null,
)
const component = computed(() =>
  documents.document.components.find(item => item.id === editor.editingComponentId) ?? null,
)
const roots = computed(() => component.value ? [component.value.root] : page.value?.children ?? [])
const size = computed(() => component.value
  ? { width: 800, height: 600 }
  : { width: page.value?.width ?? 1440, height: page.value?.height ?? 900 },
)
const worldStyle = computed(() => ({
  transform: `translate3d(${editor.panX}px, ${editor.panY}px, 0) scale(${editor.zoom})`,
}))
const grid = computed(() => {
  let step: number = editor.gridSize
  while (step * editor.zoom < 8 && step < 512) step *= 2
  const line = 1 / editor.zoom
  // Keep the radius large enough to rasterize, then let the canvas scale enlarge it.
  const dot = Math.max(1.25 / editor.zoom, 0.75)
  return {
    step,
    majorStep: step * 8,
    line,
    dot,
    majorDot: dot * 1.6,
    minor: 'rgb(63 63 70 / 18%)',
    strong: 'rgb(63 63 70 / 34%)',
    dotMinor: 'rgb(63 63 70 / 62%)',
    dotStrong: 'rgb(63 63 70 / 82%)',
  }
})
const lineGridStyle = computed(() => {
  const { step, majorStep, line, minor, strong } = grid.value
  const image: string[] = []
  const size: string[] = []
  const add = (layer: string, span: number) => {
    image.push(layer)
    size.push(`${span}px ${span}px`)
  }
  const horizontal = (color: string) => `linear-gradient(to right, ${color} ${line}px, transparent ${line}px)`
  const vertical = (color: string) => `linear-gradient(to bottom, ${color} ${line}px, transparent ${line}px)`
  if (editor.gridMajor) {
    add(horizontal(strong), majorStep)
    add(vertical(strong), majorStep)
  }
  add(horizontal(minor), step)
  add(vertical(minor), step)
  return { backgroundImage: image.join(', '), backgroundSize: size.join(', ') }
})

const resizeHandles = computed(() => {
  if (editor.tool !== 'select' || editor.selection.length !== 1) return false
  const id = editor.selection[0]
  if (!id) return false
  const found = findNode(documents.document, id)
  return Boolean(found && !found.node.locked)
})

const boxes = computed(() => editor.selection.flatMap((id) => {
  const box = absoluteBox(documents.document, id)
  return box ? [{ ...box, id }] : []
}))

const preview = gestures.preview
const snapGuides = computed(() => gestures.snapGuides.value)

function onContextMenu(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('[data-node-id]')) return
  event.preventDefault()
  editor.openContextMenu(event.clientX, event.clientY)
}
const hover = computed(() => {
  if (!editor.hoverId || editor.selection.includes(editor.hoverId)) return null
  const box = absoluteBox(documents.document, editor.hoverId)
  return box ? { ...box, id: editor.hoverId } : null
})
</script>

<template>
  <div
    ref="viewport"
    class="viewport"
    :class="{ 'is-space': spacePressed, 'is-select': editor.tool === 'select', 'is-draw': editor.tool !== 'select' }"
    @pointerdown="gestures.onBackgroundPointerDown"
    @pointermove="gestures.onPointerMove"
    @contextmenu="onContextMenu"
    @wheel.prevent="gestures.onWheel"
  >
    <div class="world" :style="worldStyle">
      <div
        ref="artboard"
        class="artboard"
        :style="{ width: `${size.width}px`, height: `${size.height}px` }"
      >
        <div v-if="editor.gridVisible && editor.gridStyle === 'lines'" class="artboard-grid" :style="lineGridStyle" />
        <svg
          v-else-if="editor.gridVisible"
          class="artboard-grid"
          :width="size.width"
          :height="size.height"
        >
          <defs>
            <pattern
              id="artboard-dot-grid"
              patternUnits="userSpaceOnUse"
              :width="grid.step"
              :height="grid.step"
            >
              <circle :cx="grid.step / 2" :cy="grid.step / 2" :r="grid.dot" :fill="grid.dotMinor" />
            </pattern>
            <pattern
              v-if="editor.gridMajor"
              id="artboard-dot-grid-major"
              patternUnits="userSpaceOnUse"
              :width="grid.majorStep"
              :height="grid.majorStep"
            >
              <circle :cx="grid.majorStep / 2" :cy="grid.majorStep / 2" :r="grid.majorDot" :fill="grid.dotStrong" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#artboard-dot-grid)" />
          <rect v-if="editor.gridMajor" width="100%" height="100%" fill="url(#artboard-dot-grid-major)" />
        </svg>
        <DesignNodeView
          v-for="node in roots"
          :key="node.id"
          :node="node"
          :interactive="true"
        />
        <SelectionOverlay
          :width="size.width"
          :height="size.height"
          :zoom="editor.zoom"
          :boxes="boxes"
          :hover="hover"
          :handles="resizeHandles"
          @resize="(handle, event) => gestures.onHandlePointerDown(event, handle)"
        />
        <svg
          v-if="preview"
          class="tool-preview"
          :viewBox="`0 0 ${size.width} ${size.height}`"
        >
          <rect
            v-if="preview.kind === 'box'"
            :class="{ 'is-marquee': editor.tool === 'select' }"
            :x="preview.x"
            :y="preview.y"
            :width="preview.width"
            :height="preview.height"
          />
          <polyline
            v-else
            :points="preview.points.map(point => `${point.x},${point.y}`).join(' ')"
          />
        </svg>
        <svg
          v-if="snapGuides.length"
          class="snap-guides"
          :viewBox="`0 0 ${size.width} ${size.height}`"
        >
          <line
            v-for="(guide, index) in snapGuides"
            :key="index"
            :x1="guide.axis === 'x' ? guide.at : guide.from"
            :y1="guide.axis === 'x' ? guide.from : guide.at"
            :x2="guide.axis === 'x' ? guide.at : guide.to"
            :y2="guide.axis === 'x' ? guide.to : guide.at"
            :stroke-width="1 / editor.zoom"
            :stroke-dasharray="guide.dashed ? `${4 / editor.zoom} ${3 / editor.zoom}` : undefined"
          />
        </svg>
      </div>
    </div>
    <div v-if="component" class="edit-chip">
      <span>Editing {{ component.name }}</span>
      <button type="button" @click="actions.doneEditing">
        Done
      </button>
    </div>
  </div>
</template>
