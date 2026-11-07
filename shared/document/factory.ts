import { createId } from './ids'
import { DEFAULT_FONT_FAMILY } from './paint'
import type {
  ComponentDefinition,
  DesignDocument,
  FrameNode,
  InstanceNode,
  PathNode,
  PathPoint,
  RectangleNode,
  TextNode,
  VariantStyle,
} from './types'

export const STARTER_PAGE_ID = 'page_home'
export const BUTTON_COMPONENT_ID = 'cmp_button'

const font = DEFAULT_FONT_FAMILY

function variant(id: string, name: string, style: VariantStyle) {
  return { id, name, style }
}

export function createFrame(
  position: { x: number, y: number } = { x: 48, y: 48 },
  size: { width: number, height: number } = { width: 320, height: 200 },
): FrameNode {
  return {
    id: createId('frame'),
    name: 'Frame',
    type: 'frame',
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    visible: true,
    children: [],
    fill: '#ffffff',
    fillTokenId: 'color_paper',
    stroke: '#e4e4e7',
    strokeTokenId: 'color_line',
    strokeWidth: 1,
    radius: 12,
    padding: 0,
    paddingTokenId: null,
    gap: 0,
    gapTokenId: null,
    direction: 'none',
    clip: true,
  }
}

export function createText(
  position: { x: number, y: number } = { x: 48, y: 48 },
  size: { width: number, height: number } = { width: 240, height: 32 },
): TextNode {
  return {
    id: createId('text'),
    name: 'Text',
    type: 'text',
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    visible: true,
    content: 'Text',
    fontFamily: font,
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
    color: '#18181b',
    colorTokenId: 'color_ink',
    typographyTokenId: 'type_body',
    align: 'left',
    verticalAlign: 'top',
  }
}

export function createRectangle(
  position: { x: number, y: number } = { x: 48, y: 48 },
  size: { width: number, height: number } = { width: 120, height: 80 },
): RectangleNode {
  return {
    id: createId('rectangle'),
    name: 'Rectangle',
    type: 'rectangle',
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    visible: true,
    fill: '#2563eb',
    fillTokenId: 'color_brand',
    stroke: '',
    strokeTokenId: null,
    strokeWidth: 0,
    radius: 8,
  }
}

export function createPath(
  points: PathPoint[],
  options: { name: string, closed: boolean, strokeWidth?: number },
): PathNode | null {
  if (points.length < 2) return null
  const strokeWidth = options.strokeWidth ?? 2
  const pad = Math.max(8, strokeWidth)
  const minX = Math.min(...points.map(point => point.x))
  const minY = Math.min(...points.map(point => point.y))
  const maxX = Math.max(...points.map(point => point.x))
  const maxY = Math.max(...points.map(point => point.y))
  const x = minX - pad
  const y = minY - pad
  return {
    id: createId('path'),
    name: options.name,
    type: 'path',
    x,
    y,
    width: Math.max(1, maxX - minX + pad * 2),
    height: Math.max(1, maxY - minY + pad * 2),
    visible: true,
    points: points.map(point => ({ x: point.x - x, y: point.y - y })),
    closed: options.closed,
    stroke: '#18181b',
    strokeTokenId: 'color_ink',
    strokeWidth,
    fill: 'none',
    fillTokenId: null,
  }
}

export function createInstance(
  doc: DesignDocument,
  componentId: string,
  position: { x: number, y: number },
): InstanceNode {
  const component = doc.components.find(item => item.id === componentId)
  if (!component) throw new Error('Component not found.')
  return {
    id: createId('instance'),
    name: component.name,
    type: 'instance',
    x: position.x,
    y: position.y,
    width: component.root.width,
    height: component.root.height,
    visible: true,
    componentId,
    overrides: {},
  }
}

