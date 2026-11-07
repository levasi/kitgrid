import { z } from 'zod'
import { findDescendant } from '../document/tree'
import {
  PROJECT_FORMAT,
  PROJECT_VERSION,
  isContainer,
  type ComponentDefinition,
  type DesignDocument,
  type DesignNode,
  type ProjectFile,
} from '../document/types'

const idSchema = z.string().min(1)
const tokenRef = z.string().min(1).nullable()
const finite = z.number().finite()
const positive = z.number().finite().positive()

const textNodeSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  type: z.literal('text'),
  x: finite,
  y: finite,
  width: positive,
  height: positive,
  visible: z.boolean(),
  locked: z.boolean(),
  content: z.string(),
  fontFamily: z.string().min(1),
  fontSize: positive,
  fontWeight: finite,
  lineHeight: positive,
  color: z.string(),
  colorTokenId: tokenRef,
  typographyTokenId: tokenRef,
  align: z.enum(['left', 'center', 'right']),
  verticalAlign: z.enum(['top', 'middle']),
})

const rectangleNodeSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  type: z.literal('rectangle'),
  x: finite,
  y: finite,
  width: positive,
  height: positive,
  visible: z.boolean(),
  locked: z.boolean(),
  fill: z.string(),
  fillTokenId: tokenRef,
  stroke: z.string(),
  strokeTokenId: tokenRef,
  strokeWidth: z.number().finite().nonnegative(),
  radius: z.number().finite().nonnegative(),
})

const pathNodeSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  type: z.literal('path'),
  x: finite,
  y: finite,
  width: positive,
  height: positive,
  visible: z.boolean(),
  locked: z.boolean(),
  points: z.array(z.strictObject({ x: finite, y: finite })).min(2),
  closed: z.boolean(),
  fill: z.string(),
  fillTokenId: tokenRef,
  stroke: z.string(),
  strokeTokenId: tokenRef,
  strokeWidth: z.number().finite().nonnegative(),
})

const instanceNodeSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  type: z.literal('instance'),
  x: finite,
  y: finite,
  width: positive,
  height: positive,
  visible: z.boolean(),
  locked: z.boolean(),
  componentId: idSchema,
  overrides: z.strictObject({
    label: z.string().optional(),
    variant: idSchema.optional(),
  }),
})

export const designNodeSchema: z.ZodType<DesignNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    frameNodeSchema(),
    groupNodeSchema(),
    textNodeSchema,
    rectangleNodeSchema,
    pathNodeSchema,
    instanceNodeSchema,
  ]),
)

function frameNodeSchema() {
  return z.strictObject({
    id: idSchema,
    name: z.string(),
    type: z.literal('frame'),
    x: finite,
    y: finite,
    width: positive,
    height: positive,
    visible: z.boolean(),
    locked: z.boolean(),
    children: z.array(designNodeSchema),
    fill: z.string(),
    fillTokenId: tokenRef,
    stroke: z.string(),
    strokeTokenId: tokenRef,
    strokeWidth: z.number().finite().nonnegative(),
    radius: z.number().finite().nonnegative(),
    padding: z.number().finite().nonnegative(),
    paddingTokenId: tokenRef,
    gap: z.number().finite().nonnegative(),
    gapTokenId: tokenRef,
    direction: z.enum(['none', 'horizontal', 'vertical']),
    clip: z.boolean(),
  })
}

function groupNodeSchema() {
  return z.strictObject({
    id: idSchema,
    name: z.string(),
    type: z.literal('group'),
    x: finite,
    y: finite,
    width: positive,
    height: positive,
    visible: z.boolean(),
    locked: z.boolean(),
    children: z.array(designNodeSchema),
  })
}

const variantStyleSchema = z.strictObject({
  fill: z.string(),
  fillTokenId: tokenRef,
  stroke: z.string(),
  strokeTokenId: tokenRef,
  strokeWidth: z.number().finite().nonnegative(),
  radius: z.number().finite().nonnegative(),
  textColor: z.string(),
  textColorTokenId: tokenRef,
})

