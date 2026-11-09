<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { resolveInstance } from '#shared/components/resolve'
import { nodeStyle, resolvedColor } from '#shared/document/paint'
import { pathData } from '#shared/document/path'
import { findNode, selectableId } from '#shared/document/tree'
import { isContainer, type DesignNode, type PathNode } from '#shared/document/types'
import { useCanvasGestures } from '../../composables/useCanvasGestures'
import { useDocumentActions } from '../../composables/useDocumentActions'
import { useDocumentStore } from '../../stores/document'
import { useEditorStore } from '../../stores/editor'

interface InlineTextEdit {
  kind: 'label'
  id: string
  content: string
}

const props = defineProps<{
  node: DesignNode
  interactive: boolean
  lockChildren?: boolean
  inlineEdit?: InlineTextEdit | null
}>()

const documents = useDocumentStore()
const editor = useEditorStore()
const actions = useDocumentActions()
const gestures = useCanvasGestures()
const editorEl = ref<HTMLElement | null>(null)

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

const textEdit = computed(() => {
  if (props.inlineEdit) return props.inlineEdit
  if (!props.interactive || props.node.locked || display.value.type !== 'text') return null
  if (editor.editingTextId !== display.value.id) return null
  const found = findNode(documents.document, display.value.id)
  if (found?.node.type !== 'text') return null
  return { kind: 'node' as const, id: display.value.id, content: display.value.content }
})

function childEdit(child: DesignNode): InlineTextEdit | null {
  const node = props.node
  if (node.type !== 'instance' || editor.editingTextId !== node.id || child.type !== 'text') return null
  const component = documents.document.components.find(item => item.id === node.componentId)
  if (!component || child.id !== component.label.targetNodeId) return null
  return { kind: 'label', id: node.id, content: child.content }
}

function selectEditorText(element: HTMLElement) {
  element.focus()
  const range = document.createRange()
  range.selectNodeContents(element)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

watch(textEdit, async (edit) => {
  if (!edit) return
  await nextTick()
  const element = editorEl.value
  if (!element) return
  element.textContent = edit.content
  selectEditorText(element)
  requestAnimationFrame(() => {
    if (editorEl.value === element && editor.editingTextId === edit.id) selectEditorText(element)
  })
})

function commitFrom(element: HTMLElement) {
  const edit = textEdit.value
  if (!edit) return
  const next = element.textContent ?? ''
  editor.beginTextEdit(null)
  if (next === edit.content) return
  if (edit.kind === 'label') actions.setOverride(edit.id, 'label', next)
  else actions.patchNode(edit.id, { content: next })
}

function onTextKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key !== 'Escape') return
  event.preventDefault()
  commitFrom(event.currentTarget as HTMLElement)
}

function commitText(event: FocusEvent) {
  commitFrom(event.target as HTMLElement)
}

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
    :class="[`is-${display.type}`, { 'is-inert': !interactive, 'is-locked': node.locked, 'is-text-editing': Boolean(textEdit) }]"
    :style="inlineStyle"
    :data-node-id="interactive ? display.id : undefined"
    :aria-label="display.name"
    @pointerdown="onPointerDown"
    @contextmenu="onContextMenu"
    @pointerenter="onEnter"
    @pointerleave="onLeave($event)"
  >
    <div
      v-if="textEdit"
      ref="editorEl"
      class="text-editor"
      contenteditable="plaintext-only"
      role="textbox"
      aria-multiline="true"
      spellcheck="false"
      :style="{ textAlign: display.type === 'text' ? display.align : 'left' }"
      @pointerdown.stop
      @keydown="onTextKeydown"
      @blur="commitText"
    />
    <template v-else-if="display.type === 'text'">
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
      :inline-edit="childEdit(child)"
    />
  </div>
</template>
