<template>
  <div id="app">
    <!-- 顶部工具栏 -->
    <div class="tool-bar">
      <div class="tool-bar-logo">📄 AI HTML Manager</div>
      
      <div class="tool-bar-search">
        <el-input
          v-model="fileStore.searchKeyword"
          placeholder="搜索文件名..."
          :prefix-icon="Search"
          clearable
        />
      </div>
      
      <div class="tool-bar-actions">
        <el-button type="primary" :icon="FolderAdd" @click="handleSelectFolder">
          {{ fileStore.repoPath ? '更换仓库' : '选择仓库' }}
        </el-button>
        <el-button :icon="Upload" @click="handleAddFiles" title="添加HTML文件">添加</el-button>
        <el-button :icon="Refresh" @click="handleAutoScan">扫描</el-button>
        <el-button :icon="Setting" @click="showSettings = true" circle />
      </div>
    </div>
    
    <!-- 主内容区 -->
    <div class="app-container">
      <!-- 左侧边栏（可折叠） -->
      <div class="sidebar" :class="{ collapsed: sidebarCollapsed }">
        <!-- 折叠按钮 -->
        <div class="sidebar-toggle" @click="sidebarCollapsed = !sidebarCollapsed">
          <el-icon v-if="sidebarCollapsed"><ArrowRight /></el-icon>
          <el-icon v-else><ArrowLeft /></el-icon>
        </div>
        
        <!-- 侧边栏内容 -->
        <div class="sidebar-content" v-show="!sidebarCollapsed">
          <!-- 文件夹 -->
          <div class="sidebar-section">
            <div class="sidebar-header">
              <span style="font-weight: 500;">文件夹</span>
            </div>
            <div class="sidebar-content-inner">
              <div class="folder-tree">
                <div
                  class="folder-item"
                  :class="{ active: fileStore.currentFolder === null }"
                  @click="fileStore.selectFolder(null)"
                >
                  <Folder class="folder-icon" />
                  <span>全部文件</span>
                </div>
                
                <div
                  v-for="folder in fileStore.folders"
                  :key="folder.id"
                  class="folder-item"
                  :class="{ active: fileStore.currentFolder === folder.id }"
                  @click="fileStore.selectFolder(folder.id)"
                >
                  <Folder class="folder-icon" />
                  <span>{{ folder.name }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 标签 -->
          <div class="sidebar-section">
            <TagManager />
          </div>
        </div>
      </div>
      
      <!-- 中间：文件列表 -->
      <div class="file-list-container">
        <div class="file-list-header">
          <span style="font-weight: 500;">文件列表 ({{ fileStore.filteredFiles.length }})</span>
          <div style="display: flex; gap: 8px;">
            <el-select v-model="fileStore.sortBy" size="small" style="width: 120px;">
              <el-option label="按更新时间" value="updated_at" />
              <el-option label="按名称" value="name" />
              <el-option label="按大小" value="size" />
            </el-select>
          </div>
        </div>
        
        <div class="file-list" v-if="fileStore.filteredFiles.length > 0">
          <div
            v-for="file in fileStore.filteredFiles"
            :key="file.id"
            class="file-item"
            :class="{ active: fileStore.currentFile?.id === file.id }"
            @click="selectFile(file)"
            @mouseenter="hoveredFileId = file.id"
            @mouseleave="hoveredFileId = null"
          >
            <div class="file-item-title">{{ file.title || file.name }}</div>
            <div class="file-item-meta">
              <span>{{ formatDate(file.updated_at) }}</span>
              <span>{{ formatSize(file.size) }}</span>
            </div>
            <!-- 文件操作按钮 -->
            <div class="file-item-actions" v-show="hoveredFileId === file.id">
              <el-dropdown trigger="click" @command="(cmd: string) => handleFileCommand(cmd, file)">
                <el-button size="small" text circle @click.stop>
                  <el-icon><More /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="'pin:' + file.id">
                      <el-icon><Star /></el-icon> {{ file.isPinned ? '取消置顶' : '置顶' }}
                    </el-dropdown-item>
                    <el-dropdown-item :command="'tag:' + file.id">
                      <el-icon><PriceTag /></el-icon> 标签管理
                    </el-dropdown-item>
                    <el-dropdown-item :command="'rename:' + file.id">
                      <el-icon><Edit /></el-icon> 重命名
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
        
        <div class="empty-state" v-else>
          <FolderOpened style="font-size: 48px;" />
          <span>{{ fileStore.repoPath ? '暂无HTML文件' : '请先选择仓库目录' }}</span>
          <el-button v-if="!fileStore.repoPath" type="primary" @click="handleSelectFolder">
            选择仓库
          </el-button>
          <el-button v-else type="primary" @click="handleAutoScan">
            扫描导入
          </el-button>
        </div>
      </div>
      
      <!-- 右侧：预览面板 -->
      <div class="preview-container">
        <div class="preview-header" v-if="fileStore.currentFile">
          <span style="font-weight: 500;">{{ fileStore.currentFile.title || fileStore.currentFile.name }}</span>
          <div class="preview-toolbar">
            <el-button size="small" @click="openExternal"><TopRight /> 外部</el-button>
            <el-button size="small" @click="toggleFullscreen"><FullScreen /> 全屏</el-button>
            <el-button size="small" type="danger" @click="showDeleteDialog = true"><Delete /> 删除</el-button>
          </div>
        </div>
        
        <div class="preview-content" v-if="fileStore.currentFile">
          <iframe ref="previewFrame" :src="'file://' + fileStore.currentFile.path" class="preview-iframe"></iframe>
        </div>
        
        <div class="preview-empty" v-else>
          <Document style="font-size: 64px;" />
          <span>选择文件进行预览</span>
        </div>
      </div>
    </div>
    
    <!-- 底部：版本历史 -->
    <div class="version-panel" v-if="fileStore.currentFile" v-show="showVersionPanel">
      <div class="version-header">
        <span style="font-weight: 500;">版本历史</span>
        <div style="display: flex; gap: 8px;">
          <el-button size="small" @click="createSnapshot"><Camera /> 创建快照</el-button>
          <el-button size="small" circle :icon="Fold" @click="showVersionPanel = false" />
        </div>
      </div>
      
      <div class="version-list">
        <div
          v-for="(version, index) in versionStore.versions"
          :key="version.id"
          class="version-item"
          :class="{ 'is-previewing': previewingVersionId === version.id }"
          @click="previewVersion(version)"
        >
          <div class="version-info">
            <span class="version-number">v{{ versionStore.versions.length - index }}</span>
            <span class="version-time">{{ formatDate(version.snapshot_at) }}</span>
          </div>
          <div class="version-actions">
            <el-button size="small" type="primary" link @click.stop="restoreVersion(version)">恢复此版本</el-button>
          </div>
        </div>
        
        <div v-if="versionStore.versions.length === 0" style="color: #909399; padding: 20px; text-align: center;">
          暂无版本记录
        </div>
      </div>
    </div>
    
    <!-- 展开版本按钮 -->
    <div v-if="fileStore.currentFile && !showVersionPanel" class="version-expand" @click="showVersionPanel = true">
      <CaretTop /> 版本历史
    </div>
    
    <!-- 版本回滚确认 -->
    <el-dialog v-model="showRestoreDialog" title="确认恢复版本" width="400px">
      <p>确定要恢复到此版本吗？</p>
      <p style="color: #909399; font-size: 12px;">当前文件将被此版本覆盖，建议先创建快照备份。</p>
      <template #footer>
        <el-button @click="showRestoreDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmRestore" :loading="restoring">确认恢复</el-button>
      </template>
    </el-dialog>
    
    <!-- 文件删除确认 -->
    <el-dialog v-model="showDeleteDialog" title="确认删除文件" width="400px">
      <p>确定要删除此文件吗？</p>
      <p style="color: #909399; font-size: 12px;">文件记录将被删除，版本快照将保留。</p>
      <template #footer>
        <el-button @click="showDeleteDialog = false">取消</el-button>
        <el-button type="danger" @click="confirmDelete" :loading="deleting">确认删除</el-button>
      </template>
    </el-dialog>
    
    <!-- 标签管理弹窗 -->
    <el-dialog v-model="showTagDialog" title="标签管理" width="400px">
      <el-select v-model="selectedTags" multiple placeholder="选择标签" style="width: 100%;">
        <el-option
          v-for="tag in tagStore.tags"
          :key="tag.id"
          :label="tag.name"
          :value="tag.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="showTagDialog = false">取消</el-button>
        <el-button type="primary" @click="handleTagSubmit">确定</el-button>
      </template>
    </el-dialog>
    
    <!-- 重命名弹窗 -->
    <el-dialog v-model="showRenameDialog" title="重命名文件" width="400px">
      <el-input v-model="renameTitle" placeholder="请输入文件标题" />
      <template #footer>
        <el-button @click="showRenameDialog = false">取消</el-button>
        <el-button type="primary" @click="handleRenameSubmit">确定</el-button>
      </template>
    </el-dialog>
    
    <!-- 设置面板 -->
    <el-drawer v-model="showSettings" title="设置" size="350px" direction="rtl">
      <div class="settings-content">
        <el-form label-position="top">
          <el-form-item label="仓库目录">
            <div style="display: flex; gap: 8px;">
              <el-input :value="fileStore.repoPath" readonly placeholder="请选择仓库目录" />
              <el-button @click="changeRepoPath">更改</el-button>
            </div>
          </el-form-item>
          <el-form-item label="版本快照">
            <el-switch v-model="autoSnapshot" active-text="自动创建快照" />
          </el-form-item>
        </el-form>
        
        <el-divider />
        
        <div class="about-section">
          <h4>关于</h4>
          <p>AI HTML Asset Manager</p>
          <p style="color: #909399; font-size: 12px;">版本 1.0.0</p>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Search, Folder, FolderAdd, Refresh, Setting, FolderOpened, Document, TopRight, FullScreen, Camera, Fold, CaretTop, Delete, Upload, ArrowLeft, ArrowRight, More, Star, PriceTag, Edit } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useFileStore } from './stores/file'