export function createButtonComponent(): ComponentDefinition {
  const primary: VariantStyle = {
    fill: '#2563eb',
    fillTokenId: 'color_brand',
    stroke: '',
    strokeTokenId: null,
    strokeWidth: 0,
    radius: 8,
    textColor: '#ffffff',
    textColorTokenId: 'color_on_brand',
  }
  return {
    id: BUTTON_COMPONENT_ID,
    name: 'Button',
    root: {
      id: 'node_button_root',
      name: 'Button',
      type: 'frame',
      x: 48,
      y: 48,
      width: 148,
      height: 40,
      visible: true,
      children: [
        {
          id: 'node_button_label',
          name: 'Label',
          type: 'text',
          x: 0,
          y: 0,
          width: 148,
          height: 40,
          visible: true,
          content: 'Button',
          fontFamily: font,
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.2,
          color: '#ffffff',
          colorTokenId: 'color_on_brand',
          typographyTokenId: 'type_label',
          align: 'center',
          verticalAlign: 'middle',
        },
      ],
      fill: primary.fill,
      fillTokenId: primary.fillTokenId,
      stroke: primary.stroke,
      strokeTokenId: primary.strokeTokenId,
      strokeWidth: primary.strokeWidth,
      radius: primary.radius,
      padding: 0,
      paddingTokenId: null,
      gap: 0,
      gapTokenId: null,
      direction: 'none',
      clip: true,
    },
    label: {
      targetNodeId: 'node_button_label',
      defaultValue: 'Button',
    },
    variants: {
      defaultVariantId: 'variant_primary',
      options: [
        variant('variant_primary', 'Primary', primary),
        variant('variant_secondary', 'Secondary', {
          fill: '#ffffff',
          fillTokenId: 'color_paper',
          stroke: '#e4e4e7',
          strokeTokenId: 'color_line',
          strokeWidth: 1,
          radius: 8,
          textColor: '#18181b',
          textColorTokenId: 'color_ink',
        }),
        variant('variant_ghost', 'Ghost', {
          fill: 'transparent',
          fillTokenId: null,
          stroke: '',
          strokeTokenId: null,
          strokeWidth: 0,
          radius: 8,
          textColor: '#2563eb',
          textColorTokenId: 'color_brand',
        }),
      ],
    },
  }
}

