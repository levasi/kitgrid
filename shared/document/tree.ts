import type { DesignDocument, DesignNode } from './types'
import { isContainer } from './types'

export interface NodeScopePage {
  kind: 'page'
  pageId: string
}

export interface NodeScopeComponent {
  kind: 'component'
  componentId: string
}

export type FoundScope = NodeScopePage | NodeScopeComponent

export interface FoundNode {
  node: DesignNode
  parent: DesignNode | null
  siblings: DesignNode[]
  index: number
  scope: FoundScope
}

function searchList(
  nodes: DesignNode[],
  id: string,
  parent: DesignNode | null,
  scope: FoundScope,
): FoundNode | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (!node) continue
    if (node.id === id) return { node, parent, siblings: nodes, index, scope }
    if (isContainer(node)) {
      const nested = searchList(node.children, id, node, scope)
      if (nested) return nested
    }
  }
  return null
}

export function findNode(doc: DesignDocument, id: string): FoundNode | null {
  for (const page of doc.pages) {
    const found = searchList(page.children, id, null, { kind: 'page', pageId: page.id })
    if (found) return found
  }
  for (const component of doc.components) {
    const scope: FoundScope = { kind: 'component', componentId: component.id }
    if (component.root.id === id) {
      return { node: component.root, parent: null, siblings: [component.root], index: 0, scope }
    }
    const found = searchList(component.root.children, id, component.root, scope)
    if (found) return found
  }
  return null
}

export function ancestorIds(doc: DesignDocument, id: string): string[] {
  const ids: string[] = []
  let current = findNode(doc, id)
  while (current?.parent) {
    ids.push(current.parent.id)
    current = findNode(doc, current.parent.id)
  }
  return ids
}

export function topLevelIds(doc: DesignDocument, ids: string[]): string[] {
  const selected = new Set(ids)
  return ids.filter(id => !ancestorIds(doc, id).some(ancestor => selected.has(ancestor)))
}

export function walkNodes(doc: DesignDocument, visit: (node: DesignNode) => void): void {
  const walk = (node: DesignNode) => {
    visit(node)
    if (isContainer(node)) node.children.forEach(walk)
  }
  for (const page of doc.pages) page.children.forEach(walk)
  for (const component of doc.components) walk(component.root)
}

export function allNodeIds(doc: DesignDocument): Set<string> {
  const ids = new Set<string>()
  walkNodes(doc, node => ids.add(node.id))
  return ids
}

export function findDescendant(node: DesignNode, id: string): DesignNode | null {
  if (node.id === id) return node
  if (!isContainer(node)) return null
  for (const child of node.children) {
    const found = findDescendant(child, id)
    if (found) return found
  }
  return null
}
