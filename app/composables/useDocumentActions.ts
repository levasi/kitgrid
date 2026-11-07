import { createFrame, createInstance, createPath, createRectangle, createText } from '#shared/document/factory'
import {
  addColorToken,
  addPage,
  addSpacingToken,
  addTypographyToken,
  deleteNodes,
  deletePage,
  groupNodes,
  insertNode,
  moveNodes,
  removeColorToken,
  removeSpacingToken,
  removeTypographyToken,
  setDefaultVariant,
  setInstanceOverride,
  ungroupNode,
  updateColorToken,
  updateComponentName,
  updateDocumentName,
  updateNode,
  updatePage,
  updateSpacingToken,
  updateTypographyToken,
  updateVariant,
  type InsertTarget,
  type NodePatch,
} from '#shared/document/mutations'
import { findNode } from '#shared/document/tree'
import type { DesignDocument, DesignNode, PathPoint, VariantStyle } from '#shared/document/types'
import { useDocumentStore } from '../stores/document'
import { useEditorStore } from '../stores/editor'

export type InsertKind = 'frame' | 'text' | 'rectangle' | 'button'

export function useDocumentActions() {
  const documents = useDocumentStore()
  const editor = useEditorStore()

  function fail(error: unknown) {
    editor.setBanner(error instanceof Error ? error.message : 'Edit failed.')
  }

  function apply(mutator: (current: DesignDocument) => DesignDocument) {
    try {
      documents.commit(mutator(documents.snapshot()))
      editor.setBanner(null)
      return true
    } catch (error) {
      fail(error)
      return false
    }
  }

  function currentTarget(doc: DesignDocument): InsertTarget {
    if (editor.editingComponentId) {
      const component = doc.components.find(item => item.id === editor.editingComponentId)
      if (!component) throw new Error('Component not found.')
      return {
        pageId: null,
        componentId: component.id,
        parentId: containerParent(doc) ?? component.root.id,
      }
    }
    const page = doc.pages.find(item => item.id === editor.activePageId) ?? doc.pages[0]
    if (!page) throw new Error('No page is open.')
    return { pageId: page.id, componentId: null, parentId: containerParent(doc) }
  }

  function containerParent(doc: DesignDocument): string | null {
    if (editor.selection.length !== 1) return null
    const selectedId = editor.selection[0]
    if (!selectedId) return null
    const found = findNode(doc, selectedId)
    if (!found) return null
    if (found.node.type === 'frame' || found.node.type === 'group') return found.node.id
    return found.parent?.id ?? null
  }

  function insertionPoint(doc: DesignDocument, target: InsertTarget) {
    let count = 0
    if (target.parentId) {
      const parent = findNode(doc, target.parentId)
      if (parent && (parent.node.type === 'frame' || parent.node.type === 'group')) count = parent.node.children.length
    } else if (target.pageId) {
      count = doc.pages.find(page => page.id === target.pageId)?.children.length ?? 0
    }
    const offset = (count % 6) * 24
    return { x: 48 + offset, y: 48 + offset }
  }

  function createInserted(doc: DesignDocument, kind: InsertKind, position: { x: number, y: number }): DesignNode {
    if (kind === 'frame') return createFrame(position)
    if (kind === 'text') return createText(position)
    if (kind === 'rectangle') return createRectangle(position)
    const button = doc.components.find(item => item.name === 'Button') ?? doc.components[0]
    if (!button) throw new Error('This project has no component to place.')
    return createInstance(doc, button.id, position)
  }

  function drawingTarget(doc: DesignDocument): InsertTarget {
    if (editor.editingComponentId) {
      const component = doc.components.find(item => item.id === editor.editingComponentId)
      if (!component) throw new Error('Component not found.')
      return { pageId: null, componentId: component.id, parentId: component.root.id }
    }
    const page = doc.pages.find(item => item.id === editor.activePageId) ?? doc.pages[0]
    if (!page) throw new Error('No page is open.')
    return { pageId: page.id, componentId: null, parentId: null }
  }

  function parentPoint(doc: DesignDocument, point: PathPoint): PathPoint {
    if (!editor.editingComponentId) return point
    const component = doc.components.find(item => item.id === editor.editingComponentId)
    if (!component) return point
    return { x: point.x - component.root.x, y: point.y - component.root.y }
  }

  function placeDrawn(kind: 'frame' | 'shape' | 'text', box: { x: number, y: number, width: number, height: number }) {
    try {
      const base = documents.snapshot()
      const origin = parentPoint(base, box)
      const sized = box.width >= 4 || box.height >= 4
      const size = sized
        ? { width: Math.max(8, box.width), height: Math.max(8, box.height) }
        : kind === 'frame'
          ? { width: 320, height: 200 }
          : kind === 'text'
            ? { width: 240, height: 32 }
            : { width: 120, height: 80 }
      const node = kind === 'frame'
        ? createFrame(origin, size)
        : kind === 'text'
          ? createText(origin, size)
          : createRectangle(origin, size)
      documents.commit(insertNode(base, drawingTarget(base), node))
      editor.selectOnly(node.id)
      editor.rightTab = 'inspect'
      editor.setBanner(null)
    } catch (error) {
      fail(error)
    }
  }

  function placePencil(points: PathPoint[]) {
    placePath(points, { name: 'Pencil', closed: false, strokeWidth: 2.5 })
  }

  function commitPen(closed = false) {
    const points = [...editor.penPoints]
    editor.penPoints = []
    placePath(points, { name: 'Pen', closed, strokeWidth: 2 })
  }

  function placePath(points: PathPoint[], options: { name: string, closed: boolean, strokeWidth: number }) {
    if (points.length < 2) return
    try {
      const base = documents.snapshot()
      const node = createPath(points.map(point => parentPoint(base, point)), options)
      if (!node) return
      documents.commit(insertNode(base, drawingTarget(base), node))
      editor.selectOnly(node.id)
      editor.rightTab = 'inspect'
      editor.setBanner(null)
    } catch (error) {
      fail(error)
    }
  }

  function insert(kind: InsertKind) {
    try {
      const base = documents.snapshot()
      const target = currentTarget(base)
      const node = createInserted(base, kind, insertionPoint(base, target))
      documents.commit(insertNode(base, target, node))
      editor.selectOnly(node.id)
      editor.rightTab = 'inspect'
      editor.setBanner(null)
    } catch (error) {
      fail(error)
    }
  }

  function place(componentId: string) {
    try {
      const pageId = editor.activePageId
      editor.editingComponentId = null
      const base = documents.snapshot()
      const page = base.pages.find(item => item.id === pageId) ?? base.pages[0]
      if (!page) throw new Error('No page is open.')
      const position = { x: 48 + (page.children.length % 6) * 24, y: 48 + (page.children.length % 6) * 24 }
      const node = createInstance(base, componentId, position)
      documents.commit(insertNode(base, { pageId: page.id, componentId: null, parentId: null }, node))
      editor.activePageId = page.id
      editor.selectOnly(node.id)
      editor.rightTab = 'inspect'
      editor.setBanner(null)
    } catch (error) {
      fail(error)
    }
  }

  function editComponent(componentId: string) {
    const component = documents.document.components.find(item => item.id === componentId)
    if (!component) return
    editor.editingComponentId = componentId
    editor.selectOnly(component.root.id)
    editor.rightTab = 'inspect'
    editor.setBanner(null)
  }

  function doneEditing() {
    editor.editingComponentId = null
    editor.clearSelection()
  }

  function openPage(pageId: string) {
    editor.editingComponentId = null
    editor.activePageId = pageId
    editor.clearSelection()
  }

  function group() {
    try {
      const result = groupNodes(documents.snapshot(), [...editor.selection])
      documents.commit(result.document)
      editor.selectOnly(result.groupId)
      editor.setBanner(null)
    } catch (error) {
      fail(error)
    }
  }

  function ungroup() {
    const id = editor.selection[0]
    if (!id) return
    try {
      const result = ungroupNode(documents.snapshot(), id)
      documents.commit(result.document)
      editor.selection = result.childIds
      editor.setBanner(null)
    } catch (error) {
      fail(error)
    }
  }

  function remove() {
    if (editor.selection.length === 0) return
    const ids = [...editor.selection]
    if (apply(doc => deleteNodes(doc, ids))) editor.clearSelection()
  }

  function nudge(dx: number, dy: number) {
    if (editor.selection.length === 0) return
    const ids = [...editor.selection]
    apply(doc => moveNodes(doc, ids, dx, dy))
  }

  function patchNode(id: string, patch: NodePatch) {
    apply(doc => updateNode(doc, id, patch))
  }

  function setOverride(id: string, key: 'label' | 'variant', value: string | null) {
    apply(doc => setInstanceOverride(doc, id, key, value))
  }

  function renameComponent(componentId: string, name: string) {
    apply(doc => updateComponentName(doc, componentId, name))
  }

  function chooseDefaultVariant(componentId: string, variantId: string) {
    apply(doc => setDefaultVariant(doc, componentId, variantId))
  }

  function patchVariant(componentId: string, variantId: string, patch: Partial<VariantStyle> & { name?: string }) {
    apply(doc => updateVariant(doc, componentId, variantId, patch))
  }

  function createPage() {
    try {
      const result = addPage(documents.snapshot())
      documents.commit(result.document)
      openPage(result.pageId)
    } catch (error) {
      fail(error)
    }
  }

  function renamePage(pageId: string, name: string) {
    apply(doc => updatePage(doc, pageId, { name }))
  }

  function resizePage(pageId: string, patch: { width?: number, height?: number }) {
    apply(doc => updatePage(doc, pageId, patch))
  }

  function removePage(pageId: string) {
    if (!apply(doc => deletePage(doc, pageId))) return
    if (editor.activePageId === pageId) openPage(documents.document.pages[0]?.id ?? '')
  }

  function renameDocument(name: string) {
    apply(doc => updateDocumentName(doc, name))
  }

  function withId(mutator: (doc: DesignDocument) => { document: DesignDocument, tokenId: string }) {
    try {
      const result = mutator(documents.snapshot())
      documents.commit(result.document)
      editor.rightTab = 'tokens'
      editor.setBanner(null)
    } catch (error) {
      fail(error)
    }
  }

  return {
    insert,
    placeDrawn,
    placePencil,
    commitPen,
    place,
    editComponent,
    doneEditing,
    openPage,
    group,
    ungroup,
    remove,
    nudge,
    patchNode,
    setOverride,
    renameComponent,
    chooseDefaultVariant,
    patchVariant,
    createPage,
    renamePage,
    resizePage,
    removePage,
    renameDocument,
    addColor: () => withId(addColorToken),
    addSpacing: () => withId(addSpacingToken),
    addTypography: () => withId(addTypographyToken),
    patchColor: (id: string, patch: { name?: string, value?: string }) => apply(doc => updateColorToken(doc, id, patch)),
    patchSpacing: (id: string, patch: { name?: string, value?: number }) => apply(doc => updateSpacingToken(doc, id, patch)),
    patchTypography: (id: string, patch: { name?: string, fontFamily?: string, fontSize?: number, fontWeight?: number, lineHeight?: number }) => apply(doc => updateTypographyToken(doc, id, patch)),
    deleteColor: (id: string) => apply(doc => removeColorToken(doc, id)),
    deleteSpacing: (id: string) => apply(doc => removeSpacingToken(doc, id)),
    deleteTypography: (id: string) => apply(doc => removeTypographyToken(doc, id)),
  }
}
