export const PROJECT_FORMAT = 'tessera-project'
export const PROJECT_VERSION = 1

export type NodeType = 'frame' | 'group' | 'text' | 'rectangle' | 'path' | 'instance'
export type TextAlign = 'left' | 'center' | 'right'
export type VerticalAlign = 'top' | 'middle'
export type FrameDirection = 'none' | 'horizontal' | 'vertical'

export interface ColorToken {
  id: string
  name: string
  value: string
}

export interface SpacingToken {
  id: string
  name: string
  value: number
}

export interface TypographyToken {
  id: string
  name: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
}

export interface DesignTokens {
  colors: ColorToken[]
  spacing: SpacingToken[]
  typography: TypographyToken[]
}

export interface BaseNode {
  id: string
  name: string
  type: NodeType
  x: number
  y: number
  width: number
  height: number
  visible: boolean
}

export interface FrameNode extends BaseNode {
  type: 'frame'
  children: DesignNode[]
  fill: string
  fillTokenId: string | null
  stroke: string
  strokeTokenId: string | null
  strokeWidth: number
  radius: number
  padding: number
  paddingTokenId: string | null
  gap: number
  gapTokenId: string | null
  direction: FrameDirection
  clip: boolean
}

export interface GroupNode extends BaseNode {
  type: 'group'
  children: DesignNode[]
}

export interface TextNode extends BaseNode {
  type: 'text'
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  color: string
  colorTokenId: string | null
  typographyTokenId: string | null
  align: TextAlign
  verticalAlign: VerticalAlign
}

export interface RectangleNode extends BaseNode {
  type: 'rectangle'
  fill: string
  fillTokenId: string | null
  stroke: string
  strokeTokenId: string | null
  strokeWidth: number
  radius: number
}

export interface PathPoint {
  x: number
  y: number
}

export interface PathNode extends BaseNode {
  type: 'path'
  points: PathPoint[]
  closed: boolean
  fill: string
  fillTokenId: string | null
  stroke: string
  strokeTokenId: string | null
  strokeWidth: number
}

export interface InstanceOverrides {
  label?: string
  variant?: string
}

export interface InstanceNode extends BaseNode {
  type: 'instance'
  componentId: string
  overrides: InstanceOverrides
}

export type DesignNode = FrameNode | GroupNode | TextNode | RectangleNode | PathNode | InstanceNode

export interface VariantStyle {
  fill: string
  fillTokenId: string | null
  stroke: string
  strokeTokenId: string | null
  strokeWidth: number
  radius: number
  textColor: string
  textColorTokenId: string | null
}

export interface ComponentVariant {
  id: string
  name: string
  style: VariantStyle
}

export interface ComponentDefinition {
  id: string
  name: string
  root: FrameNode
  label: {
    targetNodeId: string
    defaultValue: string
  }
  variants: {
    defaultVariantId: string
    options: ComponentVariant[]
  }
}

export interface Page {
  id: string
  name: string
  width: number
  height: number
  children: DesignNode[]
}

export interface DesignDocument {
  name: string
  tokens: DesignTokens
  components: ComponentDefinition[]
  pages: Page[]
}

export interface ProjectFile {
  format: typeof PROJECT_FORMAT
  version: typeof PROJECT_VERSION
  document: DesignDocument
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export function isContainer(node: DesignNode): node is FrameNode | GroupNode {
  return node.type === 'frame' || node.type === 'group'
}
