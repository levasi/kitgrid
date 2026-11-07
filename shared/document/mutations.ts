import { createId } from './ids'
import { findDescendant, findNode, topLevelIds, walkNodes } from './tree'
import type {
  ColorToken,
  DesignDocument,
  DesignNode,
  FrameDirection,
  GroupNode,
  Page,
  SpacingToken,
  TextAlign,
  TypographyToken,
  VariantStyle,
  VerticalAlign,
} from './types'
import { isContainer } from './types'

export interface InsertTarget {
  pageId: string | null
  componentId: string | null
  parentId: string | null
}

export interface NodePatch {
  name?: string
  x?: number
  y?: number
  width?: number
  height?: number
  visible?: boolean
  locked?: boolean
  content?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  lineHeight?: number
  color?: string
  colorTokenId?: string | null
  typographyTokenId?: string | null
  align?: TextAlign
  verticalAlign?: VerticalAlign
  fill?: string
  fillTokenId?: string | null
  stroke?: string
  strokeTokenId?: string | null
  strokeWidth?: number
  radius?: number
  padding?: number
  paddingTokenId?: string | null
  gap?: number
  gapTokenId?: string | null
  direction?: FrameDirection
  clip?: boolean
}

const blockedKeys = new Set(['id', 'type', 'children', 'componentId', 'overrides'])

function clone(doc: DesignDocument): DesignDocument {
  return structuredClone(doc)
}

function syncComponentLabels(doc: DesignDocument) {
  for (const component of doc.components) {
    const text = findDescendant(component.root, component.label.targetNodeId)
    if (text?.type === 'text') component.label.defaultValue = text.content
  }
}

function relinkOverrides(doc: DesignDocument) {
  const components = new Map(doc.components.map(component => [component.id, component]))
  walkNodes(doc, (node) => {
    if (node.type !== 'instance') return
    const component = components.get(node.componentId)
    if (!component) return
    if (node.overrides.label === component.label.defaultValue) delete node.overrides.label
    if (node.overrides.variant === component.variants.defaultVariantId) delete node.overrides.variant
  })
}

function finish(doc: DesignDocument): DesignDocument {
  syncComponentLabels(doc)
  relinkOverrides(doc)
  return doc
}

export function insertNode(doc: DesignDocument, target: InsertTarget, node: DesignNode): DesignDocument {
  const next = clone(doc)
  if (target.componentId) {
    const component = next.components.find(item => item.id === target.componentId)
    if (!component) throw new Error('Component not found.')
    const parentId = target.parentId ?? component.root.id
    if (parentId === component.root.id) {
      component.root.children.push(node)
      return finish(next)
    }
    const parent = findNode(next, parentId)
    if (!parent || parent.scope.kind !== 'component' || parent.scope.componentId !== component.id || !isContainer(parent.node)) {
      throw new Error('Objects can only be inserted into frames and groups.')
    }
    parent.node.children.push(node)
    return finish(next)
  }

  const page = next.pages.find(item => item.id === target.pageId)
  if (!page) throw new Error('Page not found.')
  if (!target.parentId) {
    page.children.push(node)
    return finish(next)
  }
  const parent = findNode(next, target.parentId)
  if (!parent || parent.scope.kind !== 'page' || parent.scope.pageId !== page.id || !isContainer(parent.node)) {
    throw new Error('Objects can only be inserted into frames and groups.')
  }
  parent.node.children.push(node)
  return finish(next)
}

export function updateNode(doc: DesignDocument, id: string, patch: NodePatch): DesignDocument {
  const next = clone(doc)
  const found = findNode(next, id)
  if (!found) throw new Error('Object not found.')
  const record = found.node as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(patch)) {
    if (blockedKeys.has(key) || !(key in record) || value === undefined) continue
    record[key] = value
  }
  if (found.node.width < 1) found.node.width = 1
  if (found.node.height < 1) found.node.height = 1
  if (found.node.type === 'text') {
    if (found.node.fontSize < 1) found.node.fontSize = 1
    if (found.node.lineHeight <= 0) found.node.lineHeight = 1
  }
  if ((found.node.type === 'frame' || found.node.type === 'rectangle' || found.node.type === 'path') && found.node.strokeWidth < 0) {
    found.node.strokeWidth = 0
  }
  return finish(next)
}

