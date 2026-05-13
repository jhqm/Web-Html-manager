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
      </div>
      
      <div
        v-for="tag in tagStore.tags"
        :key="tag.id"
        class="tag-item"
        :class="{ active: fileStore.selectedTagIdForFilter === tag.id }"
        @click="selectTag(tag.id)"
      >
        <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
        <span class="tag-name">{{ tag.name }}</span>
        <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, tag)">
          <el-button size="small" link @click.stop>
            <MoreFilled />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="edit">编辑</el-dropdown-item>
              <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
import { ref, onMounted } from 'vue'
import { Plus, MoreFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useTagStore, type TagRecord } from '../stores/tag'
import { useFileStore } from '../stores/file'

const tagStore = useTagStore()
const fileStore = useFileStore()

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
  }
}

// 编辑标签
const showEditDialog = ref(false)
const editTagName = ref('')
const editTagColor = ref('#409EFF')
const editingTagId = ref<number | null>(null)

function handleCommand(command: string, tag: TagRecord) {
  if (command === 'edit') {
    editingTagId.value = tag.id
    editTagName.value = tag.name
    editTagColor.value = tag.color
    showEditDialog.value = true
  } else if (command === 'delete') {
    tagStore.removeTag(tag.id)
    ElMessage.success('标签已删除')
    // 如果这个标签正在筛选，清除筛选
    if (fileStore.selectedTagIdForFilter === tag.id) {
      fileStore.setTagFilter(null)
    }
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
  }
}

// 切换标签筛选
async function selectTag(tagId: number) {
  if (fileStore.selectedTagIdForFilter === tagId) {
    fileStore.setTagFilter(null)
  } else {
    fileStore.setTagFilter(tagId)
  }
  
  // 加载该标签下的文件
  if (fileStore.selectedTagIdForFilter !== null && fileStore.selectedTagIdForFilter !== -1) {
    const fileIds = await tagStore.getTagFileIds(fileStore.selectedTagIdForFilter)
    fileStore.updateTaggedFileIds(fileStore.selectedTagIdForFilter, fileIds)
  }
}
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
  background: #ecf5ff;
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
</style>