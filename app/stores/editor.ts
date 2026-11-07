import { defineStore } from 'pinia'
import { ref } from 'vue'
import { STARTER_PAGE_ID } from '#shared/document/factory'

export type RightTab = 'inspect' | 'tokens'
export type BannerTone = 'error' | 'info'
export type EditorTool = 'select' | 'frame' | 'shape' | 'pen' | 'pencil' | 'text'

export const useEditorStore = defineStore('editor', () => {
  const selection = ref<string[]>([])
  const hoverId = ref<string | null>(null)
  const zoom = ref(1)
  const panX = ref(48)
  const panY = ref(32)
  const zoomAnchor = ref<{ x: number, y: number } | null>(null)
  const activePageId = ref(STARTER_PAGE_ID)
  const editingComponentId = ref<string | null>(null)
  const rightTab = ref<RightTab>('inspect')
  const exportOpen = ref(false)
  const banner = ref<{ tone: BannerTone, text: string } | null>(null)
  const tool = ref<EditorTool>('select')
  const penPoints = ref<Array<{ x: number, y: number }>>([])
  const contextMenu = ref<{ x: number, y: number } | null>(null)

  function selectOnly(id: string) {
    selection.value = [id]
  }

  function toggleSelect(id: string) {
    selection.value = selection.value.includes(id)
      ? selection.value.filter(item => item !== id)
      : [...selection.value, id]
  }

  function clearSelection() {
    selection.value = []
  }

  function prune(ids: Set<string>) {
    selection.value = selection.value.filter(id => ids.has(id))
    if (hoverId.value && !ids.has(hoverId.value)) hoverId.value = null
  }

  function setZoom(next: number) {
    const clamped = Math.min(3, Math.max(0.25, next))
    const anchor = zoomAnchor.value
    if (anchor && zoom.value > 0) {
      const canvasX = (anchor.x - panX.value) / zoom.value
      const canvasY = (anchor.y - panY.value) / zoom.value
      panX.value = anchor.x - canvasX * clamped
      panY.value = anchor.y - canvasY * clamped
    }
    zoom.value = clamped
  }

  function setBanner(text: string | null, tone: BannerTone = 'error') {
    banner.value = text ? { tone, text } : null
  }

  function setTool(next: EditorTool) {
    tool.value = next
    penPoints.value = []
  }

  function openContextMenu(x: number, y: number, nodeId?: string) {
    if (nodeId && !selection.value.includes(nodeId)) selection.value = [nodeId]
    contextMenu.value = { x, y }
  }

  function closeContextMenu() {
    contextMenu.value = null
  }

  return {
    selection,
    hoverId,
    zoom,
    panX,
    panY,
    zoomAnchor,
    activePageId,
    editingComponentId,
    rightTab,
    exportOpen,
    banner,
    tool,
    penPoints,
    contextMenu,
    selectOnly,
    toggleSelect,
    clearSelection,
    prune,
    setZoom,
    setBanner,
    setTool,
    openContextMenu,
    closeContextMenu,
  }
})