import { useTagStore } from './stores/tag'
import { useVersionStore } from './stores/version'
import { useScanner } from './composables/useScanner'
import TagManager from './components/TagManager.vue'

const fileStore = useFileStore()
const tagStore = useTagStore()
const versionStore = useVersionStore()
const scanner = useScanner()

const previewFrame = ref<HTMLIFrameElement | null>(null)
const showVersionPanel = ref(false)
const previewingVersionId = ref<number | null>(null)
const showRestoreDialog = ref(false)
const restoring = ref(false)
const versionToRestore = ref<{ id: number; version_path: string } | null>(null)
const showDeleteDialog = ref(false)
const deleting = ref(false)
const showSettings = ref(false)
const autoSnapshot = ref(true)

// 侧边栏折叠状态
const sidebarCollapsed = ref(false)

// 鼠标悬停的文件ID
const hoveredFileId = ref<number | null>(null)

// 当前编辑的文件（用于标签和重命名）
const currentEditingFile = ref<any>(null)

// 标签管理相关
const showTagDialog = ref(false)
const selectedTags = ref<number[]>([])

// 重命名相关
const showRenameDialog = ref(false)
const renameTitle = ref('')

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function handleSelectFolder() {
  const path = await window.electronAPI.selectFolder()
  if (path) {
    fileStore.setRepoPath(path)
    await window.electronAPI.dbSetSetting('repoPath', path)
    await fileStore.loadFiles()
    await fileStore.loadFolders()
    await scanner.autoScan()
  }
}

