import { absoluteBox } from './geometry'
import { isContainer, type Box, type DesignDocument, type DesignNode } from './types'

export const GRID_SIZES = [4, 8, 16, 32] as const

export type GridSize = typeof GRID_SIZES[number]
export type GridStyle = 'lines' | 'dots'
export type SnapKind = 'grid' | 'edges' | 'centers' | 'pixels'

export interface SnapOptions {
  enabled: boolean
  kinds: ReadonlySet<SnapKind>
  threshold: number
  gridSize: number
}

export interface SnapGuide {
  axis: 'x' | 'y'
  at: number
  from: number
  to: number
  dashed: boolean
}

type HorizontalEdge = 'left' | 'right'
type VerticalEdge = 'top' | 'bottom'
type MarkRole = 'edge' | 'center'

interface Mark {
  value: number
  start: number
  end: number
  role: MarkRole
}

export function otherLayerBoxes(doc: DesignDocument, roots: DesignNode[], exclude: ReadonlySet<string>): Box[] {
  const boxes: Box[] = []
  const visit = (node: DesignNode, skipped: boolean) => {
    if (!node.visible) return
    const skip = skipped || exclude.has(node.id)
    if (!skip) {
      const box = absoluteBox(doc, node.id)
      if (box && box.width > 0 && box.height > 0) boxes.push(box)
    }
    if (isContainer(node)) node.children.forEach(child => visit(child, skip))
  }
  roots.forEach(root => visit(root, false))
  return boxes
}

export function snapTranslation(boxes: Box[], others: Box[], dx: number, dy: number, options: SnapOptions): { dx: number, dy: number, guides: SnapGuide[] } {
  if (!active(options) || boxes.length === 0) return { dx, dy, guides: [] }
  const proposed = boxes.map(box => ({ ...box, x: box.x + dx, y: box.y + dy }))
  const adjustX = axisDelta(movingValues(proposed, options, 'x', null), targetValues(others, options, 'x'), options)
  const adjustY = axisDelta(movingValues(proposed, options, 'y', null), targetValues(others, options, 'y'), options)
  const final = proposed.map(box => ({ ...box, x: box.x + adjustX, y: box.y + adjustY }))
  return {
    dx: dx + adjustX,
    dy: dy + adjustY,
    guides: pairGuides(final, proposed, others, options, null, null),
  }
}

export function snapBox(
  box: Box,
  movingX: HorizontalEdge | null,
  movingY: VerticalEdge | null,
  others: Box[],
  options: SnapOptions,
  min = 8,
): { box: Box, guides: SnapGuide[] } {
  const next = { ...box }
  if (!active(options)) return { box: next, guides: [] }
  let xKept = false
  let yKept = false
  if (movingX) {
    const delta = axisDelta(movingValues([box], options, 'x', movingX), targetValues(others, options, 'x'), options)
    if (movingX === 'right') next.width = box.width + delta
    else {
      next.x = box.x + delta
      next.width = box.width - delta
    }
    if (next.width < min) {
      next.x = box.x
      next.width = box.width
    }
    else xKept = true
  }
  if (movingY) {
    const delta = axisDelta(movingValues([box], options, 'y', movingY), targetValues(others, options, 'y'), options)
    if (movingY === 'bottom') next.height = box.height + delta
    else {
      next.y = box.y + delta
      next.height = box.height - delta
    }
    if (next.height < min) {
      next.y = box.y
      next.height = box.height
    }
    else yKept = true
  }
  return {
    box: next,
    guides: pairGuides([next], [box], others, options, xKept ? movingX : false, yKept ? movingY : false),
  }
}

export function snapPointer(point: { x: number, y: number }, others: Box[], options: SnapOptions): { x: number, y: number, guides: SnapGuide[] } {
  if (!active(options)) return { ...point, guides: [] }
  const dx = axisDelta([point.x], targetValues(others, options, 'x'), options)
  const dy = axisDelta([point.y], targetValues(others, options, 'y'), options)
  const raw = { x: point.x, y: point.y, width: 0, height: 0 }
  const final = { x: point.x + dx, y: point.y + dy, width: 0, height: 0 }
  return { x: final.x, y: final.y, guides: pairGuides([final], [raw], others, options, 'left', 'top') }
}

function active(options: SnapOptions) {
  return options.enabled && options.kinds.size > 0 && options.threshold > 0
}

function axisDelta(anchors: number[], targets: number[], options: SnapOptions): number {
  let best = 0
  let bestDist = options.threshold + 1e-6
  const take = (point: number, target: number) => {
    const dist = Math.abs(target - point)
    if (dist < bestDist) {
      bestDist = dist
      best = target - point
    }
  }
  for (const point of anchors) {
    for (const target of targets) take(point, target)
    if (options.kinds.has('grid') && options.gridSize > 0) {
      take(point, Math.round(point / options.gridSize) * options.gridSize)
    }
  }
  if (options.kinds.has('pixels') && bestDist > options.threshold) {
    for (const point of anchors) take(point, Math.round(point))
  }
  return bestDist <= options.threshold ? best : 0
}

