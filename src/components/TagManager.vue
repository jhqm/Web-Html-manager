<template>
  <div class="tag-manager">
    <div class="tag-header">
      <span style="font-weight: 500;">标签</span>
      <el-button size="small" link @click="showCreateDialog = true">
        <Plus /> 新建
      </el-button>
    </div>
    
    <div class="tag-list">
      <!-- 无标签选项 -->
      <div
        class="tag-item"
        :class="{ active: fileStore.selectedTagIdForFilter === -1 }"
        @click="selectTag(-1)"
      >
        <span class="tag-dot" style="background-color: #909399;"></span>
        <span class="tag-name">无标签</span>
        <span class="tag-count">{{ untaggedCount }}</span>
        <span class="tag-actions">
          <span class="tag-action-placeholder" aria-hidden="true"></span>
        </span>
      </div>
      
      <div
        v-for="tag in tagStore.tags"
        :key="tag.id"
        class="tag-item"
        :class="{ active: fileStore.selectedTagIdForFilter === tag.id, 'is-menu-open': openMenuTagId === tag.id }"
        @click="selectTag(tag.id)"
      >
        <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
        <span class="tag-name">{{ tag.name }}</span>
        <span class="tag-count">{{ tagFileCountMap[tag.id] ?? 0 }}</span>
        <span class="tag-actions">
          <span class="tag-more-slot">
            <el-dropdown class="tag-more-wrap" trigger="click" @command="(cmd: string) => handleCommand(cmd, tag)" @visible-change="(visible: boolean) => onMenuVisibleChange(tag.id, visible)">
              <el-button class="tag-more-btn" size="small" link @click.stop>
                <span class="more-dots" aria-hidden="true">
                  <i></i><i></i><i></i>
                </span>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </span>
        </span>
      </div>
      
      <div v-if="tagStore.tags.length === 0" style="color: #909399; padding: 12px; font-size: 13px;">
        暂无标签
      </div>
    </div>
    
    <!-- 创建标签对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建标签"
      width="300px"
    >
      <el-form>
        <el-form-item label="标签名称">
          <el-input v-model="newTagName" placeholder="请输入标签名称" />
        </el-form-item>
        <el-form-item label="标签颜色">
          <el-color-picker v-model="newTagColor" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createTag" :disabled="!newTagName.trim()">创建</el-button>
      </template>
    </el-dialog>
    
    <!-- 编辑标签对话框 -->
    <el-dialog
      v-model="showEditDialog"
      title="编辑标签"
      width="300px"
    >
      <el-form>
        <el-form-item label="标签名称">
          <el-input v-model="editTagName" placeholder="请输入标签名称" />
        </el-form-item>
        <el-form-item label="标签颜色">
          <el-color-picker v-model="editTagColor" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="updateTag" :disabled="!editTagName.trim()">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Plus, MoreFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTagStore, type TagRecord } from '../stores/tag'
import { useFileStore } from '../stores/file'

const tagStore = useTagStore()
const fileStore = useFileStore()

const tagFileCountMap = ref<Record<number, number>>({})
const untaggedCount = ref(0)

async function syncTagFilterMapFromStore() {
  const results = await Promise.all(
    tagStore.tags.map(async tag => ({
      id: tag.id,
      fileIds: await tagStore.getTagFileIds(tag.id)
    }))
  )

  fileStore.clearTaggedFileIdsMap()
  for (const r of results) {
    fileStore.updateTaggedFileIds(r.id, r.fileIds)
  }

  return results
}

async function refreshTagCounts() {
  try {
    const results = await syncTagFilterMapFromStore()

    const nextMap: Record<number, number> = {}
    const tagged = new Set<number>()
    for (const r of results) {
      nextMap[r.id] = r.fileIds.length
      r.fileIds.forEach(id => tagged.add(id))
    }

    tagFileCountMap.value = nextMap
    untaggedCount.value = fileStore.files.filter(f => !tagged.has(f.id)).length
  } catch {
    tagFileCountMap.value = {}
    untaggedCount.value = 0
  }
}

// 创建标签
const showCreateDialog = ref(false)
const newTagName = ref('')
const newTagColor = ref('#409EFF')

async function createTag() {
  if (!newTagName.value.trim()) return
  
  const id = await tagStore.createTag(newTagName.value.trim(), newTagColor.value)
  if (id) {
    ElMessage.success('标签创建成功')
    showCreateDialog.value = false
    newTagName.value = ''
    newTagColor.value = '#409EFF'
    await refreshTagCounts()
  }
}

