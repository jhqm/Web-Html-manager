import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TagRecord {
  id: number
  name: string
  color: string
}

export const useTagStore = defineStore('tag', () => {
  // 状态
  const tags = ref<TagRecord[]>([])
  const selectedTagId = ref<number | null>(null)
  const loading = ref(false)
  const tagLinksVersion = ref(0)

  function bumpTagLinksVersion(): void {
    tagLinksVersion.value += 1
  }

  // 从数据库加载所有标签
  async function loadTags(): Promise<void> {
    loading.value = true
    try {
      const dbTags = await window.electronAPI.dbGetAllTags()
      tags.value = dbTags.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color || '#409EFF'
      }))
    } catch (error) {
      console.error('[TagStore] Failed to load tags:', error)
    } finally {
      loading.value = false
    }
  }

  // 创建标签
  async function createTag(name: string, color: string = '#409EFF'): Promise<number | null> {
    try {
      const id = await window.electronAPI.dbInsertTag({ name, color })
      await loadTags()
      return id
    } catch (error) {
      console.error('[TagStore] Failed to create tag:', error)
      return null
    }
  }

  // 更新标签
  async function updateTag(id: number, name: string, color: string): Promise<boolean> {
    try {
      const result = await window.electronAPI.dbUpdateTag(id, { name, color })
      if (result) {
        await loadTags()
      }
      return result
    } catch (error) {
      console.error('[TagStore] Failed to update tag:', error)
      return false
    }
  }

  // 删除标签
  async function removeTag(id: number): Promise<boolean> {
    try {
      // 显式解绑该标签与所有文件的关系，确保删除后文件不再保留该标签
      const fileIds = await getTagFileIds(id)
      for (const fileId of fileIds) {
        await removeTagFromFile(fileId, id)
      }

      const result = await window.electronAPI.dbDeleteTag(id)
      if (result) {
        // 如果删除的是选中的标签，清空选中
        if (selectedTagId.value === id) {
          selectedTagId.value = null
        }
        bumpTagLinksVersion()
        await loadTags()
      }
      return result
    } catch (error) {
      console.error('[TagStore] Failed to delete tag:', error)
      return false
    }
  }

  // 为文件添加标签
  async function addTagToFile(fileId: number, tagId: number): Promise<boolean> {
    try {
      const ok = await window.electronAPI.dbAddTagToFile(fileId, tagId)
      if (ok) bumpTagLinksVersion()
      return ok
    } catch (error) {
      console.error('[TagStore] Failed to add tag to file:', error)
      return false
    }
  }

  // 从文件移除标签
  async function removeTagFromFile(fileId: number, tagId: number): Promise<boolean> {
    try {
      const ok = await window.electronAPI.dbRemoveTagFromFile(fileId, tagId)
      if (ok) bumpTagLinksVersion()
      return ok
    } catch (error) {
      console.error('[TagStore] Failed to remove tag from file:', error)
      return false
    }
  }

  // 获取文件的所有标签
  async function getFileTags(fileId: number): Promise<TagRecord[]> {
    try {
      const dbTags = await window.electronAPI.dbGetTagsByFileId(fileId)
      return dbTags.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color || '#409EFF'
      }))
    } catch (error) {
      console.error('[TagStore] Failed to get file tags:', error)
      return []
    }
  }

  // 获取指定标签的所有文件ID
  async function getTagFileIds(tagId: number): Promise<number[]> {
    try {
      const dbFiles = await window.electronAPI.dbGetFilesByTagId(tagId)
      return dbFiles.map(f => f.id)
    } catch (error) {
      console.error('[TagStore] Failed to get tag file ids:', error)
      return []
    }
  }

  // 批量设置文件的标签
  async function setFileTags(fileId: number, tagIds: number[]): Promise<boolean> {
    try {
      // 获取文件当前的所有标签
      const currentTags = await getFileTags(fileId)
      const currentTagIds = currentTags.map(t => t.id)
      const newTagIds = tagIds

      // 计算需要添加和删除的标签
      const toAdd = newTagIds.filter(id => !currentTagIds.includes(id))
      const toRemove = currentTagIds.filter(id => !newTagIds.includes(id))

      // 添加新标签
      for (const tagId of toAdd) {
        await addTagToFile(fileId, tagId)
      }

      // 删除不需要的标签
      for (const tagId of toRemove) {
        await removeTagFromFile(fileId, tagId)
      }

      bumpTagLinksVersion()
      return true
    } catch (error) {
      console.error('[TagStore] Failed to set file tags:', error)
      return false
    }
  }

  // 选择标签筛选
  function selectTag(tagId: number | null): void {
    selectedTagId.value = tagId
  }

  // 初始化
  async function init(): Promise<void> {
    await loadTags()
  }

  return {
    // 状态
    tags,
    selectedTagId,
    loading,
    tagLinksVersion,

    // 方法
    loadTags,
    createTag,
    updateTag,
    removeTag,
    addTagToFile,
    removeTagFromFile,
    getFileTags,
    getTagFileIds,
    setFileTags,
    selectTag,
    init
  }
})