function pairGuides(
  finalBoxes: Box[],
  rawBoxes: Box[],
  others: Box[],
  options: SnapOptions,
  movingX: HorizontalEdge | null | false,
  movingY: VerticalEdge | null | false,
): SnapGuide[] {
  const guides: SnapGuide[] = []
  const xTargets = others.flatMap(box => xMarks(box, null)).filter(mark => targetVisible(mark, options))
  const yTargets = others.flatMap(box => yMarks(box, null)).filter(mark => targetVisible(mark, options))
  finalBoxes.forEach((final, index) => {
    const raw = rawBoxes[index]
    if (!raw) return
    if (movingX !== false) matchAxis(guides, 'x', xMarks(final, movingX).filter(mark => usedMark(mark, options)), xMarks(raw, movingX).filter(mark => usedMark(mark, options)), xTargets, options)
    if (movingY !== false) matchAxis(guides, 'y', yMarks(final, movingY).filter(mark => usedMark(mark, options)), yMarks(raw, movingY).filter(mark => usedMark(mark, options)), yTargets, options)
  })
  return guides
}

function matchAxis(guides: SnapGuide[], axis: 'x' | 'y', finalMarks: Mark[], rawMarks: Mark[], targets: Mark[], options: SnapOptions) {
  finalMarks.forEach((final, index) => {
    const raw = rawMarks[index]
    if (!raw) return
    for (const target of targets) {
      if (!landed(raw.value, final.value, target.value, options.threshold)) continue
      pushGuide(guides, {
        axis,
        at: target.value,
        from: Math.min(final.start, target.start) - 8,
        to: Math.max(final.end, target.end) + 8,
        dashed: final.role === 'center' || target.role === 'center',
      })
    }
    if (options.kinds.has('grid') && options.gridSize > 0) {
      const at = Math.round(raw.value / options.gridSize) * options.gridSize
      if (landed(raw.value, final.value, at, options.threshold)) {
        pushGuide(guides, { axis, at, from: final.start - 24, to: final.end + 24, dashed: false })
      }
    }
    if (options.kinds.has('pixels')) {
      const at = Math.round(raw.value)
      const onGrid = options.kinds.has('grid') && options.gridSize > 0 && Math.abs(at / options.gridSize - Math.round(at / options.gridSize)) < 1e-6
      if (!onGrid && landed(raw.value, final.value, at, options.threshold)) {
        pushGuide(guides, { axis, at, from: final.start - 24, to: final.end + 24, dashed: false })
      }
    }
  })
}

function landed(raw: number, final: number, target: number, threshold: number) {
  return Math.abs(final - target) <= 0.05 && Math.abs(raw - target) <= threshold + 0.05
}

function pushGuide(guides: SnapGuide[], guide: SnapGuide) {
  const found = guides.find(item => item.axis === guide.axis && Math.abs(item.at - guide.at) < 0.5)
  if (!found) {
    guides.push({ ...guide })
    return
  }
  found.from = Math.min(found.from, guide.from)
  found.to = Math.max(found.to, guide.to)
  found.dashed = found.dashed || guide.dashed
}

function usedMark(mark: Mark, options: SnapOptions) {
  return mark.role === 'edge' || options.kinds.has('centers')
}

function movingValues(boxes: Box[], options: SnapOptions, axis: 'x' | 'y', edge: HorizontalEdge | VerticalEdge | null) {
  return boxes.flatMap(box => (axis === 'x' ? xMarks(box, edge as HorizontalEdge | null) : yMarks(box, edge as VerticalEdge | null)))
    .filter(mark => usedMark(mark, options))
    .map(mark => mark.value)
}
function targetVisible(mark: Mark, options: SnapOptions) {
  if (mark.role === 'center') return options.kinds.has('centers')
  return options.kinds.has('edges')
}

function targetValues(boxes: Box[], options: SnapOptions, axis: 'x' | 'y') {
  return boxes.flatMap(box => (axis === 'x' ? xMarks(box, null) : yMarks(box, null)))
    .filter(mark => targetVisible(mark, options))
    .map(mark => mark.value)
}

function xMarks(box: Box, edge: HorizontalEdge | null): Mark[] {
  const cross = { start: box.y, end: box.y + box.height }
  if (edge === 'left') return [{ value: box.x, ...cross, role: 'edge' }]
  if (edge === 'right') return [{ value: box.x + box.width, ...cross, role: 'edge' }]
  return [
    { value: box.x, ...cross, role: 'edge' },
    { value: box.x + box.width / 2, ...cross, role: 'center' },
    { value: box.x + box.width, ...cross, role: 'edge' },
  ]
}

function yMarks(box: Box, edge: VerticalEdge | null): Mark[] {
  const cross = { start: box.x, end: box.x + box.width }
  if (edge === 'top') return [{ value: box.y, ...cross, role: 'edge' }]
  if (edge === 'bottom') return [{ value: box.y + box.height, ...cross, role: 'edge' }]
  return [
    { value: box.y, ...cross, role: 'edge' },
    { value: box.y + box.height / 2, ...cross, role: 'center' },
    { value: box.y + box.height, ...cross, role: 'edge' },
  ]
}
