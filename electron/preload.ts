import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 选择文件夹
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // 读取目录
  readDirectory: (dirPath: string) => ipcRenderer.invoke('read-directory', dirPath),
  
  // 读取文件
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  
  // 保存文件
  saveFile: (filePath: string, content: string) => ipcRenderer.invoke('save-file', filePath, content),
  
  // 创建版本快照
  createSnapshot: (originalPath: string, versionsDir: string) => 
    ipcRenderer.invoke('create-snapshot', originalPath, versionsDir),
  
  // 获取版本列表
  getVersions: (versionsDir: string, fileName: string) => 
    ipcRenderer.invoke('get-versions', versionsDir, fileName),
  
  // 恢复版本
  restoreVersion: (versionPath: string, originalPath: string) => 
    ipcRenderer.invoke('restore-version', versionPath, originalPath),
  
  // 获取所有文件夹
  getAllFolders: (rootPath: string) => ipcRenderer.invoke('get-all-folders', rootPath),
  
  // 打开外部浏览器
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url)
})

// 类型声明
declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>
      readDirectory: (dirPath: string) => Promise<{
        files: Array<{
          name: string
          path: string
          size: number
          createdAt: string
          updatedAt: string
        }>
        folders: Array<{ name: string; isDirectory: boolean }>
      }>
      readFile: (filePath: string) => Promise<{
        content: string
        title: string
        description: string
      }>
      saveFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
      createSnapshot: (originalPath: string, versionsDir: string) => Promise<{ success: boolean; snapshotPath?: string; error?: string }>
      getVersions: (versionsDir: string, fileName: string) => Promise<Array<{
        name: string
        path: string
        createdAt: string
      }>>
      restoreVersion: (versionPath: string, originalPath: string) => Promise<{ success: boolean; error?: string }>
      getAllFolders: (rootPath: string) => Promise<Array<{
        name: string
        path: string
        parentPath: string
      }>>
      openExternal: (url: string) => Promise<void>
    }
  }
}