const documentSchema = z.strictObject({
  name: z.string().min(1),
  tokens: z.strictObject({
    colors: z.array(z.strictObject({
      id: idSchema,
      name: z.string().min(1),
      value: z.string().min(1),
    })),
    spacing: z.array(z.strictObject({
      id: idSchema,
      name: z.string().min(1),
      value: finite,
    })),
    typography: z.array(z.strictObject({
      id: idSchema,
      name: z.string().min(1),
      fontFamily: z.string().min(1),
      fontSize: positive,
      fontWeight: finite,
      lineHeight: positive,
    })),
  }),
  components: z.array(z.strictObject({
    id: idSchema,
    name: z.string().min(1),
    root: frameNodeSchema(),
    label: z.strictObject({
      targetNodeId: idSchema,
      defaultValue: z.string(),
    }),
    variants: z.strictObject({
      defaultVariantId: idSchema,
      options: z.array(z.strictObject({
        id: idSchema,
        name: z.string().min(1),
        style: variantStyleSchema,
      })).min(1),
    }),
  })),
  pages: z.array(z.strictObject({
    id: idSchema,
    name: z.string().min(1),
    width: positive,
    height: positive,
    children: z.array(designNodeSchema),
  })).min(1),
})

const projectSchema = z.strictObject({
  format: z.literal(PROJECT_FORMAT, { error: 'This file is not a Kitgrid project.' }),
  version: z.literal(PROJECT_VERSION, { error: 'This file uses an unsupported Kitgrid project version.' }),
  document: documentSchema,
}).superRefine((file, ctx) => {
  for (const issue of collectIssues(file.document)) {
    ctx.addIssue({
      code: 'custom',
      message: issue.message,
      path: issue.path,
      input: file,
    })
  }
})

interface Issue {
  path: (string | number)[]
  message: string
}

export type ValidateResult =
  | { ok: true, file: ProjectFile }
  | { ok: false, error: string }

export type DesktopOpenResponse =
  | { status: 'canceled' }
  | { status: 'error', error: string }
  | { status: 'ok', filePath: string, document: DesignDocument }

export type DesktopSaveResponse =
  | { status: 'canceled' }
  | { status: 'error', error: string }
  | { status: 'ok', filePath: string }

export function validateProjectFile(input: unknown): ValidateResult {
  let value = input
  if (typeof input === 'string') {
    const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
    try {
      value = JSON.parse(text)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to parse JSON.'
      return { ok: false, error: `Invalid JSON: ${detail}` }
    }
  }
  if (value && typeof value === 'object') ensureLocked(value)
  const parsed = projectSchema.safeParse(value)
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) }
  return { ok: true, file: parsed.data }
}

export function serializeProject(document: DesignDocument): string {
  const validated = validateProjectFile({
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    document,
  })
  if (!validated.ok) throw new Error(validated.error)
  return JSON.stringify(validated.file, null, 2)
}

function ensureLocked(value: object) {
  const document = 'document' in value ? value.document : undefined
  if (!document || typeof document !== 'object') return
  const pages = 'pages' in document && Array.isArray(document.pages) ? document.pages : []
  const components = 'components' in document && Array.isArray(document.components) ? document.components : []
  for (const page of pages) {
    if (!page || typeof page !== 'object' || !('children' in page) || !Array.isArray(page.children)) continue
    page.children.forEach(visitNode)
  }
  for (const component of components) {
    if (!component || typeof component !== 'object' || !('root' in component)) continue
    visitNode(component.root)
  }
}

function visitNode(node: unknown) {
  if (!node || typeof node !== 'object') return
  const record = node as Record<string, unknown>
  if (typeof record.type === 'string' && record.locked === undefined) record.locked = false
  if (!Array.isArray(record.children)) return
  record.children.forEach(visitNode)
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    return `${path}: ${issue.message}`
  }).join('\n')
}

