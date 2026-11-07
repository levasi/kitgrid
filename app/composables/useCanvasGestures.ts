import { inject, onMounted, onUnmounted, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import type { DesignDocument, PathPoint } from '#shared/document/types'
import { resizedBox, type ResizeHandle } from '#shared/document/geometry'
import { resizeNode, translateNodes } from '#shared/document/mutations'
import { findNode, topLevelIds } from '#shared/document/tree'
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
  onNodePointerDown: (event: PointerEvent, nodeId: string) => void
  onBackgroundPointerDown: (event: PointerEvent) => void
  onHandlePointerDown: (event: PointerEvent, handle: ResizeHandle) => void
  onPointerMove: (event: PointerEvent) => void
  onWheel: (event: WheelEvent) => void
}

const gesturesKey: InjectionKey<CanvasGestures> = Symbol('kitgrid-canvas-gestures')

type DrawTool = Extract<EditorTool, 'frame' | 'shape' | 'text'>

type Drag =
  | {
    kind: 'move'
    base: DesignDocument
    start: PathPoint
    origins: Map<string, { x: number, y: number }>
    moved: boolean
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

export function provideCanvasGestures(artboard: Ref<HTMLElement | null>) {
  const documents = useDocumentStore()
  const editor = useEditorStore()
  const actions = useDocumentActions()
  const spacePressed = ref(false)
  const preview = ref<ToolPreview | null>(null)
  let drag: Drag | null = null

  watch(() => editor.tool, () => {
    preview.value = null
  })
  watch(() => editor.penPoints.length, (count) => {
    if (count === 0 && !drag) preview.value = null
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
      drag.current = current
      showBox(drag.start, current)
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
    const dx = current.x - drag.start.x
    const dy = current.y - drag.start.y
    if (!drag.moved && Math.hypot(dx, dy) < 2) return
    drag.moved = true
    if (drag.kind === 'move') {
      documents.preview(translateNodes(drag.base, drag.origins, dx, dy))
      return
    }
    documents.preview(resizeNode(drag.base, drag.id, resizedBox(drag.origin, drag.handle, dx, dy)))
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    const finished = drag
    drag = null
    preview.value = null
    if (!finished) return
    if (finished.kind === 'draw') {
      actions.placeDrawn(finished.tool, finished.moved ? boxFrom(finished.start, finished.current) : { ...finished.start, width: 0, height: 0 })
      return
    }
    if (finished.kind === 'pencil') {
      actions.placePencil(finished.points)
      return
    }
    if (finished.kind !== 'pan' && finished.moved) documents.commitSnapshot(finished.base)
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

  function startTool(event: PointerEvent) {
    const origin = point(event)
    if (editor.tool === 'pen') {
      if (event.detail >= 2) {
        actions.commitPen(false)
        return
      }
      const points = editor.penPoints
      const first = points[0]
      if (first && points.length >= 3 && Math.hypot(origin.x - first.x, origin.y - first.y) <= 8 / editor.zoom) {
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

  function onNodePointerDown(event: PointerEvent, nodeId: string) {
    if (!event.isPrimary || (event.button !== 0 && event.button !== 1)) return
    if (spacePressed.value || event.button === 1) {
      event.preventDefault()
      startPan(event)
      return
    }
    if (editor.tool !== 'select') {
      event.preventDefault()
      startTool(event)
      return
    }
    const target = findNode(documents.snapshot(), nodeId)
    if (target?.node.locked) return
    if (event.shiftKey) {
      editor.toggleSelect(nodeId)
      return
    }
    if (!editor.selection.includes(nodeId)) editor.selectOnly(nodeId)
    const base = documents.snapshot()
    const ids = topLevelIds(base, editor.selection.includes(nodeId) ? editor.selection : [nodeId])
    const origins = new Map<string, { x: number, y: number }>()
    for (const id of ids) {
      const found = findNode(base, id)
      if (found) origins.set(id, { x: found.node.x, y: found.node.y })
    }
    drag = { kind: 'move', base, start: point(event), origins, moved: false }
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
      startTool(event)
      return
    }
    editor.clearSelection()
    startPan(event)
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
    const viewport = artboard.value?.parentElement?.parentElement
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    editor.zoomAnchor = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function onPointerMove(event: PointerEvent) {
    rememberZoomAnchor(event)
    if (drag || editor.tool !== 'pen' || editor.penPoints.length === 0) return
    showStroke([...editor.penPoints, point(event)])
  }

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      rememberZoomAnchor(event)
      editor.setZoom(editor.zoom * (event.deltaY > 0 ? 0.92 : 1.08))
      return
    }
    editor.panX -= event.deltaX
    editor.panY -= event.deltaY
  }

  function isField(target: EventTarget | null) {
    return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select'))
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
