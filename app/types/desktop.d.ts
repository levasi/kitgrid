import type { DesktopOpenResponse, DesktopSaveResponse } from '../../shared/project/file'

export {}

declare global {
  interface Window {
    tessera?: {
      openProject: () => Promise<DesktopOpenResponse>
      saveProject: (contents: string) => Promise<DesktopSaveResponse>
      saveProjectAs: (contents: string) => Promise<DesktopSaveResponse>
    }
  }
}