export function createStarterDocument(): DesignDocument {
  const button = createButtonComponent()
  return {
    name: 'Tessera starter',
    tokens: {
      colors: [
        { id: 'color_ink', name: 'Ink', value: '#18181b' },
        { id: 'color_muted', name: 'Muted', value: '#71717a' },
        { id: 'color_paper', name: 'Paper', value: '#ffffff' },
        { id: 'color_brand', name: 'Brand', value: '#2563eb' },
        { id: 'color_on_brand', name: 'On brand', value: '#ffffff' },
        { id: 'color_line', name: 'Line', value: '#e4e4e7' },
      ],
      spacing: [
        { id: 'space_xs', name: 'XS', value: 4 },
        { id: 'space_sm', name: 'SM', value: 8 },
        { id: 'space_md', name: 'MD', value: 16 },
        { id: 'space_lg', name: 'LG', value: 24 },
      ],
      typography: [
        { id: 'type_heading', name: 'Heading', fontFamily: font, fontSize: 40, fontWeight: 600, lineHeight: 1.15 },
        { id: 'type_body', name: 'Body', fontFamily: font, fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
        { id: 'type_label', name: 'Label', fontFamily: font, fontSize: 14, fontWeight: 600, lineHeight: 1.2 },
      ],
    },
    components: [button],
    pages: [
      {
        id: STARTER_PAGE_ID,
        name: 'Homepage',
        width: 1440,
        height: 900,
        children: [
          {
            id: 'node_hero',
            name: 'Hero',
            type: 'frame',
            x: 96,
            y: 72,
            width: 640,
            height: 300,
            visible: true,
            fill: '#ffffff',
            fillTokenId: 'color_paper',
            stroke: '#e4e4e7',
            strokeTokenId: 'color_line',
            strokeWidth: 1,
            radius: 16,
            padding: 0,
            paddingTokenId: null,
            gap: 0,
            gapTokenId: null,
            direction: 'none',
            clip: true,
            children: [
              {
                id: 'node_hero_title',
                name: 'Heading',
                type: 'text',
                x: 32,
                y: 32,
                width: 576,
                height: 56,
                visible: true,
                content: 'Design, then export',
                fontFamily: font,
                fontSize: 40,
                fontWeight: 600,
                lineHeight: 1.15,
                color: '#18181b',
                colorTokenId: 'color_ink',
                typographyTokenId: 'type_heading',
                align: 'left',
                verticalAlign: 'top',
              },
              {
                id: 'node_hero_body',
                name: 'Body',
                type: 'text',
                x: 32,
                y: 104,
                width: 520,
                height: 72,
                visible: true,
                content: 'Tessera stores a document, then generates React and CSS from that document.',
                fontFamily: font,
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.5,
                color: '#71717a',
                colorTokenId: 'color_muted',
                typographyTokenId: 'type_body',
                align: 'left',
                verticalAlign: 'top',
              },
              {
                id: 'node_hero_cta',
                name: 'Primary button',
                type: 'instance',
                x: 32,
                y: 208,
                width: 148,
                height: 40,
                visible: true,
                componentId: button.id,
                overrides: {},
              },
            ],
          },
          {
            id: 'node_accent',
            name: 'Accent',
            type: 'rectangle',
            x: 96,
            y: 404,
            width: 72,
            height: 8,
            visible: true,
            fill: '#2563eb',
            fillTokenId: 'color_brand',
            stroke: '',
            strokeTokenId: null,
            strokeWidth: 0,
            radius: 999,
          },
          {
            id: 'node_caption',
            name: 'Caption',
            type: 'text',
            x: 184,
            y: 396,
            width: 420,
            height: 24,
            visible: true,
            content: 'Colors, spacing, and type stay in tokens.',
            fontFamily: font,
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.4,
            color: '#71717a',
            colorTokenId: 'color_muted',
            typographyTokenId: null,
            align: 'left',
            verticalAlign: 'middle',
          },
          {
            id: 'node_notes',
            name: 'Notes',
            type: 'frame',
            x: 800,
            y: 72,
            width: 420,
            height: 220,
            visible: true,
            fill: '#ffffff',
            fillTokenId: 'color_paper',
            stroke: '#e4e4e7',
            strokeTokenId: 'color_line',
            strokeWidth: 1,
            radius: 16,
            padding: 0,
            paddingTokenId: null,
            gap: 0,
            gapTokenId: null,
            direction: 'none',
            clip: true,
            children: [
              {
                id: 'node_notes_title',
                name: 'Title',
                type: 'text',
                x: 28,
                y: 28,
                width: 360,
                height: 32,
                visible: true,
                content: 'Two buttons, one source',
                fontFamily: font,
                fontSize: 20,
                fontWeight: 600,
                lineHeight: 1.3,
                color: '#18181b',
                colorTokenId: 'color_ink',
                typographyTokenId: null,
                align: 'left',
                verticalAlign: 'middle',
              },
              {
                id: 'node_notes_body',
                name: 'Note',
                type: 'text',
                x: 28,
                y: 72,
                width: 360,
                height: 48,
                visible: true,
                content: 'The secondary label is an instance override. The primary button stays linked.',
                fontFamily: font,
                fontSize: 14,
                fontWeight: 400,
                lineHeight: 1.45,
                color: '#71717a',
                colorTokenId: 'color_muted',
                typographyTokenId: null,
                align: 'left',
                verticalAlign: 'top',
              },
              {
                id: 'node_notes_cta',
                name: 'Secondary button',
                type: 'instance',
                x: 28,
                y: 144,
                width: 180,
                height: 40,
                visible: true,
                componentId: button.id,
                overrides: {
                  label: 'Save changes',
                  variant: 'variant_secondary',
                },
              },
            ],
          },
        ],
      },
    ],
  }
}
