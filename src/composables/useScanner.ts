import { ref } from 'vue'
import { useFileStore } from '../stores/file'
import { ElMessage } from 'element-plus'

export interface ScanResult {
  name: string
  path: string
  relativePath: string
  size: number
  createdAt: string
  updatedAt: string
}

export function useScanner() {
  const fileStore = useFileStore()
  const scanning = ref(false)
  const scanProgress = ref({ current: 0, total: 0 })

  // 扫描单个路径
  async function scanPath(repoPath: string, recursive: boolean = true): Promise<ScanResult[]> {
    try {
      const files = await window.electronAPI.scanHtmlFiles(repoPath, recursive)
      return files
    } catch (error) {
      console.error('[Scanner] Failed to scan path:', error)
      return []
    }
  }

  // 导入扫描到的文件到数据库
  async function importFiles(files: ScanResult[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0
    let skipped = 0

    for (const file of files) {
      try {
        // 检查文件是否已存在于数据库
        const existing = await window.electronAPI.dbGetFileByPath(file.path)
        
        if (existing) {
          // 更新已有记录
          await window.electronAPI.dbUpdateFile(existing.id, {
            size: file.size,
            updated_at: file.updatedAt
          })
          skipped++
        } else {
          // 读取文件元数据
          const meta = await window.electronAPI.readFile(file.path)
          
          // 添加新记录
          await window.electronAPI.dbInsertFile({
            name: file.name,
            path: file.path,
            title: meta.title || '',
            description: meta.description || '',
            size: file.size,
            created_at: file.createdAt,
            updated_at: file.updatedAt,
            folder_id: null
          })
          imported++
        }
      } catch (error) {
        console.error('[Scanner] Failed to import file:', file.path, error)
      }
    }

    return { imported, skipped }
  }

  // 自动扫描仓库目录
  async function autoScan(silent: boolean = false): Promise<{ imported: number; skipped: number }> {
    if (!fileStore.repoPath) {
      if (!silent) ElMessage.warning('请先选择仓库目录')
      return { imported: 0, skipped: 0 }
    }

    scanning.value = true
    scanProgress.value = { current: 0, total: 0 }

    try {
      // 扫描目录下所有 HTML 文件
      const files = await scanPath(fileStore.repoPath, true)
      scanProgress.value.total = files.length

      if (files.length === 0) {
        if (!silent) ElMessage.info('未找到 HTML 文件')
        return { imported: 0, skipped: 0 }
      }

      // 导入文件
      const result = await importFiles(files)

      // 刷新文件列表
      await fileStore.loadFiles()

      if (!silent) {
        if (result.imported > 0) {
          ElMessage.success(`导入完成：新增 ${result.imported} 个文件`)
        } else {
          ElMessage.info('所有文件已是最新')
        }
      }

      return result
    } catch (error) {
      if (!silent) {
        ElMessage.error('扫描失败: ' + String(error))
      } else {
        console.error('[Scanner] Auto scan failed:', error)
      }
      return { imported: 0, skipped: 0 }
    } finally {
      scanning.value = false
      scanProgress.value = { current: 0, total: 0 }
    }
  }

  // 手动添加文件
  async function addFilesManually(): Promise<number> {
    if (!fileStore.repoPath) {
      ElMessage.warning('请先选择仓库目录')
      return 0
    }

    try {
      // 选择 HTML 文件
      const selectedFiles = await window.electronAPI.selectHtmlFiles()
      
      if (selectedFiles.length === 0) {
        return 0
      }

      let added = 0

      for (const sourcePath of selectedFiles) {
        // 复制文件到仓库目录
        const result = await window.electronAPI.copyFileToRepo(sourcePath, fileStore.repoPath)
        
        if (result.success && result.path) {
          // 读取元数据
          const meta = await window.electronAPI.readFile(result.path)
          
          // 添加到数据库
          await fileStore.addFile({
            name: result.path.split('/').pop() || '',
            path: result.path,
            title: meta.title,
            description: meta.description
          })
          
          added++
        }
      }

      if (added > 0) {
        ElMessage.success(`成功添加 ${added} 个文件`)
        await fileStore.loadFiles()
      }

      return added
    } catch (error) {
      ElMessage.error('添加文件失败: ' + String(error))
      return 0
    }
  }

  return {
    scanning,
    scanProgress,
    scanPath,
    autoScan,
    addFilesManually,
    importFiles
  }
}