// 编辑标签
const showEditDialog = ref(false)
const editTagName = ref('')
const editTagColor = ref('#409EFF')
const editingTagId = ref<number | null>(null)
const openMenuTagId = ref<number | null>(null)

function onMenuVisibleChange(tagId: number, visible: boolean) {
  if (visible) {
    openMenuTagId.value = tagId
  } else if (openMenuTagId.value === tagId) {
    openMenuTagId.value = null
  }
}

async function handleCommand(command: string, tag: TagRecord) {
  if (command === 'edit') {
    editingTagId.value = tag.id
    editTagName.value = tag.name
    editTagColor.value = tag.color
    showEditDialog.value = true
  } else if (command === 'delete') {
    try {
      await ElMessageBox.confirm(
        `确定删除标签「${tag.name}」吗？
删除后会自动从所有文件中移除该标签。`,
        '删除标签',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning',
          distinguishCancelAndClose: true
        }
      )
    } catch {
      return
    }

    const success = await tagStore.removeTag(tag.id)
    if (!success) {
      ElMessage.error('标签删除失败')
      return
    }

    ElMessage.success('标签已删除')
    // 如果这个标签正在筛选，清除筛选
    if (fileStore.selectedTagIdForFilter === tag.id) {
      fileStore.setTagFilter(null)
    }
    await refreshTagCounts()
  }
}

async function updateTag() {
  if (!editingTagId.value || !editTagName.value.trim()) return
  
  const success = await tagStore.updateTag(
    editingTagId.value,
    editTagName.value.trim(),
    editTagColor.value
  )
  
  if (success) {
    ElMessage.success('标签已更新')
    showEditDialog.value = false
    await refreshTagCounts()
  }
}

// 切换标签筛选
async function selectTag(tagId: number) {
  const nextTagId = fileStore.selectedTagIdForFilter === tagId ? null : tagId

  // 无标签筛选依赖完整标签映射，首次点击前先重建映射
  if (nextTagId === -1) {
    await syncTagFilterMapFromStore()
  }

  fileStore.setTagFilter(nextTagId)

  // 普通标签按需更新当前标签映射
  if (nextTagId !== null && nextTagId !== -1) {
    const fileIds = await tagStore.getTagFileIds(nextTagId)
    fileStore.updateTaggedFileIds(nextTagId, fileIds)
  }
}

onMounted(async () => {
  await refreshTagCounts()
})


watch(
  () => tagStore.tags.map(t => `${t.id}:${t.name}`).join('|'),
  () => { refreshTagCounts() }
)

watch(
  () => fileStore.files.map(f => f.id).join(','),
  () => { refreshTagCounts() }
)

watch(
  () => tagStore.tagLinksVersion,
  () => { refreshTagCounts() }
)

</script>

<style scoped>
.tag-manager {
  border-top: 1px solid #f0f0f0;
  padding-top: 8px;
}

.tag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px 8px;
}

.tag-list {
  max-height: 200px;
  overflow-y: auto;
}

.tag-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.tag-item:hover {
  background: #f5f7fa;
}

.tag-item.active {
  background: #dbeafe;
  border-left: 3px solid #409eff;
}

.tag-item.active .tag-name {
  color: #1d4ed8;
  font-weight: 600;
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
}

.tag-name {
  flex: 1;
  font-size: 13px;
}

.tag-count {
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 10px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  margin-left: auto;
  margin-right: 6px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tag-item.active .tag-count {
  background: #bfdbfe;
  color: #1d4ed8;
}

.tag-actions {
  width: 36px;
  height: 28px;
  margin-left: 2px;
  flex: 0 0 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tag-action-placeholder {
  width: 24px;
  height: 24px;
  display: inline-block;
}

.tag-more-slot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.tag-item:hover .tag-more-slot,
.tag-item.is-menu-open .tag-more-slot,
.tag-item.active:hover .tag-more-slot {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
}

.tag-more-wrap {
  display: inline-flex;
}

.tag-more-btn {
  width: 28px;
  height: 28px;
  min-height: 28px;
  padding: 0;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid #eef0f4;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  color: #8c93a3;
}

.tag-more-btn:hover {
  background: #ffffff;
  border-color: #dfe3eb;
  color: #6b7280;
}

.more-dots {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.more-dots i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
}


</style>