export function moveNodes(doc: DesignDocument, ids: string[], dx: number, dy: number): DesignDocument {
  const next = clone(doc)
  if (dx === 0 && dy === 0) return next
  for (const id of topLevelIds(next, ids)) {
    const found = findNode(next, id)
    if (!found) continue
    if (found.node.locked) continue
    found.node.x += dx
    found.node.y += dy
  }
  return next
}

export function translateNodes(
  doc: DesignDocument,
  origins: Map<string, { x: number, y: number }>,
  dx: number,
  dy: number,
): DesignDocument {
  const next = clone(doc)
  for (const [id, origin] of origins) {
    const found = findNode(next, id)
    if (!found || found.node.locked) continue
    found.node.x = origin.x + dx
    found.node.y = origin.y + dy
  }
  return next
}

export function resizeNode(doc: DesignDocument, id: string, box: { x: number, y: number, width: number, height: number }): DesignDocument {
  const next = clone(doc)
  const found = findNode(next, id)
  if (!found) throw new Error('Object not found.')
  if (found.node.locked) return next
  if (found.node.type === 'path' && found.node.width > 0 && found.node.height > 0) {
    const scaleX = box.width / found.node.width
    const scaleY = box.height / found.node.height
    found.node.points = found.node.points.map(point => ({ x: point.x * scaleX, y: point.y * scaleY }))
  }
  found.node.x = box.x
  found.node.y = box.y
  found.node.width = box.width
  found.node.height = box.height
  return next
}

export function groupNodes(doc: DesignDocument, ids: string[]): { document: DesignDocument, groupId: string } {
  if (ids.length < 2) throw new Error('Select at least two objects to group.')
  const next = clone(doc)
  const found = ids.map((id) => {
    const node = findNode(next, id)
    if (!node) throw new Error('One of the selected objects no longer exists.')
    return node
  })
  const siblings = found[0]?.siblings
  if (!siblings || found.some(item => item.siblings !== siblings)) {
    throw new Error('Select objects that share the same parent.')
  }
  if (found.some(item => item.scope.kind === 'component' && item.parent === null)) {
    throw new Error('The component source cannot be grouped.')
  }
  const ordered = [...found].sort((a, b) => a.index - b.index)
  const minX = Math.min(...ordered.map(item => item.node.x))
  const minY = Math.min(...ordered.map(item => item.node.y))
  const maxX = Math.max(...ordered.map(item => item.node.x + item.node.width))
  const maxY = Math.max(...ordered.map(item => item.node.y + item.node.height))
  const children = ordered.map((item) => {
    item.node.x -= minX
    item.node.y -= minY
    return item.node
  })
  const group: GroupNode = {
    id: createId('group'),
    name: 'Group',
    type: 'group',
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    visible: true,
    locked: false,
    children,
  }
  const indexes = ordered.map(item => item.index).sort((a, b) => a - b)
  const first = indexes[0] ?? 0
  for (let index = indexes.length - 1; index >= 0; index -= 1) {
    siblings.splice(indexes[index] ?? 0, 1)
  }
  siblings.splice(first, 0, group)
  return { document: finish(next), groupId: group.id }
}

export function ungroupNode(doc: DesignDocument, id: string): { document: DesignDocument, childIds: string[] } {
  const next = clone(doc)
  const found = findNode(next, id)
  if (!found || found.node.type !== 'group') throw new Error('Select a group to ungroup.')
  if (found.scope.kind === 'component' && found.parent === null) {
    throw new Error('The component source cannot be ungrouped.')
  }
  const group = found.node
  const childIds = group.children.map(child => child.id)
  const lifted = group.children.map(child => ({
    ...child,
    x: child.x + group.x,
    y: child.y + group.y,
  }))
  found.siblings.splice(found.index, 1, ...lifted)
  return { document: finish(next), childIds }
}

