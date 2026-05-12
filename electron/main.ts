import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// IPC: 选择文件夹
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

// IPC: 读取目录下的HTML文件
ipcMain.handle('read-directory', async (_event, dirPath: string) => {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    const files = items
      .filter(item => item.isFile() && item.name.toLowerCase().endsWith('.html'))
      .map(item => {
        const filePath = path.join(dirPath, item.name)
        const stats = fs.statSync(filePath)
        return {
          name: item.name,
          path: filePath,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString()
        }
      })
    
    const folders = items.filter(item => item.isDirectory())
    
    return { files, folders }
  } catch (error) {
    console.error('Error reading directory:', error)
    return { files: [], folders: [] }
  }
})

// IPC: 读取HTML文件内容
ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    
    // 提取title
    const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''
    
    // 提取meta description
    const descMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    const description = descMatch ? descMatch[1].trim() : ''
    
    return { content, title, description }
  } catch (error) {
    console.error('Error reading file:', error)
    return { content: '', title: '', description: '' }
  }
})

// IPC: 保存HTML文件
ipcMain.handle('save-file', async (_event, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    console.error('Error saving file:', error)
    return { success: false, error: String(error) }
  }
})

// IPC: 创建版本快照
ipcMain.handle('create-snapshot', async (_event, originalPath: string, versionsDir: string) => {
  try {
    const fileName = path.basename(originalPath)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const snapshotFileName = `${timestamp}_${fileName}`
    
    if (!fs.existsSync(versionsDir)) {
      fs.mkdirSync(versionsDir, { recursive: true })
    }
    
    const snapshotPath = path.join(versionsDir, snapshotFileName)
    fs.copyFileSync(originalPath, snapshotPath)
    
    return { success: true, snapshotPath }
  } catch (error) {
    console.error('Error creating snapshot:', error)
    return { success: false, error: String(error) }
  }
})

// IPC: 获取版本列表
ipcMain.handle('get-versions', async (_event, versionsDir: string, fileName: string) => {
  try {
    if (!fs.existsSync(versionsDir)) {
      return []
    }
    
    const items = fs.readdirSync(versionsDir, { withFileTypes: true })
    const versions = items
      .filter(item => item.isFile() && item.name.endsWith(`_${fileName}`))
      .map(item => {
        const filePath = path.join(versionsDir, item.name)
        const stats = fs.statSync(filePath)
        return {
          name: item.name,
          path: filePath,
          createdAt: stats.birthtime.toISOString()
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    return versions
  } catch (error) {
    console.error('Error getting versions:', error)
    return []
  }
})

// IPC: 恢复到指定版本
ipcMain.handle('restore-version', async (_event, versionPath: string, originalPath: string) => {
  try {
    const content = fs.readFileSync(versionPath)
    fs.writeFileSync(originalPath, content)
    return { success: true }
  } catch (error) {
    console.error('Error restoring version:', error)
    return { success: false, error: String(error) }
  }
})

// IPC: 获取所有子文件夹
ipcMain.handle('get-all-folders', async (_event, rootPath: string) => {
  const folders: { name: string; path: string; parentPath: string }[] = []
  
  function scanDir(dirPath: string, parentPath: string = '') {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true })
      items.forEach(item => {
        if (item.isDirectory()) {
          const fullPath = path.join(dirPath, item.name)
          folders.push({
            name: item.name,
            path: fullPath,
            parentPath: parentPath
          })
          scanDir(fullPath, fullPath)
        }
      })
    } catch (error) {
      console.error('Error scanning directory:', error)
    }
  }
  
  scanDir(rootPath)
  return folders
})

// IPC: 打开外部浏览器
ipcMain.handle('open-external', async (_event, url: string) => {
  const { shell } = await import('electron')
  shell.openExternal(url)
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})