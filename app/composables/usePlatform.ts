import { validateProjectFile } from '#shared/project/file'
import type { DesignDocument } from '#shared/document/types'

export type OpenResult =
  | { status: 'canceled' }
  | { status: 'needs-input' }
  | { status: 'error', error: string }
  | { status: 'ok', document: DesignDocument, filePath: string }

export type SaveResult =
  | { status: 'canceled' }
  | { status: 'error', error: string }
  | { status: 'ok', filePath: string }

interface ProjectFileHandle {
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<{ write: (data: string) => Promise<void>, close: () => Promise<void> }>
}

interface OpenPicker {
  (options?: {
    multiple?: boolean
    types?: Array<{ description?: string, accept: Record<string, string[]> }>
  }): Promise<ProjectFileHandle[]>
}

interface SavePicker {
  (options?: {
    suggestedName?: string
    types?: Array<{ description?: string, accept: Record<string, string[]> }>
  }): Promise<ProjectFileHandle>
}

let webHandle: ProjectFileHandle | null = null

const projectPickerTypes = [{
  description: 'Kitgrid project',
  accept: { 'application/json': ['.json'] },
}]

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && window.kitgrid !== undefined
}

export function clearWebHandle() {
  webHandle = null
}

export async function openProjectFile(): Promise<OpenResult> {
  if (isDesktop() && window.kitgrid) {
    const result = await window.kitgrid.openProject()
    if (result.status === 'canceled') return { status: 'canceled' }
    if (result.status === 'error') return { status: 'error', error: result.error }
    webHandle = null
    return { status: 'ok', document: result.document, filePath: result.filePath }
  }

  const picker = (window as Window & { showOpenFilePicker?: OpenPicker }).showOpenFilePicker
  if (!picker) return { status: 'needs-input' }
  try {
    const [handle] = await picker({ multiple: false, types: projectPickerTypes })
    if (!handle) return { status: 'canceled' }
    const file = await handle.getFile()
    const validated = validateProjectFile(await file.text())
    if (!validated.ok) return { status: 'error', error: validated.error }
    webHandle = handle
    return { status: 'ok', document: validated.file.document, filePath: file.name }
  } catch (error) {
    if (isAbort(error)) return { status: 'canceled' }
    throw error
  }
}

export async function readChosenFile(file: File): Promise<OpenResult> {
  const validated = validateProjectFile(await file.text())
  if (!validated.ok) return { status: 'error', error: validated.error }
  webHandle = null
  return { status: 'ok', document: validated.file.document, filePath: file.name }
}

export async function saveProjectContents(contents: string, saveAs: boolean): Promise<SaveResult> {
  const validated = validateProjectFile(contents)
  if (!validated.ok) return { status: 'error', error: validated.error }
  const pretty = JSON.stringify(validated.file, null, 2)

  if (isDesktop() && window.kitgrid) {
    const result = saveAs
      ? await window.kitgrid.saveProjectAs(pretty)
      : await window.kitgrid.saveProject(pretty)
    if (result.status === 'canceled') return { status: 'canceled' }
    if (result.status === 'error') return { status: 'error', error: result.error }
    return { status: 'ok', filePath: result.filePath }
  }

  if (!saveAs && webHandle) {
    const writable = await webHandle.createWritable()
    await writable.write(pretty)
    await writable.close()
    return { status: 'ok', filePath: webHandle.name }
  }

  const picker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker
  if (picker) {
    try {
      const handle = await picker({ suggestedName: 'project.kitgrid.json', types: projectPickerTypes })
      const writable = await handle.createWritable()
      await writable.write(pretty)
      await writable.close()
      webHandle = handle
      return { status: 'ok', filePath: handle.name }
    } catch (error) {
      if (isAbort(error)) return { status: 'canceled' }
      throw error
    }
  }

  downloadProject(pretty, 'project.kitgrid.json')
  return { status: 'ok', filePath: 'project.kitgrid.json' }
}

function downloadProject(contents: string, filename: string) {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}
