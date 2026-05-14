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
  is_pinned: number // 0: 未置顶, 1: 置顶
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
  
  // 置顶文件列表（内存中）
  const pinnedFiles = ref<number[]>([])
  
  // 标签筛选（内存缓存）
  const selectedTagIdForFilter = ref<number | null>(null)
  const taggedFileIdsMap = ref<Map<number, number[]>>(new Map())

  // 计算属性：过滤和排序后的文件列表
  const filteredFiles = computed(() => {
    let result = [...files.value]

    // 按文件夹过滤
    if (currentFolder.value !== null) {
      result = result.filter(f => f.folder_id === currentFolder.value)
    }

    // 按标签过滤
    if (selectedTagIdForFilter.value !== null) {
      if (selectedTagIdForFilter.value === -1) {
        // 无标签
        const taggedFileIds = new Set<number>()
        for (const tagId of taggedFileIdsMap.value.keys()) {
          const ids = taggedFileIdsMap.value.get(tagId)
          if (ids) ids.forEach(id => taggedFileIds.add(id))
        }
        result = result.filter(f => !taggedFileIds.has(f.id))
      } else {
        const taggedIds = taggedFileIdsMap.value.get(selectedTagIdForFilter.value) || []
        result = result.filter(f => taggedIds.includes(f.id))
      }
    }

    // 置顶文件排在最前
    const pinnedFiles = result.filter(f => f.is_pinned === 1)
    const unpinnedFiles = result.filter(f => f.is_pinned !== 1)
    result = [...pinnedFiles, ...unpinnedFiles]

    // 按关键词搜索
    if (searchKeyword.value) {
      const keyword = searchKeyword.value.toLowerCase()
      result = result.filter(f =>
        f.name.toLowerCase().includes(keyword) ||
        f.title?.toLowerCase().includes(keyword) ||
        f.description?.toLowerCase().includes(keyword)
      )
    }

    // 排序（置顶的保持在前）
    const pinned = result.filter(f => f.is_pinned === 1)
    const unpinned = result.filter(f => f.is_pinned !== 1)
    
    unpinned.sort((a, b) => {
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

    return [...pinned, ...unpinned]
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
        folder_id: f.folder_id,
        is_pinned: f.is_pinned || 0
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
        name: updates.name,
        path: updates.path,
        title: updates.title,
        description: updates.description,
        size: updates.size,
        is_pinned: updates.is_pinned,
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

  // 重命名文件：同时把磁盘上的真实文件名改掉
  // newBaseName: 不含扩展名的新名字（也允许带扩展名，会原样使用）
  // 返回 { success, newPath?, newName?, error? }
  async function renameFile(
    id: number,
    newBaseName: string
  ): Promise<{ success: boolean; newPath?: string; newName?: string; error?: string }> {
    const file = files.value.find(f => f.id === id)
    if (!file) return { success: false, error: '文件不存在' }

    const versionsDir = repoPath.value ? `${repoPath.value}/.versions` : undefined

    try {
      // 1) 磁盘上重命名（含同名快照迁移）
      const renameRes = await window.electronAPI.renameFile(file.path, newBaseName, versionsDir)
      if (!renameRes.success || !renameRes.newPath || !renameRes.newName) {
        return { success: false, error: renameRes.error || '磁盘重命名失败' }
      }

      // 2) 同步数据库 files 表（name + path + title）
      //    title 也一并改成新的 base 名，否则列表/预览仍展示旧 title 看起来像"没刷新"
      const dotIdx = renameRes.newName.lastIndexOf('.')
      const newTitle = dotIdx > 0 ? renameRes.newName.slice(0, dotIdx) : renameRes.newName
      const ok = await window.electronAPI.dbUpdateFile(id, {
        name: renameRes.newName,
        path: renameRes.newPath,
        title: newTitle,
        updated_at: new Date().toISOString()
      })
      if (!ok) {
        return { success: false, error: '数据库更新失败' }
      }

      // 3) 同步 versions 表中的 version_path（与磁盘上已迁移的快照一一对应）
      if (renameRes.renamedSnapshots && renameRes.renamedSnapshots.length > 0) {
        try {
          const dbVersions = await window.electronAPI.dbGetVersionsByFileId(id)
          for (const v of dbVersions) {
            const hit = renameRes.renamedSnapshots.find(s => s.oldPath === v.version_path)
            if (hit) {
              await window.electronAPI.dbUpdateVersionPath(v.id, hit.newPath)
            }
          }
        } catch (e) {
          console.warn('[FileStore] sync version_path failed:', e)
        }
      }

      // 4) 刷新内存状态
      await loadFiles()
      if (currentFile.value?.id === id) {
        const fresh = files.value.find(f => f.id === id) || null
        currentFile.value = fresh
      }

      return { success: true, newPath: renameRes.newPath, newName: renameRes.newName }
    } catch (error) {
      console.error('[FileStore] Failed to rename file:', error)
      return { success: false, error: String(error) }
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

  // 置顶/取消置顶文件
  async function togglePin(fileId: number): Promise<void> {
    const file = files.value.find(f => f.id === fileId)
    if (!file) return
    
    const newPinned = file.is_pinned === 1 ? 0 : 1
    const result = await window.electronAPI.dbUpdateFile(fileId, {
      is_pinned: newPinned
    })
    
    if (result) {
      file.is_pinned = newPinned
    }
  }

  // 设置标签筛选
  function setTagFilter(tagId: number | null): void {
    selectedTagIdForFilter.value = tagId
  }

  // 更新标签文件映射
  function updateTaggedFileIds(tagId: number, fileIds: number[]): void {
    taggedFileIdsMap.value.set(tagId, fileIds)
  }


  // 清空标签文件映射（用于重建映射，避免删除标签后残留）
  function clearTaggedFileIdsMap(): void {
    taggedFileIdsMap.value = new Map()
  }

  // 同步获取文件标签ID数组（用于UI多选）
  function getFileTags(fileId: number): number[] {
    return [] // 需要从tagStore异步获取，这里返回空
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
    pinnedFiles,
    selectedTagIdForFilter,

    // 计算属性
    filteredFiles,

    // 方法
    loadFiles,
    loadFolders,
    addFile,
    updateFile,
    renameFile,
    removeFile,
    selectFile,
    selectFolder,
    addFolder,
    fetchFileTitle,
    setRepoPath,
    togglePin,
    setTagFilter,
    updateTaggedFileIds,
    clearTaggedFileIdsMap,
    init
  }
})
