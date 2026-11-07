import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopOpenResponse, DesktopSaveResponse } from '../shared/project/file'

const api = {
  openProject: (): Promise<DesktopOpenResponse> => ipcRenderer.invoke('project:open'),
  saveProject: (contents: string): Promise<DesktopSaveResponse> => {
    if (typeof contents !== 'string') return Promise.reject(new Error('Project contents must be text.'))
    return ipcRenderer.invoke('project:save', contents)
  },
  saveProjectAs: (contents: string): Promise<DesktopSaveResponse> => {
    if (typeof contents !== 'string') return Promise.reject(new Error('Project contents must be text.'))
    return ipcRenderer.invoke('project:save-as', contents)
  },
}

contextBridge.exposeInMainWorld('tessera', api)
