<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { findNode } from '#shared/document/tree'
import { useDocumentActions } from '../../composables/useDocumentActions'
import { useDocumentStore } from '../../stores/document'
import { useEditorStore } from '../../stores/editor'

const documents = useDocumentStore()
const editor = useEditorStore()
const actions = useDocumentActions()
const root = ref<HTMLElement | null>(null)
const left = ref(0)
const top = ref(0)

const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent)
const groupShortcut = mac ? '⌘G' : 'Ctrl+G'
const ungroupShortcut = mac ? '⇧⌘G' : 'Ctrl+Shift+G'

const canGroup = computed(() => editor.selection.length >= 2)
const canUngroup = computed(() => {
  const id = editor.selection.length === 1 ? editor.selection[0] : null
  if (!id) return false
  return findNode(documents.document, id)?.node.type === 'group'
})

function place() {
  const menu = editor.contextMenu
  const element = root.value
  if (!menu || !element) return
  const box = element.getBoundingClientRect()
  left.value = Math.max(8, Math.min(menu.x, window.innerWidth - box.width - 8))
  top.value = Math.max(8, Math.min(menu.y, window.innerHeight - box.height - 8))
}

function onPointerDown(event: PointerEvent) {
  const target = event.target
  if (target instanceof Node && root.value?.contains(target)) return
  editor.closeContextMenu()
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') editor.closeContextMenu()
}

function run(action: () => void) {
  action()
  editor.closeContextMenu()
}

watch(() => editor.contextMenu, async (menu) => {
  if (!menu) return
  left.value = menu.x
  top.value = menu.y
  await nextTick()
  place()
})

onMounted(() => {
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', place)
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', place)
})
</script>

<template>
  <div
    v-if="editor.contextMenu"
    ref="root"
    class="context-menu"
    role="menu"
    :style="{ left: `${left}px`, top: `${top}px` }"
    @contextmenu.prevent
  >
    <button type="button" role="menuitem" :disabled="!canGroup" @click="run(actions.group)">
      <span>Group</span>
      <kbd>{{ groupShortcut }}</kbd>
    </button>
    <button type="button" role="menuitem" :disabled="!canUngroup" @click="run(actions.ungroup)">
      <span>Ungroup</span>
      <kbd>{{ ungroupShortcut }}</kbd>
    </button>
  </div>
</template>