async function changeRepoPath() {
  await handleSelectFolder()
}

async function handleAddFiles() {
  await scanner.addFilesManually()
}

async function handleAutoScan() {
  await scanner.autoScan()
}

async function selectFile(file: typeof fileStore.currentFile) {
  if (!file) return
  if (fileStore.currentFile) await createSnapshotIfNeeded()
  fileStore.selectFile(file)
  if (file.id) await versionStore.loadVersions(file.id)
}

async function createSnapshot() {
  if (!fileStore.currentFile || !fileStore.repoPath) return
  const versionsDir = fileStore.repoPath + '/.versions'
  const result = await window.electronAPI.createSnapshot(fileStore.currentFile.path, versionsDir)
  if (result.success && fileStore.currentFile.id) {
    await versionStore.createVersion(fileStore.currentFile.id, result.snapshotPath!)
    ElMessage.success('快照创建成功')
  } else {
    ElMessage.error('快照创建失败')
  }
}

async function createSnapshotIfNeeded() {
  if (fileStore.currentFile && fileStore.repoPath && versionStore.versions.length === 0 && autoSnapshot.value) {
    await createSnapshot()
  }
}

function previewVersion(version: { id: number; version_path: string }) {
  if (previewFrame.value) {
    previewingVersionId.value = version.id
    previewFrame.value.src = 'file://' + version.version_path
  }
}

function restoreVersion(version: { id: number; version_path: string }) {
  versionToRestore.value = version
  showRestoreDialog.value = true
}

