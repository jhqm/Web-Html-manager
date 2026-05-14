import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'
import { initDatabase, closeDatabase, getAllFiles, getFilesByRepoPath, getFileByPath, insertFile, updateFile, deleteFile, deleteFileByPath, getAllFolders, insertFolder, getFolderByPath, insertVersion, getVersionsByFileId, deleteVersionsByFileId, updateVersionPath, getAllTags, insertTag, updateTag, deleteTag, addTagToFile, removeTagFromFile, getTagsByFileId, getFilesByTagId, setSetting, getSetting, getFileById } from './database'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ============================================================
// 自定义协议 app://preview/<encoded-absolute-path>
// 目的：dev/prod 共用同一条加载管线，消除 file:// 协议在打包后
//      行为差异（baseURL、相对路径、CSP 等）带来的不一致问题。
// ------------------------------------------------------------
// 注册顺序要求：registerSchemesAsPrivileged 必须在 app ready 之前调用。
// ============================================================
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])

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

  const port = process.env.VITE_DEV_SERVER_PORT || '5173'
  if (isDev) {
    mainWindow.loadURL(`http://localhost:${port}`)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

const DEFAULT_REPO_DIR_NAME = 'DefaultRepo'
const QUICK_START_FILE_NAME = '快速开始.html'

function getQuickStartTemplatePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'templates', QUICK_START_FILE_NAME)
  }
  return path.join(app.getAppPath(), 'resources', 'templates', QUICK_START_FILE_NAME)
}

function extractMetaFromHtml(content: string): { title: string; description: string } {
  const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i)
  const descMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    description: descMatch ? descMatch[1].trim() : ''
  }
}

