<template>
  <div id="app">
    <!-- 顶部工具栏 -->
    <div class="tool-bar">
      <div class="tool-bar-logo">📄 AI HTML Manager</div>
      
      <div class="tool-bar-search">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索文件名..."
          :prefix-icon="Search"
          clearable
          @input="handleSearch"
        />
      </div>
      
      <div class="tool-bar-actions">
        <el-button type="primary" :icon="FolderAdd" @click="handleSelectFolder">
          {{ repoPath ? '更换仓库' : '选择仓库' }}
        </el-button>
        <el-button :icon="Refresh" @click="refreshFiles">刷新</el-button>
        <el-button :icon="Setting" circle />
      </div>
    </div>
    
    <!-- 主内容区 -->
    <div class="app-container">
      <!-- 左侧边栏：文件夹树 -->
      <div class="sidebar">
        <div class="sidebar-header">
          <span style="font-weight: 500;">文件夹</span>
        </div>
        <div class="sidebar-content">
          <div class="folder-tree">
            <div
              class="folder-item"
              :class="{ active: currentFolder === repoPath }"
              @click="selectFolder(repoPath)"
            >
              <Folder class="folder-icon" />
              <span>全部文件</span>
            </div>
            
            <div
              v-for="folder in folderList"
              :key="folder.path"
              class="folder-item"
              :class="{ active: currentFolder === folder.path }"
              @click="selectFolder(folder.path)"
            >
              <Folder class="folder-icon" />
              <span>{{ folder.name }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 中间：文件列表 -->
      <div class="file-list-container">
        <div class="file-list-header">
          <span style="font-weight: 500;">文件列表 ({{ filteredFiles.length }})</span>
          <div style="display: flex; gap: 8px;">
            <el-select v-model="sortBy" size="small" style="width: 120px;">
              <el-option label="按更新时间" value="updatedAt" />
              <el-option label="按名称" value="name" />
              <el-option label="按大小" value="size" />
            </el-select>
          </div>
        </div>
        
        <div class="file-list" v-if="filteredFiles.length > 0">
          <div
            v-for="file in filteredFiles"
            :key="file.path"
            class="file-item"
            :class="{ active: currentFile?.path === file.path }"
            @click="selectFile(file)"
          >
            <div class="file-item-title">{{ file.title || file.name }}</div>
            <div class="file-item-meta">
              <span>{{ formatDate(file.updatedAt) }}</span>
              <span>{{ formatSize(file.size) }}</span>
            </div>
          </div>
        </div>
        
        <div class="empty-state" v-else>
          <FolderOpened style="font-size: 48px;" />
          <span>{{ repoPath ? '暂无HTML文件' : '请先选择仓库目录' }}</span>
          <el-button v-if="!repoPath" type="primary" @click="handleSelectFolder">
            选择仓库
          </el-button>
        </div>
      </div>
      
      <!-- 右侧：预览面板 -->
      <div class="preview-container">
        <div class="preview-header" v-if="currentFile">
          <span style="font-weight: 500;">{{ currentFile.title || currentFile.name }}</span>
          <div class="preview-toolbar">
            <el-button size="small" @click="openExternal">
              <TopRight /> 外部打开
            </el-button>
            <el-button size="small" @click="toggleFullscreen">
              <FullScreen /> 全屏
            </el-button>
          </div>
        </div>
        
        <div class="preview-content" v-if="currentFile">
          <iframe
            ref="previewFrame"
            :src="currentFile.path"
            class="preview-iframe"
          ></iframe>
        </div>
        
        <div class="preview-empty" v-else>
          <Document style="font-size: 64px;" />
          <span>选择文件进行预览</span>
        </div>
      </div>
    </div>
    
    <!-- 底部：版本历史 -->
    <div class="version-panel" v-if="currentFile" v-show="showVersionPanel">
      <div class="version-header">
        <span style="font-weight: 500;">版本历史</span>
        <div style="display: flex; gap: 8px;">
          <el-button size="small" @click="createSnapshot">
            <Camera /> 创建快照
          </el-button>
          <el-button size="small" circle :icon="Fold" @click="showVersionPanel = false" />
        </div>
      </div>
      
      <div class="version-list">
        <div
          v-for="(version, index) in versions"
          :key="version.path"
          class="version-item"
          @click="previewVersion(version)"
        >
          <div>v{{ versions.length - index }}</div>
          <div style="color: #909399; margin-top: 4px;">{{ formatDate(version.createdAt) }}</div>
        </div>
        
        <div v-if="versions.length === 0" style="color: #909399;">
          暂无版本记录
        </div>
      </div>
    </div>
    
    <!-- 展开版本按钮 -->
    <div
      v-if="currentFile && !showVersionPanel"
      class="version-expand"
      @click="showVersionPanel = true"
    >
      <CaretTop /> 版本历史
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Search, Folder, FolderAdd, Refresh, Setting, FolderOpened,
  Document, TopRight, FullScreen, Camera, Fold, CaretTop
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// 状态
const repoPath = ref<string>('')
const currentFolder = ref<string>('')
const folderList = ref<Array<{ name: string; path: string; parentPath: string }>>([])
const fileList = ref<Array<{
  name: string
  path: string
  size: number
  createdAt: string
  updatedAt: string
  title?: string
}>>([])
const currentFile = ref<{
  name: string
  path: string
  size: number
  createdAt: string
  updatedAt: string
  title?: string
} | null>(null)
const searchKeyword = ref('')
const sortBy = ref('updatedAt')
const versions = ref<Array<{ name: string; path: string; createdAt: string }>>([])
const showVersionPanel = ref(false)

// 计算属性：排序后的文件列表
const filteredFiles = computed(() => {
  let files = [...fileList.value]
  
  // 过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    files = files.filter(file =>
      file.name.toLowerCase().includes(keyword) ||
      file.title?.toLowerCase().includes(keyword)
    )
  }
  
  // 排序
  files.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'size':
        return b.size - a.size
      case 'updatedAt':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }
  })
  
  return files
})

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 选择仓库目录
async function handleSelectFolder() {
  const path = await window.electronAPI.selectFolder()
  if (path) {
    repoPath.value = path
    currentFolder.value = path
    localStorage.setItem('repoPath', path)
    await loadFiles()
    await loadFolders()
  }
}

