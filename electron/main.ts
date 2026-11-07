import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { validateProjectFile, type DesktopOpenResponse, type DesktopSaveResponse } from '../shared/project/file'

const MAX_BYTES = 5 * 1024 * 1024
let currentPath: string | null = null

function assertSender(event: IpcMainInvokeEvent) {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error('Unknown sender.')
}

function createWindow() {
  const devUrl = process.env.TESSERA_DEV_URL
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Tessera',
    backgroundColor: '#f4f4f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    const devOrigin = devUrl ? new URL(devUrl).origin : null
    const allowed = url.startsWith('file://') || (devOrigin !== null && url.startsWith(devOrigin))
    if (!allowed) event.preventDefault()
  })

  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(path.join(app.getAppPath(), '.output/public/index.html'))
}

function registerIpc() {
  ipcMain.handle('project:open', (event): Promise<DesktopOpenResponse> => openProject(event))
  ipcMain.handle('project:save', (event, contents: unknown): Promise<DesktopSaveResponse> => saveProject(event, contents, false))
  ipcMain.handle('project:save-as', (event, contents: unknown): Promise<DesktopSaveResponse> => saveProject(event, contents, true))
}

async function openProject(event: IpcMainInvokeEvent): Promise<DesktopOpenResponse> {
  try {
    assertSender(event)
    const result = await dialog.showOpenDialog({
      title: 'Open Tessera project',
      properties: ['openFile'],
      filters: [{ name: 'Tessera project', extensions: ['json'] }],
    })
    const filePath = result.filePaths[0]
    if (result.canceled || !filePath) return { status: 'canceled' }
    const text = await fs.readFile(filePath, 'utf8')
    if (Buffer.byteLength(text) > MAX_BYTES) {
      return { status: 'error', error: 'Project files must be 5 MB or smaller.' }
    }
    const validated = validateProjectFile(text)
    if (!validated.ok) return { status: 'error', error: validated.error }
    currentPath = filePath
    return { status: 'ok', filePath, document: validated.file.document }
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : 'Could not open the project.' }
  }
}

async function saveProject(event: IpcMainInvokeEvent, contents: unknown, saveAs: boolean): Promise<DesktopSaveResponse> {
  try {
    assertSender(event)
    if (typeof contents !== 'string') return { status: 'error', error: 'Project contents must be text.' }
    if (Buffer.byteLength(contents) > MAX_BYTES) return { status: 'error', error: 'Project files must be 5 MB or smaller.' }
    const validated = validateProjectFile(contents)
    if (!validated.ok) return { status: 'error', error: validated.error }
    const pretty = JSON.stringify(validated.file, null, 2)
    let filePath = saveAs ? null : currentPath
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Tessera project',
        defaultPath: currentPath ?? 'project.tessera.json',
        filters: [{ name: 'Tessera project', extensions: ['json'] }],
      })
      if (result.canceled || !result.filePath) return { status: 'canceled' }
      filePath = result.filePath.endsWith('.json') ? result.filePath : `${result.filePath}.json`
    }
    await fs.writeFile(filePath, pretty, 'utf8')
    currentPath = filePath
    return { status: 'ok', filePath }
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : 'Could not save the project.' }
  }
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
