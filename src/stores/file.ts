import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface FileRecord {
  id: number
  name: string
  path: string
  title: string
  description: string
  size: number
  created_at: string
  updated_at: string
  folder_id: number | null
}

export interface FolderRecord {
  id: number
  name: string
  parent_id: number | null
  path: string
  created_at: string
}

export const useFileStore = defineStore('file', () => {
  // 状态
  const files = ref<FileRecord[]>([])
  const currentFile = ref<FileRecord | null>(null)
  const folders = ref<FolderRecord[]>([])
  const currentFolder = ref<number | null>(null) // null 表示全部文件
  const loading = ref(false)
  const searchKeyword = ref('')
  const sortBy = ref<'updated_at' | 'name' | 'size'>('updated_at')
  const repoPath = ref<string>('')

  // 计算属性：过滤和排序后的文件列表
  const filteredFiles = computed(() => {
    let result = [...files.value]

    // 按文件夹过滤
    if (currentFolder.value !== null) {
      result = result.filter(f => f.folder_id === currentFolder.value)
    }

    // 按关键词搜索
    if (searchKeyword.value) {
      const keyword = searchKeyword.value.toLowerCase()
      result = result.filter(f =>
        f.name.toLowerCase().includes(keyword) ||
        f.title?.toLowerCase().includes(keyword) ||
        f.description?.toLowerCase().includes(keyword)
      )
    }

    // 排序
    result.sort((a, b) => {
      switch (sortBy.value) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'size':
          return b.size - a.size
        case 'updated_at':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })

    return result
  })

  // 从数据库加载所有文件
  async function loadFiles(): Promise<void> {
    loading.value = true
    try {
      const dbFiles = await window.electronAPI.dbGetAllFiles()
      files.value = dbFiles.map(f => ({
        id: f.id,
        name: f.name,
        path: f.path,
        title: f.title || '',
        description: f.description || '',
        size: f.size || 0,
        created_at: f.created_at,
        updated_at: f.updated_at,
        folder_id: f.folder_id
      }))
    } catch (error) {
      console.error('[FileStore] Failed to load files:', error)
    } finally {
      loading.value = false
    }
  }

  // 从数据库加载所有文件夹
  async function loadFolders(): Promise<void> {
    try {
      const dbFolders = await window.electronAPI.dbGetAllFolders()
      folders.value = dbFolders.map(f => ({
        id: f.id,
        name: f.name,
        parent_id: f.parent_id,
        path: f.path,
        created_at: f.created_at
      }))
    } catch (error) {
      console.error('[FileStore] Failed to load folders:', error)
    }
  }

  // 添加文件到数据库
  async function addFile(file: {
    name: string
    path: string
    title?: string
    description?: string
    size?: number
    folder_id?: number | null
  }): Promise<number | null> {
    try {
      const now = new Date().toISOString()
      const id = await window.electronAPI.dbInsertFile({
        name: file.name,
        path: file.path,
        title: file.title || '',
        description: file.description || '',
        size: file.size || 0,
        created_at: now,
        updated_at: now,
        folder_id: file.folder_id ?? null
      })

      // 重新加载文件列表
      await loadFiles()
      return id
    } catch (error) {
      console.error('[FileStore] Failed to add file:', error)
      return null
    }
  }

  // 更新文件
  async function updateFile(id: number, updates: Partial<FileRecord>): Promise<boolean> {
    try {
      const result = await window.electronAPI.dbUpdateFile(id, {
        title: updates.title,
        description: updates.description,
        size: updates.size,
        updated_at: new Date().toISOString()
      })

      if (result) {
        await loadFiles()
      }
      return result
    } catch (error) {
      console.error('[FileStore] Failed to update file:', error)
      return false
    }
  }

  // 删除文件
  async function removeFile(id: number): Promise<boolean> {
    try {
      // 删除文件记录
      const result = await window.electronAPI.dbDeleteFile(id)

      if (result) {
        // 如果删除的是当前文件，清空选中
        if (currentFile.value?.id === id) {
          currentFile.value = null
        }
        await loadFiles()
      }
      return result
    } catch (error) {
      console.error('[FileStore] Failed to delete file:', error)
      return false
    }
  }

  // 选择文件
  function selectFile(file: FileRecord | null): void {
    currentFile.value = file
  }

  // 选择文件夹
  function selectFolder(folderId: number | null): void {
    currentFolder.value = folderId
  }

  // 添加文件夹到数据库
  async function addFolder(folder: {
    name: string
    path: string
    parent_id?: number | null
  }): Promise<number | null> {
    try {
      const id = await window.electronAPI.dbInsertFolder({
        name: folder.name,
        path: folder.path,
        parent_id: folder.parent_id ?? null
      })

      await loadFolders()
      return id
    } catch (error) {
      console.error('[FileStore] Failed to add folder:', error)
      return null
    }
  }

  // 获取文件标题
  async function fetchFileTitle(filePath: string): Promise<{ title: string; description: string }> {
    try {
      const result = await window.electronAPI.readFile(filePath)
      return {
        title: result.title,
        description: result.description
      }
    } catch (error) {
      console.error('[FileStore] Failed to fetch file title:', error)
      return { title: '', description: '' }
    }
  }

  // 设置仓库路径
  function setRepoPath(path: string): void {
    repoPath.value = path
  }

  // 初始化（从存储恢复）
  async function init(): Promise<void> {
    // 恢复仓库路径
    const savedPath = await window.electronAPI.dbGetSetting('repoPath')
    if (savedPath) {
      repoPath.value = savedPath
    }

    // 加载数据
    await loadFiles()
    await loadFolders()
  }

  return {
    // 状态
    files,
    currentFile,
    folders,
    currentFolder,
    loading,
    searchKeyword,
    sortBy,
    repoPath,

    // 计算属性
    filteredFiles,

    // 方法
    loadFiles,
    loadFolders,
    addFile,
    updateFile,
    removeFile,
    selectFile,
    selectFolder,
    addFolder,
    fetchFileTitle,
    setRepoPath,
    init
  }
})
