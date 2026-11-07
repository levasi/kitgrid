<script setup lang="ts">
import { ChevronDown, ChevronRight, Component as ComponentIcon, Eye, EyeOff, Frame, Group, Lock, LockOpen, Spline, Square, Type } from '@lucide/vue'
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
const folded = computed(() => editor.isLayerFolded(props.node.id))
const icon = computed(() => layerIcons[props.node.type])
const editing = ref(false)
const draft = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
let canceling = false

function toggleFold() {
  editor.toggleLayerFold(props.node.id)
}

function toggleVisible() {
  actions.patchNode(props.node.id, { visible: !props.node.visible })
}

function toggleLock() {
  actions.patchNode(props.node.id, { locked: !props.node.locked })
}

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
      :class="{ selected, 'is-hidden': !node.visible, 'is-locked': node.locked }"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      role="treeitem"
      :aria-selected="selected"
      :aria-expanded="children.length ? !folded : undefined"
      @click="choose"
      @dblclick="startEdit"
      @contextmenu="openMenu"
    >
      <button
        v-if="children.length"
        type="button"
        class="layer-fold"
        :title="folded ? 'Unfold' : 'Fold'"
        :aria-label="folded ? 'Unfold layer' : 'Fold layer'"
        @click.stop="toggleFold"
        @dblclick.stop
      >
        <ChevronRight v-if="folded" :size="14" :stroke-width="1.75" />
        <ChevronDown v-else :size="14" :stroke-width="1.75" />
      </button>
      <span v-else class="layer-fold-spacer" />
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
      <span class="layer-actions">
        <button
          type="button"
          class="layer-action"
          :class="{ 'is-on': !node.visible }"
          :title="node.visible ? 'Hide layer' : 'Show layer'"
          :aria-label="node.visible ? 'Hide layer' : 'Show layer'"
          :aria-pressed="node.visible"
          @click.stop="toggleVisible"
          @dblclick.stop
        >
          <EyeOff v-if="!node.visible" :size="14" :stroke-width="1.75" />
          <Eye v-else :size="14" :stroke-width="1.75" />
        </button>
        <button
          type="button"
          class="layer-action"
          :class="{ 'is-on': node.locked }"
          :title="node.locked ? 'Unlock layer' : 'Lock layer'"
          :aria-label="node.locked ? 'Unlock layer' : 'Lock layer'"
          :aria-pressed="node.locked"
          @click.stop="toggleLock"
          @dblclick.stop
        >
          <Lock v-if="node.locked" :size="14" :stroke-width="1.75" />
          <LockOpen v-else :size="14" :stroke-width="1.75" />
        </button>
      </span>
    </div>
    <ul v-if="children.length && !folded">
      <ObjectTreeItem
        v-for="child in children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
      />
    </ul>
  </li>
</template>
