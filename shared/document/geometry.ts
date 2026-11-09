import { framePadding } from './paint'
import { findNode } from './tree'
import type { Box, DesignDocument } from './types'

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export function absoluteBox(doc: DesignDocument, id: string): Box | null {
  const found = findNode(doc, id)
  if (!found) return null
  let x = found.node.x
  let y = found.node.y
  let parent = found.parent
  while (parent) {
    x += parent.x + framePadding(parent, doc.tokens)
    y += parent.y + framePadding(parent, doc.tokens)
    const next = findNode(doc, parent.id)
    parent = next?.parent ?? null
  }
  return { x, y, width: found.node.width, height: found.node.height }
}

export function resizedBox(origin: Box, handle: ResizeHandle, dx: number, dy: number, min = 8, proportional = false): Box {
  if (proportional && origin.width > 0 && origin.height > 0) return proportionalBox(origin, handle, dx, dy, min)
  let { x, y, width, height } = origin
  const east = handle.includes('e')
  const west = handle.includes('w')
  const south = handle.includes('s')
  const north = handle.includes('n')
  if (east) width = origin.width + dx
  if (south) height = origin.height + dy
  if (west) {
    width = origin.width - dx
    x = origin.x + dx
  }
  if (north) {
    height = origin.height - dy
    y = origin.y + dy
  }
  if (width < min) {
    if (west) x -= min - width
    width = min
  }
  if (height < min) {
    if (north) y -= min - height
    height = min
  }
  return { x, y, width, height }
}

function proportionalBox(origin: Box, handle: ResizeHandle, dx: number, dy: number, min: number): Box {
  const right = origin.x + origin.width
  const bottom = origin.y + origin.height
  const midX = origin.x + origin.width / 2
  const midY = origin.y + origin.height / 2
  const anchored = {
    se: { x: origin.x, y: origin.y, sx: 1, sy: 1 },
    nw: { x: right, y: bottom, sx: -1, sy: -1 },
    ne: { x: origin.x, y: bottom, sx: 1, sy: -1 },
    sw: { x: right, y: origin.y, sx: -1, sy: 1 },
    e: { x: origin.x, y: midY, sx: 1, sy: 0 },
    w: { x: right, y: midY, sx: -1, sy: 0 },
    s: { x: midX, y: origin.y, sx: 0, sy: 1 },
    n: { x: midX, y: bottom, sx: 0, sy: -1 },
  }[handle]
  const vx = anchored.sx * origin.width
  const vy = anchored.sy * origin.height
  const length = vx * vx + vy * vy
  const scale = length === 0 ? 1 : ((vx + dx) * vx + (vy + dy) * vy) / length
  const minScale = Math.max(min / origin.width, min / origin.height)
  const next = Math.max(scale, minScale)
  const width = origin.width * next
  const height = origin.height * next
  return {
    x: anchored.sx === 0 ? anchored.x - width / 2 : anchored.sx > 0 ? anchored.x : anchored.x - width,
    y: anchored.sy === 0 ? anchored.y - height / 2 : anchored.sy > 0 ? anchored.y : anchored.y - height,
    width,
    height,
  }
}
