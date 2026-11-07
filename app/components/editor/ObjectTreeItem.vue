<script setup lang="ts">
import { Component as ComponentIcon, Frame, Group, Spline, Square, Type } from '@lucide/vue'
import { computed, nextTick, ref } from 'vue'
import type { DesignNode, NodeType } from '#shared/document/types'
import { isContainer } from '#shared/document/types'
import { useDocumentActions } from '../../composables/useDocumentActions'
import { useEditorStore } from '../../stores/editor'

const layerIcons: Record<NodeType, typeof Frame> = {
  frame: Frame,
  group: Group,
  text: Type,
  rectangle: Square,
  path: Spline,
  instance: ComponentIcon,
}

const props = defineProps<{
  node: DesignNode
  depth: number
}>()

const editor = useEditorStore()
const actions = useDocumentActions()
const children = computed(() => isContainer(props.node) ? props.node.children : [])
const selected = computed(() => editor.selection.includes(props.node.id))
const icon = computed(() => layerIcons[props.node.type])
const editing = ref(false)
const draft = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
let canceling = false

function openMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  editor.openContextMenu(event.clientX, event.clientY, props.node.id)
}

function choose(event: MouseEvent) {
  if (editing.value) return
  if (event.shiftKey) editor.toggleSelect(props.node.id)
  else editor.selectOnly(props.node.id)
  editor.rightTab = 'inspect'
}

async function startEdit() {
  editor.selectOnly(props.node.id)
  editor.rightTab = 'inspect'
  draft.value = props.node.name
  editing.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function commit() {
  if (!editing.value || canceling) {
    canceling = false
    return
  }
  editing.value = false
  const name = draft.value.trim()
  if (!name || name === props.node.name) return
  actions.patchNode(props.node.id, { name })
}

function cancel() {
  canceling = true
  editing.value = false
  nameInput.value?.blur()
}
</script>

<template>
  <li>
    <div
      class="tree-row"
      :class="{ selected }"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      role="treeitem"
      :aria-selected="selected"
      @click="choose"
      @dblclick="startEdit"
      @contextmenu="openMenu"
    >
      <span class="kind" :title="node.type">
        <component :is="icon" :size="14" :stroke-width="1.75" />
      </span>
      <input
        v-if="editing"
        ref="nameInput"
        v-model="draft"
        class="tree-name-input"
        aria-label="Object name"
        @click.stop
        @keydown.enter.prevent="commit"
        @keydown.escape.prevent="cancel"
        @blur="commit"
      >
      <span v-else class="tree-name">{{ node.name }}</span>
    </div>
    <ul v-if="children.length">
      <ObjectTreeItem
        v-for="child in children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
      />
    </ul>
  </li>
</template>
