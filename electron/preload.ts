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
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // 在系统文件管理器中定位文件
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('show-item-in-folder', filePath),

  // 重命名磁盘文件（同时迁移同名版本快照）
  renameFile: (oldPath: string, newBaseName: string, versionsDir?: string) =>
    ipcRenderer.invoke('rename-file', oldPath, newBaseName, versionsDir),
  
  // ============ 数据库操作 ============
  
  // 文件相关
  dbGetAllFiles: () => ipcRenderer.invoke('db-get-all-files'),
  dbGetFilesByRepoPath: (repoPath: string) => ipcRenderer.invoke('db-get-files-by-repo-path', repoPath),
  dbGetFileById: (id: number) => ipcRenderer.invoke('db-get-file-by-id', id),
  dbInsertFile: (file: { name: string; path: string; title?: string; description?: string; size?: number; created_at?: string; updated_at?: string; folder_id?: number | null }) => 
    ipcRenderer.invoke('db-insert-file', file),
  dbUpdateFile: (id: number, file: { name?: string; path?: string; title?: string; description?: string; size?: number; updated_at?: string; folder_id?: number | null; is_pinned?: number }) => 
    ipcRenderer.invoke('db-update-file', id, file),
  dbDeleteFile: (id: number) => ipcRenderer.invoke('db-delete-file', id),
  dbDeleteFileByPath: (filePath: string) => ipcRenderer.invoke('db-delete-file-by-path', filePath),
  dbGetFileByPath: (filePath: string) => ipcRenderer.invoke('db-get-file-by-path', filePath),
  
  // 文件夹相关
  dbGetAllFolders: () => ipcRenderer.invoke('db-get-all-folders'),
  dbInsertFolder: (folder: { name: string; parent_id?: number | null; path: string }) => 
    ipcRenderer.invoke('db-insert-folder', folder),
  dbGetFolderByPath: (folderPath: string) => ipcRenderer.invoke('db-get-folder-by-path', folderPath),
  
  // 版本相关
  dbInsertVersion: (version: { file_id: number; version_path: string; snapshot_at?: string; remark?: string }) => 
    ipcRenderer.invoke('db-insert-version', version),
  dbGetVersionsByFileId: (fileId: number) => ipcRenderer.invoke('db-get-versions-by-file-id', fileId),
  dbDeleteVersionsByFileId: (fileId: number) => ipcRenderer.invoke('db-delete-versions-by-file-id', fileId),
  dbUpdateVersionPath: (id: number, newPath: string) => ipcRenderer.invoke('db-update-version-path', id, newPath),
  
  // 标签相关
  dbGetAllTags: () => ipcRenderer.invoke('db-get-all-tags'),
  dbInsertTag: (tag: { name: string; color?: string }) => ipcRenderer.invoke('db-insert-tag', tag),
  dbUpdateTag: (id: number, tag: { name?: string; color?: string }) => ipcRenderer.invoke('db-update-tag', id, tag),
  dbDeleteTag: (id: number) => ipcRenderer.invoke('db-delete-tag', id),
  dbAddTagToFile: (fileId: number, tagId: number) => ipcRenderer.invoke('db-add-tag-to-file', fileId, tagId),
  dbRemoveTagFromFile: (fileId: number, tagId: number) => ipcRenderer.invoke('db-remove-tag-from-file', fileId, tagId),
  dbGetTagsByFileId: (fileId: number) => ipcRenderer.invoke('db-get-tags-by-file-id', fileId),
  dbGetFilesByTagId: (tagId: number) => ipcRenderer.invoke('db-get-files-by-tag-id', tagId),
  
  // 设置相关
  dbSetSetting: (key: string, value: string) => ipcRenderer.invoke('db-set-setting', key, value),
  dbGetSetting: (key: string) => ipcRenderer.invoke('db-get-setting', key),
  
  // 文件扫描
  scanHtmlFiles: (rootPath: string, recursive?: boolean) => 
    ipcRenderer.invoke('scan-html-files', rootPath, recursive),
  copyFileToRepo: (sourcePath: string, destDir: string) => 
    ipcRenderer.invoke('copy-file-to-repo', sourcePath, destDir),
  selectHtmlFiles: () => ipcRenderer.invoke('select-html-files'),
  joinPath: (...segments: string[]) => ipcRenderer.invoke('join-path', ...segments)
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
      showItemInFolder: (filePath: string) => Promise<boolean>
      renameFile: (oldPath: string, newBaseName: string, versionsDir?: string) => Promise<{
        success: boolean
        newPath?: string
        newName?: string
        renamedSnapshots?: Array<{ oldPath: string; newPath: string }>
        error?: string
      }>
      
      // 数据库操作
      dbGetAllFiles: () => Promise<Array<{
        id: number
        name: string
        path: string
        title: string
        description: string
        size: number
        created_at: string
        updated_at: string
        folder_id: number | null
        is_pinned: number
      }>>
      dbGetFilesByRepoPath: (repoPath: string) => Promise<Array<{
        id: number
        name: string
        path: string
        title: string
        description: string
        size: number
        created_at: string
        updated_at: string
        folder_id: number | null
        is_pinned: number
      }>>
      dbGetFileById: (id: number) => Promise<{
        id: number
        name: string
        path: string
        title: string
        description: string
        size: number
        created_at: string
        updated_at: string
        folder_id: number | null
      } | null>
      dbInsertFile: (file: { name: string; path: string; title?: string; description?: string; size?: number; created_at?: string; updated_at?: string; folder_id?: number | null }) => Promise<number>
      dbUpdateFile: (id: number, file: { name?: string; path?: string; title?: string; description?: string; size?: number; updated_at?: string; folder_id?: number | null; is_pinned?: number }) => Promise<boolean>
      dbDeleteFile: (id: number) => Promise<boolean>
      dbDeleteFileByPath: (filePath: string) => Promise<boolean>
      dbGetFileByPath: (filePath: string) => Promise<{
        id: number
        name: string
        path: string
        title: string
        description: string
        size: number
        created_at: string
        updated_at: string
        folder_id: number | null
      } | null>
      
      dbGetAllFolders: () => Promise<Array<{
        id: number
        name: string
        parent_id: number | null
        path: string
        created_at: string
      }>>
      dbInsertFolder: (folder: { name: string; parent_id?: number | null; path: string }) => Promise<number>
      dbGetFolderByPath: (folderPath: string) => Promise<{
        id: number
        name: string
        parent_id: number | null
        path: string
        created_at: string
      } | null>
      
      dbInsertVersion: (version: { file_id: number; version_path: string; snapshot_at?: string; remark?: string }) => Promise<number>
      dbGetVersionsByFileId: (fileId: number) => Promise<Array<{
        id: number
        file_id: number
        version_path: string
        snapshot_at: string
        remark: string
      }>>
      dbDeleteVersionsByFileId: (fileId: number) => Promise<boolean>
      dbUpdateVersionPath: (id: number, newPath: string) => Promise<boolean>
      
      dbGetAllTags: () => Promise<Array<{
        id: number
        name: string
        color: string
      }>>
      dbInsertTag: (tag: { name: string; color?: string }) => Promise<number>
      dbUpdateTag: (id: number, tag: { name?: string; color?: string }) => Promise<boolean>
      dbDeleteTag: (id: number) => Promise<boolean>
      dbAddTagToFile: (fileId: number, tagId: number) => Promise<boolean>
      dbRemoveTagFromFile: (fileId: number, tagId: number) => Promise<boolean>
      dbGetTagsByFileId: (fileId: number) => Promise<Array<{
        id: number
        name: string
        color: string
      }>>
      dbGetFilesByTagId: (tagId: number) => Promise<Array<{
        id: number
        name: string
        path: string
        title: string
        description: string
        size: number
        created_at: string
        updated_at: string
        folder_id: number | null
      }>>
      
      dbSetSetting: (key: string, value: string) => Promise<boolean>
      dbGetSetting: (key: string) => Promise<string | null>
      
      // 文件扫描
      scanHtmlFiles: (rootPath: string, recursive?: boolean) => Promise<Array<{
        name: string
        path: string
        relativePath: string
        size: number
        createdAt: string
        updatedAt: string
      }>>
      copyFileToRepo: (sourcePath: string, destDir: string) => Promise<{ success: boolean; path?: string; error?: string }>
      selectHtmlFiles: () => Promise<string[]>
      joinPath: (...segments: string[]) => Promise<string>
    }
  }
}