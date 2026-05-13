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
                  <el-icon class="folder-icon"><Folder /></el-icon>
                  <span>全部文件</span>
                </div>
                
                <div
                  v-for="folder in fileStore.folders"
                  :key="folder.id"
                  class="folder-item"
                  :class="{ active: fileStore.currentFolder === folder.id }"
                  @click="fileStore.selectFolder(folder.id)"
                >
                  <el-icon class="folder-icon"><Folder /></el-icon>
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
            class="file-item-wrapper"
            :class="{ 'swiping': swipingFileId === file.id, 'swiped': swipedFileId === file.id }"
          >
            <!-- 左滑后显示的置顶按钮 -->
            <div class="swipe-action" @click="handleSwipePin(file)">
              <el-icon><Star /></el-icon>
              <span>{{ file.is_pinned === 1 ? '取消置顶' : '置顶' }}</span>
            </div>

            <div
              class="file-item"
              :class="{ active: fileStore.currentFile?.id === file.id, 'is-dropdown-open': openDropdownId === file.id, 'is-pinned': file.is_pinned === 1 }"
              :style="swipingFileId === file.id ? { transform: `translateX(${swipeOffset}px)` } : {}"
              @click="selectFile(file)"
              @mousedown="onSwipeStart($event, file.id)"
              @touchstart="onSwipeStart($event, file.id)"
              @wheel="onSwipeWheel($event, file.id)"
            >
              <div class="file-item-title">{{ file.title || file.name }}</div>
              <div class="file-item-meta">
                <span>{{ formatDate(file.updated_at) }}</span>
                <span>{{ formatSize(file.size) }}</span>
              </div>

              <!-- 置顶星标（右上角） -->
              <el-icon v-if="file.is_pinned === 1" class="pin-badge"><StarFilled /></el-icon>

              <!-- 文件操作按钮 -->
              <div class="file-item-actions">
                <el-dropdown
                  trigger="click"
                  @command="(cmd: string) => handleFileCommand(cmd, file)"
                  @visible-change="(visible: boolean) => onDropdownVisibleChange(file.id, visible)"
                >
                  <el-button size="small" text circle @click.stop>
                    <el-icon><More /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :command="'pin:' + file.id">
                        <el-icon><Star /></el-icon> {{ file.is_pinned === 1 ? '取消置顶' : '置顶' }}
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
import { Search, Folder, FolderAdd, Refresh, Setting, FolderOpened, Document, TopRight, FullScreen, Camera, Fold, CaretTop, Delete, Upload, ArrowLeft, ArrowRight, More, Star, StarFilled, PriceTag, Edit } from '@element-plus/icons-vue'
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

// 当前打开下拉菜单的文件ID
const openDropdownId = ref<number | null>(null)

// 滑动置顶状态
const swipingFileId = ref<number | null>(null)
const swipedFileId = ref<number | null>(null)
const swipeOffset = ref(0)
const SWIPE_THRESHOLD = 80
const SWIPE_MAX = 100

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

// 下拉菜单显示/隐藏时更新状态
function onDropdownVisibleChange(fileId: number, visible: boolean) {
  if (visible) {
    openDropdownId.value = fileId
  } else if (openDropdownId.value === fileId) {
    openDropdownId.value = null
  }
}

// ===== 滑动置顶手势 =====
let swipeStartX = 0
let swipeStartY = 0
let swipeDragging = false
let swipeMoved = false

function onSwipeStart(e: MouseEvent | TouchEvent, fileId: number) {
  if (e instanceof MouseEvent && e.button !== 0) return
  const point = 'touches' in e ? e.touches[0] : e
  swipeStartX = point.clientX
  swipeStartY = point.clientY
  swipeDragging = true
  swipeMoved = false

  if (swipedFileId.value !== null && swipedFileId.value !== fileId) {
    swipedFileId.value = null
  }

  swipingFileId.value = fileId
  swipeOffset.value = swipedFileId.value === fileId ? -SWIPE_MAX : 0

  document.addEventListener('mousemove', onSwipeMove)
  document.addEventListener('mouseup', onSwipeEnd)
  document.addEventListener('touchmove', onSwipeMove, { passive: false })
  document.addEventListener('touchend', onSwipeEnd)
}

function onSwipeMove(e: MouseEvent | TouchEvent) {
  if (!swipeDragging || swipingFileId.value === null) return
  const point = 'touches' in e ? e.touches[0] : e
  const dx = point.clientX - swipeStartX
  const dy = point.clientY - swipeStartY

  if (!swipeMoved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
    cancelSwipe()
    return
  }

  if (Math.abs(dx) > 5) {
    swipeMoved = true
    if (e.cancelable) e.preventDefault()
  }

  const base = swipedFileId.value === swipingFileId.value ? -SWIPE_MAX : 0
  let offset = base + dx
  if (offset > 0) offset = 0
  if (offset < -SWIPE_MAX) offset = -SWIPE_MAX
  swipeOffset.value = offset
}