function collectIssues(document: DesignDocument): Issue[] {
  const issues: Issue[] = []
  const ids = new Map<string, string>()
  const remember = (id: string, path: (string | number)[]) => {
    const previous = ids.get(id)
    if (previous) {
      issues.push({ path: [...path, 'id'], message: `Duplicate id "${id}" (also at ${previous}).` })
      return
    }
    ids.set(id, path.join('.'))
  }

  const colors = uniqueTokenIds(document.tokens.colors, 'colors', issues)
  const spacing = uniqueTokenIds(document.tokens.spacing, 'spacing', issues)
  const typography = uniqueTokenIds(document.tokens.typography, 'typography', issues)

  const components = new Map<string, ComponentDefinition>()
  document.components.forEach((component, index) => {
    const path = ['document', 'components', index]
    remember(component.id, path)
    components.set(component.id, component)
  })
  document.components.forEach((component, index) => {
    const path = ['document', 'components', index]
    if (!component.variants.options.some(option => option.id === component.variants.defaultVariantId)) {
      issues.push({
        path: [...path, 'variants', 'defaultVariantId'],
        message: `Component "${component.name}" default variant does not exist.`,
      })
    }
    const variantIds = new Set<string>()
    component.variants.options.forEach((option, optionIndex) => {
      if (variantIds.has(option.id)) {
        issues.push({
          path: [...path, 'variants', 'options', optionIndex, 'id'],
          message: `Duplicate variant id "${option.id}".`,
        })
      }
      variantIds.add(option.id)
      checkColor(colors, option.style.fillTokenId, [...path, 'variants', 'options', optionIndex, 'style', 'fillTokenId'], issues)
      checkColor(colors, option.style.strokeTokenId, [...path, 'variants', 'options', optionIndex, 'style', 'strokeTokenId'], issues)
      checkColor(colors, option.style.textColorTokenId, [...path, 'variants', 'options', optionIndex, 'style', 'textColorTokenId'], issues)
    })
    const target = findDescendant(component.root, component.label.targetNodeId)
    if (!target || target.type !== 'text') {
      issues.push({
        path: [...path, 'label', 'targetNodeId'],
        message: `Component "${component.name}" label does not point at a text object.`,
      })
    }
    checkNode(component.root, [...path, 'root'], colors, spacing, typography, components, remember, issues)
  })

  const pageIds = new Set<string>()
  document.pages.forEach((page, index) => {
    const path = ['document', 'pages', index]
    if (pageIds.has(page.id)) issues.push({ path: [...path, 'id'], message: `Duplicate page id "${page.id}".` })
    pageIds.add(page.id)
    page.children.forEach((child, childIndex) => {
      checkNode(child, [...path, 'children', childIndex], colors, spacing, typography, components, remember, issues)
    })
  })

  return issues
}

function checkNode(
  node: DesignNode,
  path: (string | number)[],
  colors: Set<string>,
  spacing: Set<string>,
  typography: Set<string>,
  components: Map<string, ComponentDefinition>,
  remember: (id: string, path: (string | number)[]) => void,
  issues: Issue[],
) {
  remember(node.id, path)
  if (node.type === 'frame' || node.type === 'rectangle' || node.type === 'path') {
    checkColor(colors, node.fillTokenId, [...path, 'fillTokenId'], issues)
    checkColor(colors, node.strokeTokenId, [...path, 'strokeTokenId'], issues)
  }
  if (node.type === 'frame') {
    checkSpacing(spacing, node.paddingTokenId, [...path, 'paddingTokenId'], issues)
    checkSpacing(spacing, node.gapTokenId, [...path, 'gapTokenId'], issues)
  }
  if (node.type === 'text') {
    checkColor(colors, node.colorTokenId, [...path, 'colorTokenId'], issues)
    if (node.typographyTokenId && !typography.has(node.typographyTokenId)) {
      issues.push({
        path: [...path, 'typographyTokenId'],
        message: `Missing typography token "${node.typographyTokenId}".`,
      })
    }
  }
  if (node.type === 'instance') {
    const component = components.get(node.componentId)
    if (!component) {
      issues.push({ path: [...path, 'componentId'], message: `Missing component "${node.componentId}".` })
    } else if (node.overrides.variant && !component.variants.options.some(option => option.id === node.overrides.variant)) {
      issues.push({
        path: [...path, 'overrides', 'variant'],
        message: `Unknown variant "${node.overrides.variant}".`,
      })
    }
  }
  if (isContainer(node)) {
    node.children.forEach((child, index) => {
      checkNode(child, [...path, 'children', index], colors, spacing, typography, components, remember, issues)
    })
  }
}

function uniqueTokenIds(tokens: { id: string }[], collection: 'colors' | 'spacing' | 'typography', issues: Issue[]) {
  const ids = new Set<string>()
  tokens.forEach((token, index) => {
    if (ids.has(token.id)) {
      issues.push({
        path: ['document', 'tokens', collection, index, 'id'],
        message: `Duplicate ${collection} token id "${token.id}".`,
      })
    }
    ids.add(token.id)
  })
  return ids
}

function checkColor(colors: Set<string>, tokenId: string | null, path: (string | number)[], issues: Issue[]) {
  if (tokenId && !colors.has(tokenId)) {
    issues.push({ path, message: `Missing color token "${tokenId}".` })
  }
}

function checkSpacing(spacing: Set<string>, tokenId: string | null, path: (string | number)[], issues: Issue[]) {
  if (tokenId && !spacing.has(tokenId)) {
    issues.push({ path, message: `Missing spacing token "${tokenId}".` })
  }
}
