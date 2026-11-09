import { inject, onMounted, onUnmounted, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import type { Box, DesignDocument, DesignNode, PathPoint } from '#shared/document/types'
import { absoluteBox, resizedBox, type ResizeHandle } from '#shared/document/geometry'
import { resizeNode, translateNodes } from '#shared/document/mutations'
import { otherLayerBoxes, snapBox, snapPointer, snapTranslation, type SnapGuide, type SnapOptions } from '#shared/document/snap'
import { findNode, selectableId, topLevelIds } from '#shared/document/tree'
import { isContainer } from '#shared/document/types'
import { useDocumentActions } from './useDocumentActions'
import { useDocumentStore } from '../stores/document'
import { useEditorStore, type EditorTool } from '../stores/editor'

export interface ToolPreview {
  kind: 'box' | 'stroke'
  x: number
  y: number
  width: number
  height: number
  points: PathPoint[]
}

interface CanvasGestures {
  spacePressed: Ref<boolean>
  preview: Ref<ToolPreview | null>
  snapGuides: Ref<SnapGuide[]>
  onNodePointerDown: (event: PointerEvent, nodeId: string) => void
  onBackgroundPointerDown: (event: PointerEvent) => void
  onHandlePointerDown: (event: PointerEvent, handle: ResizeHandle) => void
  onPointerMove: (event: PointerEvent) => void
  onWheel: (event: WheelEvent) => void
}

const gesturesKey: InjectionKey<CanvasGestures> = Symbol('kitgrid-canvas-gestures')
const doubleClickMs = 500
const doubleClickSlop = 6

type DrawTool = Extract<EditorTool, 'frame' | 'shape' | 'text'>

type Drag =
  | {
    kind: 'move'
    base: DesignDocument
    start: PathPoint
    origins: Map<string, { x: number, y: number }>
    moved: boolean
    editOnRelease: string | null
  }
  | {
    kind: 'resize'
    base: DesignDocument
    id: string
    handle: ResizeHandle
    origin: { x: number, y: number, width: number, height: number }
    start: PathPoint
    moved: boolean
  }
  | {
    kind: 'pan'
    startClientX: number
    startClientY: number
    originX: number
    originY: number
    moved: boolean
  }
  | {
    kind: 'draw'
    tool: DrawTool
    start: PathPoint
    current: PathPoint
    moved: boolean
  }
  | {
    kind: 'pencil'
    points: PathPoint[]
    moved: boolean
  }
  | {
    kind: 'marquee'
    start: PathPoint
    current: PathPoint
    baseSelection: string[]
    additive: boolean
    moved: boolean
  }

export function provideCanvasGestures(artboard: Ref<HTMLElement | null>) {
  const documents = useDocumentStore()
  const editor = useEditorStore()
  const actions = useDocumentActions()
  const spacePressed = ref(false)
  const preview = ref<ToolPreview | null>(null)
  const snapGuides = ref<SnapGuide[]>([])
  let drag: Drag | null = null
  let lastSelectDown: { time: number, x: number, y: number } | null = null
  let recentMoveAt = 0

  watch(() => editor.tool, () => {
    preview.value = null
    snapGuides.value = []
  })
  watch(() => editor.penPoints.length, (count) => {
    if (count === 0 && !drag) {
      preview.value = null
      snapGuides.value = []
    }
  })

  function point(event: PointerEvent): PathPoint {
    const element = artboard.value
    if (!element) return { x: 0, y: 0 }
    const rect = element.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) / editor.zoom,
      y: (event.clientY - rect.top) / editor.zoom,
    }
  }

  function mergeSelection(base: string[], extra: string[]) {
    const seen = new Set(base)
    const next = [...base]
    for (const id of extra) {
      if (seen.has(id)) continue
      seen.add(id)
      next.push(id)
    }
    return next
  }

  function overlaps(marquee: Box, box: Box) {
    return box.x < marquee.x + marquee.width
      && box.x + box.width > marquee.x
      && box.y < marquee.y + marquee.height
      && box.y + box.height > marquee.y
  }

  function boxFrom(start: PathPoint, current: PathPoint) {
    return {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    }
  }

  function showBox(start: PathPoint, current: PathPoint) {
    const box = boxFrom(start, current)
    preview.value = { kind: 'box', ...box, points: [] }
  }

  function showStroke(points: PathPoint[]) {
    preview.value = { kind: 'stroke', x: 0, y: 0, width: 0, height: 0, points }
  }

  function bind() {
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function onMove(event: PointerEvent) {
    if (!drag) return
    if (drag.kind === 'pan') {
      editor.panX = drag.originX + (event.clientX - drag.startClientX)
      editor.panY = drag.originY + (event.clientY - drag.startClientY)
      drag.moved = true
      return
    }
    const current = point(event)
    if (drag.kind === 'draw') {
      const dx = current.x - drag.start.x
      const dy = current.y - drag.start.y
      if (!drag.moved && Math.hypot(dx, dy) < 2) return
      drag.moved = true
      const snapped = snapPointer(current, layerTargets([]), snapSettings())
      drag.current = { x: snapped.x, y: snapped.y }
      snapGuides.value = snapped.guides
      showBox(drag.start, drag.current)
      return
    }
    if (drag.kind === 'pencil') {
      const last = drag.points.at(-1)
      if (last && Math.hypot(current.x - last.x, current.y - last.y) < 2) return
      drag.moved = true
      drag.points.push(current)
      showStroke(drag.points)
      return
    }
    if (drag.kind === 'marquee') {
      const dx = current.x - drag.start.x
      const dy = current.y - drag.start.y
      if (!drag.moved && Math.hypot(dx, dy) < 4 / editor.zoom) return
      drag.moved = true
      drag.current = current
      showBox(drag.start, current)
      const hits = layersInMarquee(boxFrom(drag.start, current))
      editor.selection = mergeSelection(drag.baseSelection, hits)
      return
    }
    const dx = current.x - drag.start.x
    const dy = current.y - drag.start.y
    if (!drag.moved && Math.hypot(dx, dy) < 2) return
    drag.moved = true
    if (drag.kind === 'move') {
      const boxes: Box[] = []
      for (const id of drag.origins.keys()) {
        const box = absoluteBox(drag.base, id)
        if (box) boxes.push(box)
      }
      const snapped = snapTranslation(boxes, layerTargets([...drag.origins.keys()], drag.base), dx, dy, snapSettings())
      snapGuides.value = snapped.guides
      documents.preview(translateNodes(drag.base, drag.origins, snapped.dx, snapped.dy))
      return
    }
    const local = resizedBox(drag.origin, drag.handle, dx, dy, 8, event.shiftKey)
    if (event.shiftKey) {
      snapGuides.value = []
      documents.preview(resizeNode(drag.base, drag.id, local))
      return
    }
    const snapped = snappedResize(drag, local)
    snapGuides.value = snapped.guides
    documents.preview(resizeNode(drag.base, drag.id, snapped.box))
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    const finished = drag
    drag = null
    preview.value = null
    snapGuides.value = []
    if (!finished) return
    if (finished.kind === 'draw') {
      actions.placeDrawn(finished.tool, finished.moved ? boxFrom(finished.start, finished.current) : { ...finished.start, width: 0, height: 0 })
      return
    }
    if (finished.kind === 'pencil') {
      actions.placePencil(finished.points)
      return
    }
    if (finished.kind === 'marquee') {
      if (!finished.moved && !finished.additive) editor.clearSelection()
      return
    }
    if (finished.kind !== 'pan' && finished.moved) {
      documents.commitSnapshot(finished.base)
      if (finished.kind === 'move') recentMoveAt = performance.now()
      return
    }
    if (finished.kind === 'move') {
      recentMoveAt = 0
      if (finished.editOnRelease) editor.beginTextEdit(finished.editOnRelease)
    }
  }

  // Click count is not reliable on these pointer events, so two presses in the same spot count.
  function wantsDrill(event: PointerEvent) {
    const now = event.timeStamp
    const previous = lastSelectDown
    if (event.shiftKey) {
      lastSelectDown = null
      return false
    }
    lastSelectDown = { time: now, x: event.clientX, y: event.clientY }
    if (!previous) return event.detail >= 2
    const repeated = now - previous.time <= doubleClickMs
      && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= doubleClickSlop
    return event.detail >= 2 || repeated
  }

  function cancelOpenMove() {
    if (drag?.kind !== 'move') return
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    if (drag.moved) documents.preview(drag.base)
    drag = null
    preview.value = null
    snapGuides.value = []
  }

  function revertRecentMove() {
    if (!recentMoveAt || performance.now() - recentMoveAt > doubleClickMs) return
    recentMoveAt = 0
    documents.undo()
  }

  function startPan(event: PointerEvent) {
    drag = {
      kind: 'pan',
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: editor.panX,
      originY: editor.panY,
      moved: false,
    }
    bind()
  }

  function snapSettings(): SnapOptions {
    return {
      enabled: editor.snap,
      kinds: new Set(editor.snapKinds),
      threshold: 6 / editor.zoom,
      gridSize: editor.gridSize,
    }
  }

  function layerTargets(exclude: string[], doc: DesignDocument = documents.snapshot()) {
    return otherLayerBoxes(doc, scopeRoots(doc), new Set(exclude))
  }

  function snappedResize(drag: Extract<Drag, { kind: 'resize' }>, local: Box): { box: Box, guides: SnapGuide[] } {
    const abs = absoluteBox(drag.base, drag.id)
    if (!abs) return { box: local, guides: [] }
    const originX = abs.x - drag.origin.x
    const originY = abs.y - drag.origin.y
    const snapped = snapBox(
      { x: originX + local.x, y: originY + local.y, width: local.width, height: local.height },
      drag.handle.includes('e') ? 'right' : drag.handle.includes('w') ? 'left' : null,
      drag.handle.includes('s') ? 'bottom' : drag.handle.includes('n') ? 'top' : null,
      layerTargets([drag.id], drag.base),
      snapSettings(),
    )
    return {
      box: {
        x: snapped.box.x - originX,
        y: snapped.box.y - originY,
        width: snapped.box.width,
        height: snapped.box.height,
      },
      guides: snapped.guides,
    }
  }

  function startTool(event: PointerEvent) {
    const raw = point(event)
    const snapped = editor.tool === 'pencil' ? null : snapPointer(raw, layerTargets([]), snapSettings())
    const origin = snapped ? { x: snapped.x, y: snapped.y } : raw
    if (editor.tool === 'pen') {
      if (event.detail >= 2) {
        actions.commitPen(false)
        return
      }
      const points = editor.penPoints
      const first = points[0]
      if (first && points.length >= 3 && Math.hypot(raw.x - first.x, raw.y - first.y) <= 8 / editor.zoom) {
        actions.commitPen(true)
        return
      }
      editor.penPoints = [...points, origin]
      showStroke(editor.penPoints)
      return
    }
    if (editor.tool === 'pencil') {
      drag = { kind: 'pencil', points: [origin], moved: false }
      showStroke([origin])
      bind()
      return
    }
    if (editor.tool === 'frame' || editor.tool === 'shape' || editor.tool === 'text') {
      drag = { kind: 'draw', tool: editor.tool, start: origin, current: origin, moved: false }
      showBox(origin, origin)
      bind()
    }
  }

  function finishTextEdit() {
    const active = document.querySelector('.text-editor')
    if (!(active instanceof HTMLElement)) return
    const id = editor.editingTextId
    const next = active.textContent ?? ''
    active.blur()
    if (!id || editor.editingTextId !== id) return
    const found = findNode(documents.snapshot(), id)
    editor.beginTextEdit(null)
    if (!found) return
    if (found.node.type === 'text') {
      if (next !== found.node.content) actions.patchNode(id, { content: next })
      return
    }
    if (found.node.type !== 'instance') return
    const component = documents.document.components.find(item => item.id === found.node.componentId)
    const current = found.node.overrides.label ?? component?.label.defaultValue ?? ''
    if (component && next !== current) actions.setOverride(id, 'label', next)
  }

  function canEditDirectly(node: DesignNode | undefined, doc: DesignDocument) {
    if (!node || node.locked) return false
    if (node.type === 'text') return true
    if (node.type !== 'instance') return false
    const component = doc.components.find(item => item.id === node.componentId)
    return Boolean(component?.label.targetNodeId)
  }

  function onNodePointerDown(event: PointerEvent, nodeId: string) {
    if (!event.isPrimary || (event.button !== 0 && event.button !== 1)) return
    if (spacePressed.value || event.button === 1) {
      lastSelectDown = null
      event.preventDefault()
      startPan(event)
      return
    }
    if (editor.tool !== 'select') {
      lastSelectDown = null
      event.preventDefault()
      finishTextEdit()
      startTool(event)
      return
    }
    finishTextEdit()
    const drill = wantsDrill(event)
    let base = documents.snapshot()
    const targetId = selectableId(base, nodeId, editor.selection, drill)
    const target = findNode(base, targetId)
    if (target?.node.locked) return
    if (event.shiftKey) {
      editor.toggleSelect(targetId)
      return
    }
    const editable = canEditDirectly(target?.node, base)
    if (drill && editable) {
      cancelOpenMove()
      revertRecentMove()
      editor.selectOnly(targetId)
      editor.beginTextEdit(targetId)
      return
    }
    const editOnRelease = editable && editor.selection.length === 1 && editor.selection[0] === targetId
      ? targetId
      : null
    if (drill) {
      cancelOpenMove()
      revertRecentMove()
      base = documents.snapshot()
    }
    if (!editor.selection.includes(targetId)) editor.selectOnly(targetId)
    const ids = topLevelIds(base, editor.selection.includes(targetId) ? editor.selection : [targetId])
    const origins = new Map<string, { x: number, y: number }>()
    for (const id of ids) {
      const found = findNode(base, id)
      if (found) origins.set(id, { x: found.node.x, y: found.node.y })
    }
    drag = { kind: 'move', base, start: point(event), origins, moved: false, editOnRelease }
    bind()
  }

  function onBackgroundPointerDown(event: PointerEvent) {
    if (event.button !== 0 && event.button !== 1) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('[data-node-id], .handle')) return
    if (spacePressed.value || event.button === 1) {
      event.preventDefault()
      startPan(event)
      return
    }
    if (editor.tool !== 'select') {
      event.preventDefault()
      finishTextEdit()
      startTool(event)
      return
    }
    finishTextEdit()
    const origin = point(event)
    drag = {
      kind: 'marquee',
      start: origin,
      current: origin,
      baseSelection: event.shiftKey ? [...editor.selection] : [],
      additive: event.shiftKey,
      moved: false,
    }
    bind()
  }

  function scopeRoots(doc: DesignDocument = documents.document): DesignNode[] {
    if (editor.editingComponentId) {
      const component = doc.components.find(item => item.id === editor.editingComponentId)
      return component ? [component.root] : []
    }
    const page = doc.pages.find(item => item.id === editor.activePageId) ?? doc.pages[0]
    return page?.children ?? []
  }

  function layersInMarquee(marquee: Box): string[] {
    const doc = documents.document
    const hits: string[] = []
    const visit = (node: DesignNode) => {
      if (!node.visible) return
      const box = absoluteBox(doc, node.id)
      if (box && !node.locked && overlaps(marquee, box)) hits.push(node.id)
      if (isContainer(node)) node.children.forEach(visit)
    }
    scopeRoots(doc).forEach(visit)
    const picked = new Set<string>()
    for (const id of hits) {
      const targetId = selectableId(doc, id, editor.selection)
      const target = findNode(doc, targetId)
      if (target && !target.node.locked) picked.add(targetId)
    }
    return [...picked]
  }

  function onHandlePointerDown(event: PointerEvent, handle: ResizeHandle) {
    if (editor.tool !== 'select' || event.button !== 0) return
    event.preventDefault()
    const id = editor.selection[0]
    if (!id) return
    const base = documents.snapshot()
    const found = findNode(base, id)
    if (!found || found.node.locked) return
    drag = {
      kind: 'resize',
      base,
      id,
      handle,
      origin: { x: found.node.x, y: found.node.y, width: found.node.width, height: found.node.height },
      start: point(event),
      moved: false,
    }
    bind()
  }

  function rememberZoomAnchor(event: { clientX: number, clientY: number }) {
    const viewport = artboard.value?.closest('.viewport')
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    editor.zoomAnchor = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function wheelPixels(event: WheelEvent, delta: number) {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * viewportHeight()
    return delta
  }

  function viewportHeight() {
    return artboard.value?.closest('.viewport')?.clientHeight || window.innerHeight
  }

  function onPointerMove(event: PointerEvent) {
    rememberZoomAnchor(event)
    if (drag || editor.tool !== 'pen' || editor.penPoints.length === 0) return
    const snapped = snapPointer(point(event), layerTargets([]), snapSettings())
    snapGuides.value = snapped.guides
    showStroke([...editor.penPoints, { x: snapped.x, y: snapped.y }])
  }

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      rememberZoomAnchor(event)
      const delta = wheelPixels(event, event.deltaY)
      editor.setZoom(editor.zoom * Math.exp(-delta * 0.0045))
      return
    }
    editor.panX -= wheelPixels(event, event.deltaX)
    editor.panY -= wheelPixels(event, event.deltaY)
  }

  function isField(target: EventTarget | null) {
    return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable]'))
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.code !== 'Space' || isField(event.target)) return
    event.preventDefault()
    spacePressed.value = true
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.code === 'Space') spacePressed.value = false
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  })

  const gestures: CanvasGestures = {
    spacePressed,
    preview,
    snapGuides,
    onNodePointerDown,
    onBackgroundPointerDown,
    onHandlePointerDown,
    onPointerMove,
    onWheel,
  }
  provide(gesturesKey, gestures)
  return gestures
}

export function useCanvasGestures() {
  const gestures = inject(gesturesKey, null)
  if (!gestures) throw new Error('Canvas gestures are unavailable.')
  return gestures
}
