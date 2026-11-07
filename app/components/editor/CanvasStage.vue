<script setup lang="ts">
import { computed, ref } from 'vue'
import { absoluteBox } from '#shared/document/geometry'
import { provideCanvasGestures } from '../../composables/useCanvasGestures'
import { useDocumentActions } from '../../composables/useDocumentActions'
import { useDocumentStore } from '../../stores/document'
import { useEditorStore } from '../../stores/editor'

const documents = useDocumentStore()
const editor = useEditorStore()
const actions = useDocumentActions()
const artboard = ref<HTMLElement | null>(null)
const gestures = provideCanvasGestures(artboard)

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
  transform: `translate(${editor.panX}px, ${editor.panY}px) scale(${editor.zoom})`,
}))

const boxes = computed(() => editor.selection.flatMap((id) => {
  const box = absoluteBox(documents.document, id)
  return box ? [{ ...box, id }] : []
}))

const preview = gestures.preview

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
    class="viewport"
    :class="{ 'is-space': gestures.spacePressed, 'is-draw': editor.tool !== 'select' }"
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
          :handles="editor.tool === 'select' && editor.selection.length === 1"
          @resize="(handle, event) => gestures.onHandlePointerDown(event, handle)"
        />
        <svg
          v-if="preview"
          class="tool-preview"
          :viewBox="`0 0 ${size.width} ${size.height}`"
        >
          <rect
            v-if="preview.kind === 'box'"
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
