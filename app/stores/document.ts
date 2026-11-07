import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { createStarterDocument } from '#shared/document/factory'
import { allNodeIds } from '#shared/document/tree'
import type { DesignDocument } from '#shared/document/types'
import { useEditorStore } from './editor'

const HISTORY_LIMIT = 50

export const useDocumentStore = defineStore('document', () => {
  const document = ref<DesignDocument>(createStarterDocument())
  const filePath = ref<string | null>(null)
  const past = ref<DesignDocument[]>([])
  const future = ref<DesignDocument[]>([])
  const savedJson = ref(JSON.stringify(document.value))

  const dirty = computed(() => JSON.stringify(document.value) !== savedJson.value)
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function snapshot(): DesignDocument {
    return structuredClone(toRaw(document.value))
  }

  function pruneEditor() {
    const editor = useEditorStore()
    editor.prune(allNodeIds(document.value))
    if (!document.value.pages.some(page => page.id === editor.activePageId)) {
      editor.activePageId = document.value.pages[0]?.id ?? ''
    }
    if (
      editor.editingComponentId
      && !document.value.components.some(component => component.id === editor.editingComponentId)
    ) {
      editor.editingComponentId = null
    }
  }

  function pushPast(base: DesignDocument) {
    past.value.push(base)
    if (past.value.length > HISTORY_LIMIT) past.value.shift()
    future.value = []
  }

  function commit(next: DesignDocument) {
    pushPast(snapshot())
    document.value = next
    pruneEditor()
  }

  function commitSnapshot(base: DesignDocument) {
    pushPast(base)
    pruneEditor()
  }

  function preview(next: DesignDocument) {
    document.value = next
  }

  function undo() {
    const previous = past.value.pop()
    if (!previous) return
    future.value.push(snapshot())
    document.value = previous
    pruneEditor()
  }

  function redo() {
    const next = future.value.pop()
    if (!next) return
    past.value.push(snapshot())
    document.value = next
    pruneEditor()
  }

  function replace(next: DesignDocument, path: string | null) {
    document.value = next
    filePath.value = path
    past.value = []
    future.value = []
    savedJson.value = JSON.stringify(next)
    const editor = useEditorStore()
    editor.activePageId = next.pages[0]?.id ?? ''
    editor.editingComponentId = null
    editor.clearSelection()
    editor.hoverId = null
    editor.setBanner(null)
  }

  function markSaved(path: string | null) {
    if (path) filePath.value = path
    savedJson.value = JSON.stringify(toRaw(document.value))
  }

  return {
    document,
    filePath,
    dirty,
    canUndo,
    canRedo,
    snapshot,
    commit,
    commitSnapshot,
    preview,
    undo,
    redo,
    replace,
    markSaved,
  }
})
