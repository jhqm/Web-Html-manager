import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface VersionRecord {
  id: number
  file_id: number
  version_path: string
  snapshot_at: string
  remark: string
}

export const useVersionStore = defineStore('version', () => {
  // 状态
  const versions = ref<VersionRecord[]>([])
  const currentFileId = ref<number | null>(null)
  const loading = ref(false)

  // 从数据库加载文件版本
  async function loadVersions(fileId: number): Promise<void> {
    loading.value = true
    currentFileId.value = fileId
    try {
      const dbVersions = await window.electronAPI.dbGetVersionsByFileId(fileId)
      versions.value = dbVersions.map(v => ({
        id: v.id,
        file_id: v.file_id,
        version_path: v.version_path,
        snapshot_at: v.snapshot_at,
        remark: v.remark || ''
      }))
    } catch (error) {
      console.error('[VersionStore] Failed to load versions:', error)
      versions.value = []
    } finally {
      loading.value = false
    }
  }

  // 创建版本快照
  async function createVersion(fileId: number, versionPath: string, remark: string = ''): Promise<number | null> {
    try {
      const id = await window.electronAPI.dbInsertVersion({
        file_id: fileId,
        version_path: versionPath,
        remark
      })

      // 重新加载版本列表
      if (currentFileId.value === fileId) {
        await loadVersions(fileId)
      }

      return id
    } catch (error) {
      console.error('[VersionStore] Failed to create version:', error)
      return null
    }
  }

  // 删除文件的所有版本
  async function deleteVersionsByFileId(fileId: number): Promise<boolean> {
    try {
      const result = await window.electronAPI.dbDeleteVersionsByFileId(fileId)
      if (result && currentFileId.value === fileId) {
        versions.value = []
      }
      return result
    } catch (error) {
      console.error('[VersionStore] Failed to delete versions:', error)
      return false
    }
  }

  // 清空当前版本列表
  function clearVersions(): void {
    versions.value = []
    currentFileId.value = null
  }

  return {
    // 状态
    versions,
    currentFileId,
    loading,

    // 方法
    loadVersions,
    createVersion,
    deleteVersionsByFileId,
    clearVersions
  }
})
