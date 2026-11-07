<script setup lang="ts">
import { computed } from 'vue'
import { findNode } from '#shared/document/tree'
import { useDocumentActions } from '../../composables/useDocumentActions'
import { useDocumentStore } from '../../stores/document'
import { useEditorStore } from '../../stores/editor'

const emit = defineEmits<{
  open: []
  save: []
  saveAs: []
}>()

const documents = useDocumentStore()
const editor = useEditorStore()
const actions = useDocumentActions()

const canUngroup = computed(() => {
  const id = editor.selection.length === 1 ? editor.selection[0] : null
  if (!id) return false
  return findNode(documents.document, id)?.node.type === 'group'
})

const fileLabel = computed(() => {
  const path = documents.filePath
  if (!path) return documents.document.name
  const parts = path.split(/[/\\]/)
  return parts.at(-1) || documents.document.name
})

const zoomLabel = computed(() => `${Math.round(editor.zoom * 100)}%`)
</script>

<template>
  <header class="document-bar">
    <div class="brand">
      Kitgrid
    </div>
    <div class="file-name" :title="documents.filePath ?? 'Untitled'">
      <span>{{ fileLabel }}</span>
      <span v-if="documents.dirty" class="dirty" aria-label="Unsaved changes" />
    </div>
    <div class="toolbar-group">
      <button type="button" :disabled="!documents.canUndo" title="Undo" @click="documents.undo">
        Undo
      </button>
      <button type="button" :disabled="!documents.canRedo" title="Redo" @click="documents.redo">
        Redo
      </button>
    </div>
    <span class="sep" />
    <div class="toolbar-group">
      <button type="button" :disabled="editor.selection.length < 2" title="Group" @click="actions.group">
        Group
      </button>
      <button type="button" :disabled="!canUngroup" title="Ungroup" @click="actions.ungroup">
        Ungroup
      </button>
    </div>
    <span class="sep" />
    <div class="toolbar-group zoom">
      <button type="button" title="Zoom out" @click="editor.setZoom(editor.zoom / 1.1)">
        −
      </button>
      <span class="zoom-label" title="Zoom to 100% (Ctrl+0)">{{ zoomLabel }}</span>
      <button type="button" title="Zoom in" @click="editor.setZoom(editor.zoom * 1.1)">
        +
      </button>
    </div>
    <div class="document-spacer" />
    <div class="toolbar-group">
      <button type="button" @click="emit('open')">
        Open
      </button>
      <button type="button" @click="emit('save')">
        Save
      </button>
      <button type="button" @click="emit('saveAs')">
        Save as
      </button>
      <button type="button" class="primary" @click="editor.exportOpen = true">
        Export
      </button>
    </div>
  </header>
</template>