function onSwipeEnd() {
  document.removeEventListener('mousemove', onSwipeMove)
  document.removeEventListener('mouseup', onSwipeEnd)
  document.removeEventListener('touchmove', onSwipeMove)
  document.removeEventListener('touchend', onSwipeEnd)

  if (!swipeDragging || swipingFileId.value === null) {
    swipeDragging = false
    return
  }

  const fileId = swipingFileId.value
  if (-swipeOffset.value >= SWIPE_THRESHOLD) {
    swipedFileId.value = fileId
  } else {
    if (swipedFileId.value === fileId) swipedFileId.value = null
  }

  swipingFileId.value = null
  swipeOffset.value = 0
  swipeDragging = false

  if (swipeMoved) {
    const blocker = (ev: MouseEvent) => {
      ev.stopPropagation()
      ev.preventDefault()
      window.removeEventListener('click', blocker, true)
    }
    window.addEventListener('click', blocker, true)
  }
}

function cancelSwipe() {
  swipingFileId.value = null
  swipeOffset.value = 0
  swipeDragging = false
  document.removeEventListener('mousemove', onSwipeMove)
  document.removeEventListener('mouseup', onSwipeEnd)
  document.removeEventListener('touchmove', onSwipeMove)
  document.removeEventListener('touchend', onSwipeEnd)
}

// 触控板二指水平拖动（wheel 事件）
const wheelAccum = ref<{ id: number | null; offset: number; timer: number | null }>({ id: null, offset: 0, timer: null })

function onSwipeWheel(e: WheelEvent, fileId: number) {
  // 仅处理水平方向比纵向大的事件，且必须有水平分量
  // macOS 触控板二指横扫会持续派发带 deltaX 的 wheel 事件
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
  if (e.deltaX === 0) return

  e.preventDefault()
  e.stopPropagation()

  // 切到不同卡片时重置
  if (wheelAccum.value.id !== fileId) {
    if (swipedFileId.value !== null && swipedFileId.value !== fileId) {
      swipedFileId.value = null
    }
    wheelAccum.value.id = fileId
    wheelAccum.value.offset = swipedFileId.value === fileId ? -SWIPE_MAX : 0
  }

  // 累加偏移：deltaX > 0 表示向右滚（卡片应右移→收起），deltaX < 0 表示向左
  wheelAccum.value.offset -= e.deltaX
  if (wheelAccum.value.offset > 0) wheelAccum.value.offset = 0
  if (wheelAccum.value.offset < -SWIPE_MAX) wheelAccum.value.offset = -SWIPE_MAX

  swipingFileId.value = fileId
  swipeOffset.value = wheelAccum.value.offset

  // 防抖：停止滚动一段时间后吸附
  if (wheelAccum.value.timer !== null) clearTimeout(wheelAccum.value.timer)
  wheelAccum.value.timer = window.setTimeout(() => {
    if (-wheelAccum.value.offset >= SWIPE_THRESHOLD) {
      swipedFileId.value = fileId
    } else {
      if (swipedFileId.value === fileId) swipedFileId.value = null
    }
    swipingFileId.value = null
    swipeOffset.value = 0
    wheelAccum.value.id = null
    wheelAccum.value.offset = 0
    wheelAccum.value.timer = null
  }, 150)
}

async function handleSwipePin(file: any) {
  const wasPinned = file.is_pinned === 1
  await fileStore.togglePin(file.id)
  ElMessage.success(wasPinned ? '已取消置顶' : '已置顶')
  swipedFileId.value = null
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

/* 文件夹图标明确尺寸，防止被压扁/消失 */
.folder-item .folder-icon {
  font-size: 16px;
  width: 16px;
  height: 16px;
  margin-right: 8px;
  flex-shrink: 0;
}

/* 文件卡片包装层（用于左滑显示置顶按钮） */
.file-item-wrapper {
  position: relative;
  margin-bottom: 8px;
  overflow: hidden;
  border-radius: 8px;
}

/* 左滑后显露的置顶按钮 */
.swipe-action {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100px;
  background: linear-gradient(135deg, #f7b731, #f59e0b);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}

.swipe-action .el-icon {
  font-size: 20px;
}

/* 文件卡片操作按钮 */
.file-item {
  position: relative;
  cursor: pointer;
  margin-bottom: 0 !important; /* 覆盖全局样式中的 margin，由 wrapper 控制 */
  background: #fff;
  will-change: transform;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* 正在拖动时禁用过渡，跟手 */
.file-item-wrapper.swiping .file-item {
  transition: none;
}

/* 已滑开状态 */
.file-item-wrapper.swiped .file-item {
  transform: translateX(-100px);
}

/* 置顶文件的视觉强化 */
.file-item.is-pinned {
  background: linear-gradient(to right, #fffbeb 0%, #fff 40%);
  border-color: #fde68a;
}

/* 置顶星标 */
.pin-badge {
  position: absolute;
  top: 10px;
  right: 40px;
  color: #f59e0b;
  font-size: 16px;
  filter: drop-shadow(0 1px 1px rgba(245, 158, 11, 0.3));
}

.file-item-actions {
  position: absolute;
  right: 8px;
  top: 8px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.file-item:hover .file-item-actions,
.file-item.is-dropdown-open .file-item-actions {
  opacity: 1;
  pointer-events: auto;
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
