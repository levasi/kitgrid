<script setup lang="ts">
import { computed } from 'vue'
import { resolveInstance } from '#shared/components/resolve'
import { nodeStyle, resolvedColor } from '#shared/document/paint'
import { pathData } from '#shared/document/path'
import { selectableId } from '#shared/document/tree'
import { isContainer, type DesignNode, type PathNode } from '#shared/document/types'
import { useCanvasGestures } from '../../composables/useCanvasGestures'
import { useDocumentStore } from '../../stores/document'
import { useEditorStore } from '../../stores/editor'

const props = defineProps<{
  node: DesignNode
  interactive: boolean
  lockChildren?: boolean
}>()

const documents = useDocumentStore()
const editor = useEditorStore()
const gestures = useCanvasGestures()

const display = computed<DesignNode>(() =>
  props.node.type === 'instance' ? resolveInstance(documents.document, props.node) : props.node,
)
const locked = computed(() => Boolean(props.lockChildren) || props.node.type === 'instance')
const children = computed(() => isContainer(display.value) ? display.value.children : [])
const inlineStyle = computed(() => nodeStyle(display.value, documents.document.tokens))
const pathShape = computed(() => {
  const node = display.value
  if (node.type !== 'path') return null
  const paint = pathPaint(node)
  return {
    ...paint,
    width: node.width,
    height: node.height,
    strokeWidth: node.strokeWidth,
  }
})

function hitId() {
  return selectableId(documents.document, display.value.id, editor.selection)
}

function onPointerDown(event: PointerEvent) {
  if (!props.interactive || props.node.locked) return
  event.stopPropagation()
  gestures.onNodePointerDown(event, display.value.id)
}

function onContextMenu(event: MouseEvent) {
  if (!props.interactive || props.node.locked) return
  event.preventDefault()
  event.stopPropagation()
  editor.openContextMenu(event.clientX, event.clientY, hitId())
}

function onEnter() {
  if (!props.interactive || props.node.locked) return
  editor.hoverId = hitId()
}

function pathPaint(node: PathNode) {
  const tokens = documents.document.tokens
  const fill = node.fill === 'none' && !node.fillTokenId
    ? 'none'
    : resolvedColor(tokens, node.fill === 'none' ? 'transparent' : node.fill, node.fillTokenId)
  return {
    fill,
    stroke: resolvedColor(tokens, node.stroke, node.strokeTokenId),
    d: pathData(node.points, node.closed),
  }
}

function onLeave(event: PointerEvent) {
  const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest('[data-node-id]') : null
  const nextId = next?.getAttribute('data-node-id')
  if (nextId && selectableId(documents.document, nextId, editor.selection) === editor.hoverId) return
  const target = hitId()
  if (editor.hoverId === display.value.id || editor.hoverId === target) editor.hoverId = null
}
</script>

<template>
  <div
    v-if="node.visible"
    class="design-node"
    :class="[`is-${display.type}`, { 'is-inert': !interactive, 'is-locked': node.locked }]"
    :style="inlineStyle"
    :data-node-id="interactive ? display.id : undefined"
    :aria-label="display.name"
    @pointerdown="onPointerDown"
    @contextmenu="onContextMenu"
    @pointerenter="onEnter"
    @pointerleave="onLeave($event)"
  >
    <template v-if="display.type === 'text'">
      {{ display.content }}
    </template>
    <svg
      v-else-if="pathShape"
      class="path-shape"
      :viewBox="`0 0 ${pathShape.width} ${pathShape.height}`"
    >
      <path
        :d="pathShape.d"
        :fill="pathShape.fill"
        :stroke="pathShape.stroke"
        :stroke-width="pathShape.strokeWidth"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <DesignNodeView
      v-for="(child, index) in children"
      :key="`${child.id}-${index}`"
      :node="child"
      :interactive="interactive && !locked"
      :lock-children="locked"
    />
  </div>
</template>
