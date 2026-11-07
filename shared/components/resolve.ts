import { findDescendant } from '../document/tree'
import type { ComponentDefinition, ComponentVariant, DesignDocument, DesignNode, FrameNode, InstanceNode, RectangleNode } from '../document/types'

export function resolveInstance(doc: DesignDocument, instance: InstanceNode): DesignNode {
  const component = doc.components.find(item => item.id === instance.componentId)
  if (!component) return missingComponent(instance)
  const clone = JSON.parse(JSON.stringify(component.root)) as FrameNode
  const variant = pickVariant(component, instance.overrides.variant)
  applyVariant(clone, component, variant)
  const label = instance.overrides.label ?? component.label.defaultValue
  const text = findDescendant(clone, component.label.targetNodeId)
  if (text?.type === 'text') {
    text.content = label
    text.x = 0
    text.y = 0
    text.width = instance.width
    text.height = instance.height
  }
  clone.id = instance.id
  clone.name = instance.name
  clone.x = instance.x
  clone.y = instance.y
  clone.width = instance.width
  clone.height = instance.height
  clone.visible = instance.visible
  clone.locked = instance.locked
  return clone
}

function pickVariant(component: ComponentDefinition, override: string | undefined): ComponentVariant {
  const id = override ?? component.variants.defaultVariantId
  return component.variants.options.find(option => option.id === id)
    ?? component.variants.options[0]
    ?? {
      id: 'missing',
      name: 'Missing',
      style: {
        fill: '#ffffff',
        fillTokenId: null,
        stroke: '#dc2626',
        strokeTokenId: null,
        strokeWidth: 1,
        radius: 8,
        textColor: '#18181b',
        textColorTokenId: null,
      },
    }
}

function applyVariant(root: FrameNode, component: ComponentDefinition, variant: ComponentVariant) {
  root.fill = variant.style.fill
  root.fillTokenId = variant.style.fillTokenId
  root.stroke = variant.style.stroke
  root.strokeTokenId = variant.style.strokeTokenId
  root.strokeWidth = variant.style.strokeWidth
  root.radius = variant.style.radius
  const text = findDescendant(root, component.label.targetNodeId)
  if (text?.type === 'text') {
    text.color = variant.style.textColor
    text.colorTokenId = variant.style.textColorTokenId
  }
}

function missingComponent(instance: InstanceNode): RectangleNode {
  return {
    id: instance.id,
    name: 'Missing component',
    type: 'rectangle',
    x: instance.x,
    y: instance.y,
    width: instance.width,
    height: instance.height,
    visible: instance.visible,
    locked: instance.locked,
    fill: '#fee2e2',
    fillTokenId: null,
    stroke: '#dc2626',
    strokeTokenId: null,
    strokeWidth: 1,
    radius: 4,
  }
}