// 加载文件
async function loadFiles() {
  if (!repoPath.value) return
  
  const result = await window.electronAPI.readDirectory(repoPath.value)
  
  // 读取每个文件的title
  const filesWithMeta = await Promise.all(
    result.files.map(async (file) => {
      const meta = await window.electronAPI.readFile(file.path)
      return {
        ...file,
        title: meta.title
      }
    })
  )
  
  fileList.value = filesWithMeta
}

// 加载文件夹
async function loadFolders() {
  if (!repoPath.value) return
  
  const folders = await window.electronAPI.getAllFolders(repoPath.value)
  folderList.value = folders
}

// 选择文件夹
async function selectFolder(path: string) {
  currentFolder.value = path
  
  const result = await window.electronAPI.readDirectory(path)
  
  const filesWithMeta = await Promise.all(
    result.files.map(async (file) => {
      const meta = await window.electronAPI.readFile(file.path)
      return {
        ...file,
        title: meta.title
      }
    })
  )
  
  fileList.value = filesWithMeta
}

// 选择文件
async function selectFile(file: typeof currentFile.value) {
  if (!file) return
  
  // 先创建快照（如果有的话）
  if (currentFile.value) {
    await createSnapshotIfNeeded()
  }
  
  currentFile.value = file
  
  // 加载版本历史
  await loadVersions()
}

// 加载版本历史
async function loadVersions() {
  if (!currentFile.value || !repoPath.value) return
  
  const versionsDir = repoPath.value + '/.versions'
  const versionList = await window.electronAPI.getVersions(versionsDir, currentFile.value.name)
  versions.value = versionList
}

// 创建快照
async function createSnapshot() {
  if (!currentFile.value || !repoPath.value) return
  
  const versionsDir = repoPath.value + '/.versions'
  const result = await window.electronAPI.createSnapshot(currentFile.value.path, versionsDir)
  
  if (result.success) {
    ElMessage.success('快照创建成功')
    await loadVersions()
  } else {
    ElMessage.error('快照创建失败')
  }
}

// 需要时创建快照（文件修改后）
async function createSnapshotIfNeeded() {
  // 简单实现：每次选择新文件前创建快照
  if (currentFile.value && repoPath.value && versions.value.length === 0) {
    await createSnapshot()
  }
}

// 预览版本
function previewVersion(version: { path: string }) {
  if (previewFrame.value) {
    previewFrame.value.src = version.path
  }
}

// 外部打开
async function openExternal() {
  if (!currentFile.value) return
  await window.electronAPI.openExternal('file://' + currentFile.value.path)
}

// 全屏预览
function toggleFullscreen() {
  if (!previewFrame.value) return
  
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    previewFrame.value.requestFullscreen()
  }
}

// 刷新
async function refreshFiles() {
  await loadFiles()
  await loadFolders()
}

// 搜索
function handleSearch() {
  // 搜索已经在计算属性中实现
}

// 预览iframe引用
const previewFrame = ref<HTMLIFrameElement | null>(null)

// 初始化
onMounted(async () => {
  // 恢复上次选择的仓库
  const savedPath = localStorage.getItem('repoPath')
  if (savedPath) {
    repoPath.value = savedPath
    currentFolder.value = savedPath
    await loadFiles()
    await loadFolders()
  }
})
</script>

<style scoped>
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
}

.version-expand:hover {
  color: var(--primary-color);
}
</style>