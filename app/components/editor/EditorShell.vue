<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { serializeProject } from '#shared/project/file'
import { useDocumentActions } from '../../composables/useDocumentActions'
import { clearWebHandle, openProjectFile, readChosenFile, saveProjectContents } from '../../composables/usePlatform'
import { useDocumentStore } from '../../stores/document'
import { useEditorStore } from '../../stores/editor'

const documents = useDocumentStore()
const editor = useEditorStore()
const actions = useDocumentActions()
const fileInput = ref<HTMLInputElement | null>(null)

function isField(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable]'))
}

async function openProject() {
  try {
    const result = await openProjectFile()
    if (result.status === 'canceled') return
    if (result.status === 'needs-input') {
      fileInput.value?.click()
      return
    }
    if (result.status === 'error') {
      editor.setBanner(result.error)
      return
    }
    documents.replace(result.document, result.filePath)
  } catch (error) {
    editor.setBanner(error instanceof Error ? error.message : 'Could not open the project.')
  }
}

async function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  try {
    const result = await readChosenFile(file)
    if (result.status === 'error') {
      editor.setBanner(result.error)
      return
    }
    if (result.status === 'ok') documents.replace(result.document, result.filePath)
  } catch (error) {
    editor.setBanner(error instanceof Error ? error.message : 'Could not open the project.')
  }
}

async function save(saveAs = false) {
  try {
    const contents = serializeProject(documents.document)
    const result = await saveProjectContents(contents, saveAs)
    if (result.status === 'canceled') return
    if (result.status === 'error') {
      editor.setBanner(result.error)
      return
    }
    documents.markSaved(result.filePath)
    editor.setBanner(`Saved ${result.filePath}`, 'info')
  } catch (error) {
    editor.setBanner(error instanceof Error ? error.message : 'Could not save the project.')
  }
}

function onKeyDown(event: KeyboardEvent) {
  const meta = event.metaKey || event.ctrlKey
  if (meta && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save(event.shiftKey)
    return
  }
  if (meta && (event.code === 'Digit0' || event.code === 'Numpad0')) {
    event.preventDefault()
    editor.resetZoom()
    return
  }
  if (editor.exportOpen && event.key === 'Escape') {
    editor.exportOpen = false
    return
  }
  if (isField(event.target)) return
  if (!meta && !event.altKey) {
    if (event.key === 'Enter' && editor.tool === 'pen') {
      event.preventDefault()
      actions.commitPen(false)
      return
    }
    const key = event.key.toLowerCase()
    if (event.shiftKey && key === 'p') {
      editor.setTool('pencil')
      return
    }
    if (!event.shiftKey && key === 'v') {
      editor.setTool('select')
      return
    }
    if (!event.shiftKey && key === 'f') {
      editor.setTool('frame')
      return
    }
    if (!event.shiftKey && key === 'r') {
      editor.setTool('shape')
      return
    }
    if (!event.shiftKey && key === 'p') {
      editor.setTool('pen')
      return
    }
    if (!event.shiftKey && key === 't') {
      editor.setTool('text')
      return
    }
  }
  if (meta && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) documents.redo()
    else documents.undo()
    return
  }
  if (meta && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    documents.redo()
    return
  }
  if (meta && event.key.toLowerCase() === 'g') {
    event.preventDefault()
    if (event.shiftKey) actions.ungroup()
    else actions.group()
    return
  }
  if (event.key === 'Escape') {
    if (editor.contextMenu) {
      editor.closeContextMenu()
      return
    }
    if (editor.penPoints.length) {
      editor.penPoints = []
      return
    }
    if (editor.tool !== 'select') {
      editor.setTool('select')
      return
    }
    if (editor.editingComponentId) actions.doneEditing()
    else editor.clearSelection()
    return
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault()
    actions.remove()
    return
  }
  const step = event.shiftKey ? 10 : 1
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    actions.nudge(-step, 0)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    actions.nudge(step, 0)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    actions.nudge(0, -step)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    actions.nudge(0, step)
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  clearWebHandle()
})
</script>

<template>
  <div class="editor">
    <DocumentBar @open="openProject" @save="save(false)" @save-as="save(true)" />
    <p v-if="editor.banner" class="banner" :class="editor.banner.tone">
      <span>{{ editor.banner.text }}</span>
      <button type="button" @click="editor.setBanner(null)">
        Dismiss
      </button>
    </p>
    <div class="workspace">
      <LeftPanel />
      <div class="stage">
        <CanvasStage />
        <Toolbar />
      </div>
      <aside class="panel right-panel">
        <div class="tabs">
          <button type="button" :class="{ active: editor.rightTab === 'inspect' }" @click="editor.rightTab = 'inspect'">
            Inspect
          </button>
          <button type="button" :class="{ active: editor.rightTab === 'tokens' }" @click="editor.rightTab = 'tokens'">
            Tokens
          </button>
        </div>
        <InspectorPanel v-if="editor.rightTab === 'inspect'" />
        <TokensPanel v-else />
      </aside>
    </div>
    <ExportDialog />
    <ContextMenu />
    <input
      ref="fileInput"
      class="file-input"
      type="file"
      accept="application/json,.json"
      @change="onFileChange"
    >
  </div>
</template>
