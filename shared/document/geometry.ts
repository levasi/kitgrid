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

export function resizedBox(origin: Box, handle: ResizeHandle, dx: number, dy: number, min = 8): Box {
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