function getFallbackQuickStartContent(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>快速开始</title>
    <meta name="description" content="欢迎使用 AI HTML Manager，开始管理你的 HTML 资产。" />
  </head>
  <body>
    <main style="max-width:800px;margin:40px auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;">
      <h1>欢迎使用 AI HTML Manager</h1>
      <p>这是系统为你准备的默认文件，你可以直接编辑、另存和管理更多 HTML 资产。</p>
    </main>
  </body>
</html>`
}

async function seedDefaultRepoOnFirstRun(): Promise<void> {
  try {
    const currentRepoPath = getSetting('repoPath')
    if (currentRepoPath) return

    const defaultRepoPath = path.join(app.getPath('userData'), DEFAULT_REPO_DIR_NAME)
    fs.mkdirSync(defaultRepoPath, { recursive: true })

    const quickStartFilePath = path.join(defaultRepoPath, QUICK_START_FILE_NAME)
    if (!fs.existsSync(quickStartFilePath)) {
      const templatePath = getQuickStartTemplatePath()
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, quickStartFilePath)
      } else {
        fs.writeFileSync(quickStartFilePath, getFallbackQuickStartContent(), 'utf-8')
      }
    }

    const fileStat = fs.statSync(quickStartFilePath)
    const fileContent = fs.readFileSync(quickStartFilePath, 'utf-8')
    const { title, description } = extractMetaFromHtml(fileContent)

    const existingRecord = getFileByPath(quickStartFilePath)
    if (!existingRecord) {
      insertFile({
        name: QUICK_START_FILE_NAME,
        path: quickStartFilePath,
        title,
        description,
        size: fileStat.size,
        created_at: fileStat.birthtime.toISOString(),
        updated_at: fileStat.mtime.toISOString(),
        folder_id: null
      })
    }

    setSetting('repoPath', defaultRepoPath)
  } catch (error) {
    console.error('[Bootstrap] Failed to seed default repo:', error)
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

// IPC: 在系统文件管理器中定位文件
ipcMain.handle('show-item-in-folder', async (_event, filePath: string) => {
  const { shell } = await import('electron')
  shell.showItemInFolder(filePath)
  return true
})

// IPC: 重命名磁盘文件（同时迁移版本快照）
// payload: { oldPath, newBaseName, versionsDir? }
//  - newBaseName: 不带扩展名的新文件名（如 "my-page"）；若包含扩展名则原样使用
//  - versionsDir: 可选，版本快照目录（一般为 <repoPath>/.versions）
// 返回：{ success, newPath?, newName?, renamedSnapshots?: Array<{ oldPath, newPath }>, error? }
ipcMain.handle('rename-file', async (
  _event,
  oldPath: string,
  newBaseName: string,
  versionsDir?: string
) => {
  try {
    if (!fs.existsSync(oldPath)) {
      return { success: false, error: '原文件不存在' }
    }

    const dir = path.dirname(oldPath)
    const oldName = path.basename(oldPath)
    const oldExt = path.extname(oldName)

    // 计算新文件名：若用户已带扩展名则用之，否则保留原扩展名
    const trimmed = (newBaseName || '').trim()
    if (!trimmed) {
      return { success: false, error: '新文件名不能为空' }
    }
    // 简单合法性校验（禁止路径分隔符与控制字符）
    if (/[\\/\x00<>:"|?*]/.test(trimmed)) {
      return { success: false, error: '文件名包含非法字符' }
    }

    const hasExt = path.extname(trimmed) !== ''
    const newName = hasExt ? trimmed : `${trimmed}${oldExt}`
    const newPath = path.join(dir, newName)

    if (newPath === oldPath) {
      return { success: true, newPath, newName, renamedSnapshots: [] }
    }

    // 目标已存在则拒绝（不覆盖）
    if (fs.existsSync(newPath)) {
      return { success: false, error: '目标文件名已存在' }
    }

    // 1) 重命名主文件
    fs.renameSync(oldPath, newPath)

    // 2) 迁移版本快照：命名规则 `${timestamp}_${oldName}` → `${timestamp}_${newName}`
    const renamedSnapshots: Array<{ oldPath: string; newPath: string }> = []
    if (versionsDir && fs.existsSync(versionsDir)) {
      try {
        const entries = fs.readdirSync(versionsDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isFile()) continue
          // 仅处理以 _<oldName> 结尾的快照
          if (!entry.name.endsWith(`_${oldName}`)) continue
          const prefix = entry.name.slice(0, entry.name.length - oldName.length) // 含末尾的 "_"
          const snapOld = path.join(versionsDir, entry.name)
          const snapNew = path.join(versionsDir, `${prefix}${newName}`)
          if (snapOld === snapNew) continue
          if (fs.existsSync(snapNew)) continue // 安全起见，跳过冲突项
          fs.renameSync(snapOld, snapNew)
          renamedSnapshots.push({ oldPath: snapOld, newPath: snapNew })
        }
      } catch (e) {
        console.warn('[rename-file] migrate snapshots failed:', e)
      }
    }

    return { success: true, newPath, newName, renamedSnapshots }
  } catch (error) {
    console.error('Error renaming file:', error)
    return { success: false, error: String(error) }
  }
})

// ============ 数据库操作 ============

// 文件相关
ipcMain.handle('db-get-all-files', async () => {
  return getAllFiles()
})

// 按仓库根路径前缀获取文件（用于"路径身份"视图过滤）
// 入参为空字符串/未提供时退化为返回全部，保持向后兼容
ipcMain.handle('db-get-files-by-repo-path', async (_event, repoPath: string) => {
  if (!repoPath) return getAllFiles()
  return getFilesByRepoPath(repoPath)
})

ipcMain.handle('db-get-file-by-id', async (_event, id: number) => {
  return getFileById(id)
})

ipcMain.handle('db-insert-file', async (_event, file: { name: string; path: string; title?: string; description?: string; size?: number; created_at?: string; updated_at?: string; folder_id?: number | null }) => {
  return insertFile(file)
})

ipcMain.handle('db-update-file', async (_event, id: number, file: { name?: string; path?: string; title?: string; description?: string; size?: number; updated_at?: string; folder_id?: number | null; is_pinned?: number }) => {
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

ipcMain.handle('db-update-version-path', async (_event, id: number, newPath: string) => {
  return updateVersionPath(id, newPath)
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

app.whenReady().then(async () => {
  // 初始化数据库
  initDatabase()
  await seedDefaultRepoOnFirstRun()

  // ----------------------------------------------------------
  // 注册 app:// 协议处理器
  // URL 形式：app://preview/<encoded-absolute-path>
  //   - hostname 必须为 "preview"
  //   - pathname 是 URI 编码后的绝对路径（含跨平台前导斜杠）
  // ----------------------------------------------------------
  protocol.handle('app', async (req) => {
    try {
      const url = new URL(req.url)
      if (url.hostname !== 'preview') {
        return new Response('Not Found', { status: 404 })
      }

      // 还原绝对路径：URL.pathname 在 standard scheme 下会带前导 "/"
      // Windows 例子：app://preview/C%3A/foo/bar.html → /C:/foo/bar.html → C:/foo/bar.html
      // POSIX  例子：app://preview/Users/foo/bar.html → /Users/foo/bar.html
      let rawPath = decodeURIComponent(url.pathname || '')
      if (process.platform === 'win32' && /^\/[A-Za-z]:\//.test(rawPath)) {
        rawPath = rawPath.slice(1)
      }

      if (!rawPath || !fs.existsSync(rawPath)) {
        return new Response('File Not Found', { status: 404 })
      }

      // 直接将本地文件以 file:// 形式交给 net.fetch，由 Electron 处理范围请求/MIME。
      const fileUrl = pathToFileURL(rawPath).toString()
      return await net.fetch(fileUrl)
    } catch (err) {
      console.error('[protocol:app] handle error:', err)
      return new Response('Internal Error', { status: 500 })
    }
  })

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