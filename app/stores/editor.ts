import { defineStore } from 'pinia'
import { ref } from 'vue'
import { STARTER_PAGE_ID } from '#shared/document/factory'
import type { GridSize, GridStyle, SnapKind } from '#shared/document/snap'

export type RightTab = 'inspect' | 'tokens'
export type BannerTone = 'error' | 'info'
export type EditorTool = 'select' | 'frame' | 'shape' | 'pen' | 'pencil' | 'text'

export const useEditorStore = defineStore('editor', () => {
  const selection = ref<string[]>([])
  const foldedLayers = ref<string[]>([])
  const hoverId = ref<string | null>(null)
  const zoom = ref(1)
  const panX = ref(48)
  const panY = ref(32)
  const zoomAnchor = ref<{ x: number, y: number } | null>(null)
  let viewportEl: HTMLElement | null = null
  const minZoom = 0.1
  const maxZoom = 8
  const activePageId = ref(STARTER_PAGE_ID)
  const editingComponentId = ref<string | null>(null)
  const rightTab = ref<RightTab>('inspect')
  const exportOpen = ref(false)
  const banner = ref<{ tone: BannerTone, text: string } | null>(null)
  const tool = ref<EditorTool>('select')
  const snap = ref(true)
  const snapKinds = ref<SnapKind[]>(['grid', 'edges', 'centers'])
  const gridVisible = ref(false)
  const gridSize = ref<GridSize>(8)
  const gridStyle = ref<GridStyle>('lines')
  const gridMajor = ref(true)
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
    foldedLayers.value = foldedLayers.value.filter(id => ids.has(id))
    if (hoverId.value && !ids.has(hoverId.value)) hoverId.value = null
  }

  function isLayerFolded(id: string) {
    return foldedLayers.value.includes(id)
  }

  function toggleLayerFold(id: string) {
    foldedLayers.value = foldedLayers.value.includes(id)
      ? foldedLayers.value.filter(item => item !== id)
      : [...foldedLayers.value, id]
  }

  function clearLayerFolds() {
    foldedLayers.value = []
  }

  function bindViewport(element: HTMLElement | null) {
    viewportEl = element
  }

  function setZoom(next: number) {
    const clamped = Math.min(maxZoom, Math.max(minZoom, next))
    if (clamped === zoom.value) return
    const anchor = zoomAnchor.value
    if (anchor && zoom.value > 0) {
      const canvasX = (anchor.x - panX.value) / zoom.value
      const canvasY = (anchor.y - panY.value) / zoom.value
      panX.value = anchor.x - canvasX * clamped
      panY.value = anchor.y - canvasY * clamped
    }
    zoom.value = clamped
  }

  function resetZoom() {
    if (viewportEl) {
      zoomAnchor.value = { x: viewportEl.clientWidth / 2, y: viewportEl.clientHeight / 2 }
    }
    setZoom(1)
  }

  function setBanner(text: string | null, tone: BannerTone = 'error') {
    banner.value = text ? { tone, text } : null
  }

  function setTool(next: EditorTool) {
    tool.value = next
    penPoints.value = []
  }

  function toggleSnapKind(kind: SnapKind) {
    snapKinds.value = snapKinds.value.includes(kind)
      ? snapKinds.value.filter(item => item !== kind)
      : [...snapKinds.value, kind]
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
    foldedLayers,
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
    snap,
    snapKinds,
    gridVisible,
    gridSize,
    gridStyle,
    gridMajor,
    penPoints,
    contextMenu,
    selectOnly,
    toggleSelect,
    clearSelection,
    prune,
    isLayerFolded,
    toggleLayerFold,
    clearLayerFolds,
    bindViewport,
    setZoom,
    resetZoom,
    setBanner,
    setTool,
    toggleSnapKind,
    openContextMenu,
    closeContextMenu,
  }
})