export function deleteNodes(doc: DesignDocument, ids: string[]): DesignDocument {
  const next = clone(doc)
  const targets = topLevelIds(next, ids)
    .map((id) => {
      const node = findNode(next, id)
      if (!node) return null
      return node
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.index - a.index)
  for (const item of targets) {
    if (item.scope.kind === 'component' && item.parent === null) {
      throw new Error('The component source cannot be deleted.')
    }
    item.siblings.splice(item.index, 1)
  }
  return finish(next)
}

export function setInstanceOverride(
  doc: DesignDocument,
  id: string,
  key: 'label' | 'variant',
  value: string | null,
): DesignDocument {
  const next = clone(doc)
  const found = findNode(next, id)
  const instance = found?.node
  if (!instance || instance.type !== 'instance') throw new Error('Select a component instance.')
  const component = next.components.find(item => item.id === instance.componentId)
  if (!component) throw new Error('The component for this instance is missing.')
  if (key === 'label') {
    if (value === null || value === component.label.defaultValue) delete instance.overrides.label
    else instance.overrides.label = value
  } else if (value === null || value === component.variants.defaultVariantId) {
    delete instance.overrides.variant
  } else {
    if (!component.variants.options.some(option => option.id === value)) throw new Error('Unknown variant.')
    instance.overrides.variant = value
  }
  return next
}

export function updateComponentName(doc: DesignDocument, componentId: string, name: string): DesignDocument {
  const next = clone(doc)
  const component = next.components.find(item => item.id === componentId)
  if (!component) throw new Error('Component not found.')
  component.name = name.trim() || component.name
  return next
}

export function setDefaultVariant(doc: DesignDocument, componentId: string, variantId: string): DesignDocument {
  const next = clone(doc)
  const component = next.components.find(item => item.id === componentId)
  if (!component) throw new Error('Component not found.')
  if (!component.variants.options.some(option => option.id === variantId)) throw new Error('Unknown variant.')
  component.variants.defaultVariantId = variantId
  return finish(next)
}

export function updateVariant(doc: DesignDocument, componentId: string, variantId: string, patch: Partial<VariantStyle> & { name?: string }): DesignDocument {
  const next = clone(doc)
  const component = next.components.find(item => item.id === componentId)
  if (!component) throw new Error('Component not found.')
  const option = component.variants.options.find(item => item.id === variantId)
  if (!option) throw new Error('Unknown variant.')
  if (patch.name !== undefined) option.name = patch.name.trim() || option.name
  const styleKeys: (keyof VariantStyle)[] = [
    'fill',
    'fillTokenId',
    'stroke',
    'strokeTokenId',
    'strokeWidth',
    'radius',
    'textColor',
    'textColorTokenId',
  ]
  for (const key of styleKeys) {
    if (patch[key] !== undefined) option.style[key] = patch[key] as never
  }
  return next
}

export function addPage(doc: DesignDocument): { document: DesignDocument, pageId: string } {
  const next = clone(doc)
  const page: Page = {
    id: createId('page'),
    name: `Page ${next.pages.length + 1}`,
    width: 1440,
    height: 900,
    children: [],
  }
  next.pages.push(page)
  return { document: next, pageId: page.id }
}

export function updatePage(doc: DesignDocument, pageId: string, patch: { name?: string, width?: number, height?: number }): DesignDocument {
  const next = clone(doc)
  const page = next.pages.find(item => item.id === pageId)
  if (!page) throw new Error('Page not found.')
  if (patch.name !== undefined) page.name = patch.name.trim() || page.name
  if (patch.width !== undefined) page.width = Math.max(1, patch.width)
  if (patch.height !== undefined) page.height = Math.max(1, patch.height)
  return next
}

export function deletePage(doc: DesignDocument, pageId: string): DesignDocument {
  if (doc.pages.length <= 1) throw new Error('Keep at least one page.')
  const next = clone(doc)
  const index = next.pages.findIndex(page => page.id === pageId)
  if (index < 0) throw new Error('Page not found.')
  next.pages.splice(index, 1)
  return next
}

export function updateDocumentName(doc: DesignDocument, name: string): DesignDocument {
  const next = clone(doc)
  next.name = name.trim() || next.name
  return next
}

export function updateColorToken(doc: DesignDocument, id: string, patch: Partial<Pick<ColorToken, 'name' | 'value'>>): DesignDocument {
  const next = clone(doc)
  const token = next.tokens.colors.find(item => item.id === id)
  if (!token) throw new Error('Color token not found.')
  if (patch.name !== undefined) token.name = patch.name.trim() || token.name
  if (patch.value !== undefined) token.value = patch.value
  return next
}

export function addColorToken(doc: DesignDocument): { document: DesignDocument, tokenId: string } {
  const next = clone(doc)
  const token: ColorToken = { id: createId('color'), name: 'New color', value: '#111827' }
  next.tokens.colors.push(token)
  return { document: next, tokenId: token.id }
}

export function removeColorToken(doc: DesignDocument, id: string): DesignDocument {
  const next = clone(doc)
  next.tokens.colors = next.tokens.colors.filter(token => token.id !== id)
  const clear = (tokenId: string | null) => tokenId === id ? null : tokenId
  walkNodes(next, (node) => {
    if (node.type === 'frame' || node.type === 'rectangle' || node.type === 'path') {
      node.fillTokenId = clear(node.fillTokenId)
      node.strokeTokenId = clear(node.strokeTokenId)
    }
    if (node.type === 'text') node.colorTokenId = clear(node.colorTokenId)
  })
  for (const component of next.components) {
    for (const option of component.variants.options) {
      option.style.fillTokenId = clear(option.style.fillTokenId)
      option.style.strokeTokenId = clear(option.style.strokeTokenId)
      option.style.textColorTokenId = clear(option.style.textColorTokenId)
    }
  }
  return next
}

export function updateSpacingToken(doc: DesignDocument, id: string, patch: Partial<Pick<SpacingToken, 'name' | 'value'>>): DesignDocument {
  const next = clone(doc)
  const token = next.tokens.spacing.find(item => item.id === id)
  if (!token) throw new Error('Spacing token not found.')
  if (patch.name !== undefined) token.name = patch.name.trim() || token.name
  if (patch.value !== undefined) token.value = patch.value
  return next
}

export function addSpacingToken(doc: DesignDocument): { document: DesignDocument, tokenId: string } {
  const next = clone(doc)
  const token: SpacingToken = { id: createId('space'), name: 'New space', value: 8 }
  next.tokens.spacing.push(token)
  return { document: next, tokenId: token.id }
}

export function removeSpacingToken(doc: DesignDocument, id: string): DesignDocument {
  const next = clone(doc)
  next.tokens.spacing = next.tokens.spacing.filter(token => token.id !== id)
  walkNodes(next, (node) => {
    if (node.type !== 'frame') return
    if (node.paddingTokenId === id) node.paddingTokenId = null
    if (node.gapTokenId === id) node.gapTokenId = null
  })
  return next
}

export function updateTypographyToken(doc: DesignDocument, id: string, patch: Partial<Omit<TypographyToken, 'id'>>): DesignDocument {
  const next = clone(doc)
  const token = next.tokens.typography.find(item => item.id === id)
  if (!token) throw new Error('Typography token not found.')
  if (patch.name !== undefined) token.name = patch.name.trim() || token.name
  if (patch.fontFamily !== undefined) token.fontFamily = patch.fontFamily
  if (patch.fontSize !== undefined) token.fontSize = patch.fontSize
  if (patch.fontWeight !== undefined) token.fontWeight = patch.fontWeight
  if (patch.lineHeight !== undefined) token.lineHeight = patch.lineHeight
  return next
}

export function addTypographyToken(doc: DesignDocument): { document: DesignDocument, tokenId: string } {
  const next = clone(doc)
  const token: TypographyToken = {
    id: createId('type'),
    name: 'New type',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
  }
  next.tokens.typography.push(token)
  return { document: next, tokenId: token.id }
}

export function removeTypographyToken(doc: DesignDocument, id: string): DesignDocument {
  const next = clone(doc)
  next.tokens.typography = next.tokens.typography.filter(token => token.id !== id)
  walkNodes(next, (node) => {
    if (node.type === 'text' && node.typographyTokenId === id) node.typographyTokenId = null
  })
  return next
}
