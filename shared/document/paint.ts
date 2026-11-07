import type { DesignNode, DesignTokens, FrameNode, TextNode } from './types'

export const DEFAULT_FONT_FAMILY = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'

export function resolvedColor(tokens: DesignTokens, raw: string, tokenId: string | null): string {
  if (tokenId) {
    const token = tokens.colors.find(item => item.id === tokenId)
    if (token) return token.value
  }
  return raw || 'transparent'
}

export function resolvedSpacing(tokens: DesignTokens, raw: number, tokenId: string | null): number {
  if (tokenId) {
    const token = tokens.spacing.find(item => item.id === tokenId)
    if (token) return token.value
  }
  return raw
}

export function resolvedTypography(node: TextNode, tokens: DesignTokens): {
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
} {
  if (node.typographyTokenId) {
    const token = tokens.typography.find(item => item.id === node.typographyTokenId)
    if (token) {
      return {
        fontFamily: token.fontFamily,
        fontSize: token.fontSize,
        fontWeight: token.fontWeight,
        lineHeight: token.lineHeight,
      }
    }
  }
  return {
    fontFamily: node.fontFamily,
    fontSize: node.fontSize,
    fontWeight: node.fontWeight,
    lineHeight: node.lineHeight,
  }
}

export function framePadding(node: DesignNode, tokens: DesignTokens): number {
  if (node.type !== 'frame') return 0
  return resolvedSpacing(tokens, node.padding, node.paddingTokenId)
}

export function nodeStyle(node: DesignNode, tokens: DesignTokens): Record<string, string> {
  const style: Record<string, string> = {
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: `${node.width}px`,
    height: `${node.height}px`,
  }

  if (node.type === 'text') {
    const type = resolvedTypography(node, tokens)
    style.display = 'flex'
    style.alignItems = node.verticalAlign === 'middle' ? 'center' : 'flex-start'
    style.justifyContent = node.align === 'center' ? 'center' : node.align === 'right' ? 'flex-end' : 'flex-start'
    style.color = resolvedColor(tokens, node.color, node.colorTokenId)
    style.fontFamily = type.fontFamily
    style.fontSize = `${type.fontSize}px`
    style.fontWeight = String(type.fontWeight)
    style.lineHeight = String(type.lineHeight)
    style.whiteSpace = 'pre-wrap'
    style.overflow = 'hidden'
  }

  if (node.type === 'rectangle' || node.type === 'frame') {
    style.background = resolvedColor(tokens, node.fill, node.fillTokenId)
    style.borderRadius = `${node.radius}px`
    if (node.strokeWidth > 0) {
      style.border = `${node.strokeWidth}px solid ${resolvedColor(tokens, node.stroke, node.strokeTokenId)}`
    }
  }

  if (node.type === 'frame') applyFrameStyle(style, node, tokens)
  if (node.type === 'rectangle') style.overflow = 'hidden'
  if (node.type === 'group' || node.type === 'path') style.overflow = 'visible'

  return style
}

function applyFrameStyle(style: Record<string, string>, node: FrameNode, tokens: DesignTokens) {
  style.padding = `${resolvedSpacing(tokens, node.padding, node.paddingTokenId)}px`
  style.overflow = node.clip ? 'hidden' : 'visible'
  if (node.direction === 'none') return
  style.display = 'flex'
  style.flexDirection = node.direction === 'horizontal' ? 'row' : 'column'
  style.gap = `${resolvedSpacing(tokens, node.gap, node.gapTokenId)}px`
}