async function confirmRestore() {
  if (!versionToRestore.value || !fileStore.currentFile) return
  restoring.value = true
  try {
    await createSnapshot()
    const result = await window.electronAPI.restoreVersion(versionToRestore.value.version_path, fileStore.currentFile.path)
    if (result.success) {
      ElMessage.success('版本恢复成功')
      showRestoreDialog.value = false
      if (previewFrame.value) previewFrame.value.src = 'file://' + fileStore.currentFile.path
      await fileStore.loadFiles()
    } else {
      ElMessage.error('版本恢复失败')
    }
  } catch (e) {
    ElMessage.error('版本恢复失败')
  } finally {
    restoring.value = false
    versionToRestore.value = null
  }
}

async function confirmDelete() {
  if (!fileStore.currentFile) return
  deleting.value = true
  try {
    const success = await fileStore.removeFile(fileStore.currentFile.id)
    if (success) {
      ElMessage.success('文件已删除')
      showDeleteDialog.value = false
      if (previewFrame.value) previewFrame.value.src = 'about:blank'
    } else {
      ElMessage.error('文件删除失败')
    }
  } finally {
    deleting.value = false
  }
}

async function openExternal() {
  if (!fileStore.currentFile) return
  await window.electronAPI.openExternal('file://' + fileStore.currentFile.path)
}

function toggleFullscreen() {
  if (!previewFrame.value) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    previewFrame.value.requestFullscreen()
  }
}

async function handleFileCommand(command: string, file: any) {
  const [action, fileId] = command.split(':')
  currentEditingFile.value = file
  
  switch (action) {
    case 'pin':
      fileStore.togglePin(parseInt(fileId))
      break
    case 'tag':
      tagStore.getFileTags(file.id).then(tags => {
        selectedTags.value = tags.map((t: any) => t.id)
      })
      showTagDialog.value = true
      break
    case 'rename':
      renameTitle.value = file.title || file.name
      showRenameDialog.value = true
      break
  }
}

async function handleTagSubmit() {
  if (currentEditingFile.value) {
    await tagStore.setFileTags(currentEditingFile.value.id, selectedTags.value)
    ElMessage.success('标签更新成功')
  }
  showTagDialog.value = false
}

async function handleRenameSubmit() {
  if (currentEditingFile.value) {
    await fileStore.updateFile(currentEditingFile.value.id, { title: renameTitle.value } as any)
    ElMessage.success('重命名成功')
  }
  showRenameDialog.value = false
}

onMounted(async () => {
  await fileStore.init()
  await tagStore.init()
})
</script>

<style scoped>
/* 侧边栏折叠样式 */
.sidebar {
  position: relative;
  width: 220px;
  min-width: 220px;
  background: #fafafa;
  border-right: 1px solid #e4e7ed;
  transition: all 0.3s ease;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 40px;
  min-width: 40px;
}

.sidebar-toggle {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  width: 20px;
  height: 40px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-right: none;
  border-radius: 4px 0 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s;
}

.sidebar-toggle:hover {
  background: #ecf5ff;
  color: var(--primary-color);
}

.sidebar-content {
  padding-right: 20px;
}

.sidebar-content-inner {
  padding: 0 8px;
}

.sidebar-section { border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; }
.sidebar-section:last-child { border-bottom: none; }

/* 文件卡片操作按钮 */
.file-item {
  position: relative;
  cursor: pointer;
}

.file-item-actions {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
}

/* 下拉菜单样式，确保相对于触发器定位 */
.file-actions-dropdown {
  position: absolute !important;
  left: auto !important;
  right: auto !important;
}

.file-actions-dropdown.el-popper[data-popper-placement^="bottom-start"] {
  left: auto !important;
  right: 0 !important;
}

/* 版本相关样式 */
.version-expand {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  padding: 8px 24px;
  border: 1px solid #e4e7ed;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #606266;
  transition: all 0.2s;
  z-index: 100;
}

.version-expand:hover { color: var(--primary-color); }

.version-item {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.2s;
}

.version-item:hover { background: #f5f7fa; }
.version-item.is-previewing { background: #ecf5ff; border-left: 3px solid var(--primary-color); }

.version-info { display: flex; align-items: center; gap: 12px; }
.version-number { font-weight: 600; color: var(--primary-color); }
.version-time { color: #909399; font-size: 12px; }
.version-actions { margin-top: 8px; }

.settings-content { padding: 0 16px; }
.about-section { margin-top: 20px; }
.about-section h4 { margin-bottom: 8px; }
</style>