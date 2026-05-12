import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { initDatabase, closeDatabase, getAllFiles, getFileByPath, insertFile, updateFile, deleteFile, deleteFileByPath, getAllFolders, insertFolder, getFolderByPath, insertVersion, getVersionsByFileId, deleteVersionsByFileId, getAllTags, insertTag, updateTag, deleteTag, addTagToFile, removeTagFromFile, getTagsByFileId, getFilesByTagId, setSetting, getSetting, getFileById } from './database'

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

// ============ 数据库操作 ============

// 文件相关
ipcMain.handle('db-get-all-files', async () => {
  return getAllFiles()
})

ipcMain.handle('db-get-file-by-id', async (_event, id: number) => {
  return getFileById(id)
})

ipcMain.handle('db-insert-file', async (_event, file: { name: string; path: string; title?: string; description?: string; size?: number; created_at?: string; updated_at?: string; folder_id?: number | null }) => {
  return insertFile(file)
})

ipcMain.handle('db-update-file', async (_event, id: number, file: { name?: string; path?: string; title?: string; description?: string; size?: number; updated_at?: string; folder_id?: number | null }) => {
  return updateFile(id, file)
})

ipcMain.handle('db-delete-file', async (_event, id: number) => {
  return deleteFile(id)
})

ipcMain.handle('db-delete-file-by-path', async (_event, filePath: string) => {
  return deleteFileByPath(filePath)
})

ipcMain.handle('db-get-file-by-path', async (_event, filePath: string) => {
  return getFileByPath(filePath)
})

// 文件夹相关
ipcMain.handle('db-get-all-folders', async () => {
  return getAllFolders()
})

ipcMain.handle('db-insert-folder', async (_event, folder: { name: string; parent_id?: number | null; path: string }) => {
  return insertFolder(folder)
})

ipcMain.handle('db-get-folder-by-path', async (_event, folderPath: string) => {
  return getFolderByPath(folderPath)
})

// 版本相关
ipcMain.handle('db-insert-version', async (_event, version: { file_id: number; version_path: string; snapshot_at?: string; remark?: string }) => {
  return insertVersion(version)
})

ipcMain.handle('db-get-versions-by-file-id', async (_event, fileId: number) => {
  return getVersionsByFileId(fileId)
})

ipcMain.handle('db-delete-versions-by-file-id', async (_event, fileId: number) => {
  return deleteVersionsByFileId(fileId)
})

// 标签相关
ipcMain.handle('db-get-all-tags', async () => {
  return getAllTags()
})

ipcMain.handle('db-insert-tag', async (_event, tag: { name: string; color?: string }) => {
  return insertTag(tag)
})

ipcMain.handle('db-update-tag', async (_event, id: number, tag: { name?: string; color?: string }) => {
  return updateTag(id, tag)
})

ipcMain.handle('db-delete-tag', async (_event, id: number) => {
  return deleteTag(id)
})

ipcMain.handle('db-add-tag-to-file', async (_event, fileId: number, tagId: number) => {
  return addTagToFile(fileId, tagId)
})

ipcMain.handle('db-remove-tag-from-file', async (_event, fileId: number, tagId: number) => {
  return removeTagFromFile(fileId, tagId)
})

ipcMain.handle('db-get-tags-by-file-id', async (_event, fileId: number) => {
  return getTagsByFileId(fileId)
})

ipcMain.handle('db-get-files-by-tag-id', async (_event, tagId: number) => {
  return getFilesByTagId(tagId)
})

// 设置相关
ipcMain.handle('db-set-setting', async (_event, key: string, value: string) => {
  setSetting(key, value)
  return true
})

ipcMain.handle('db-get-setting', async (_event, key: string) => {
  return getSetting(key)
})

// 递归扫描目录下所有HTML文件
ipcMain.handle('scan-html-files', async (_event, rootPath: string, recursive: boolean = true) => {
  const htmlFiles: Array<{
    name: string
    path: string
    relativePath: string
    size: number
    createdAt: string
    updatedAt: string
  }> = []
  
  function scanDir(dirPath: string, basePath: string) {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true })
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name)
        
        if (item.isFile() && item.name.toLowerCase().endsWith('.html')) {
          const stats = fs.statSync(fullPath)
          htmlFiles.push({
            name: item.name,
            path: fullPath,
            relativePath: path.relative(basePath, fullPath),
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
            updatedAt: stats.mtime.toISOString()
          })
        } else if (item.isDirectory() && recursive && item.name !== '.versions' && !item.name.startsWith('.')) {
          scanDir(fullPath, basePath)
        }
      }
    } catch (error) {
      console.error('Error scanning directory:', error)
    }
  }
  
  scanDir(rootPath, rootPath)
  return htmlFiles
})

// 复制文件到仓库
ipcMain.handle('copy-file-to-repo', async (_event, sourcePath: string, destDir: string) => {
  try {
    const fileName = path.basename(sourcePath)
    const destPath = path.join(destDir, fileName)
    
    // 如果目标文件已存在，添加时间戳
    let finalPath = destPath
    if (fs.existsSync(destPath)) {
      const ext = path.extname(fileName)
      const base = path.basename(fileName, ext)
      const timestamp = Date.now()
      finalPath = path.join(destDir, `${base}_${timestamp}${ext}`)
    }
    
    fs.copyFileSync(sourcePath, finalPath)
    return { success: true, path: finalPath }
  } catch (error) {
    console.error('Error copying file:', error)
    return { success: false, error: String(error) }
  }
})

// 选择HTML文件
ipcMain.handle('select-html-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }]
  })
  return result.canceled ? [] : result.filePaths
})

app.whenReady().then(() => {
  // 初始化数据库
  initDatabase()
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase()
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})