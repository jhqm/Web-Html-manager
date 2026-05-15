import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

// 获取用户数据目录
function getUserDataPath(): string {
  const userDataPath = app.getPath('userData')
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }
  return userDataPath
}

// 获取数据库路径
function getDbPath(): string {
  return path.join(getUserDataPath(), 'html-manager.db')
}

// 数据库实例
let db: Database.Database | null = null

// 初始化数据库
export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDbPath()
  console.log('[Database] Initializing at:', dbPath)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // 创建数据表
  createTables()

  console.log('[Database] Initialization complete')
  return db
}

// 创建数据表
function createTables(): void {
  if (!db) return

  // 文件表
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT UNIQUE NOT NULL,
      title TEXT DEFAULT '',
      description TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      folder_id INTEGER,
      is_pinned INTEGER DEFAULT 0,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    )
  `)

  // 迁移：添加 is_pinned 列（如果不存在）
  try {
    db.exec(`ALTER TABLE files ADD COLUMN is_pinned INTEGER DEFAULT 0`)
  } catch (e) {
    // 列已存在，忽略
  }

  // 文件夹表
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      path TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
    )
  `)

  // 版本表
  db.exec(`
    CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      version_path TEXT NOT NULL,
      snapshot_at TEXT NOT NULL,
      remark TEXT DEFAULT '',
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `)

  // 标签表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#409EFF'
    )
  `)

  // 文件标签关联表
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_tags (
      file_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (file_id, tag_id),
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `)

  // 设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // 数据修正：早期 Windows 版本曾把完整路径写入 name 字段，统一修正为纯文件名
  try {
    const dirty = db.prepare(
      `SELECT id, path FROM files WHERE name LIKE '%/%' OR name LIKE '%\\%'`
    ).all() as Array<{ id: number; path: string }>
    if (dirty.length > 0) {
      const fix = db.prepare('UPDATE files SET name = ? WHERE id = ?')
      const tx = db.transaction((rows: Array<{ id: number; path: string }>) => {
        for (const r of rows) {
          const base = (r.path || '').split(/[/\\]/).pop() || ''
          if (base) fix.run(base, r.id)
        }
      })
      tx(dirty)
      console.log(`[Database] Repaired ${dirty.length} files.name records`)
    }
  } catch (e) {
    console.warn('[Database] name repair skipped:', e)
  }

  console.log('[Database] Tables created')
}

// 获取数据库实例
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase()
  }
  return db
}

// 关闭数据库
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('[Database] Closed')
  }
}

// ============ 文件操作 ============

export interface FileRecord {
  id?: number
  name: string
  path: string
  title?: string
  description?: string
  size?: number
  created_at?: string
  updated_at?: string
  folder_id?: number | null
  is_pinned?: number
}

export function insertFile(file: FileRecord): number {
  const database = getDatabase()
  const now = new Date().toISOString()
  
  const stmt = database.prepare(`
    INSERT INTO files (name, path, title, description, size, created_at, updated_at, folder_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  const result = stmt.run(
    file.name,
    file.path,
    file.title || '',
    file.description || '',
    file.size || 0,
    file.created_at || now,
    file.updated_at || now,
    file.folder_id ?? null
  )
  
  return result.lastInsertRowid as number
}

export function updateFile(id: number, file: Partial<FileRecord>): boolean {
  const database = getDatabase()
  const fields: string[] = []
  const values: any[] = []
  
  if (file.name !== undefined) { fields.push('name = ?'); values.push(file.name) }
  if (file.path !== undefined) { fields.push('path = ?'); values.push(file.path) }
  if (file.title !== undefined) { fields.push('title = ?'); values.push(file.title) }
  if (file.description !== undefined) { fields.push('description = ?'); values.push(file.description) }
  if (file.size !== undefined) { fields.push('size = ?'); values.push(file.size) }
  if (file.updated_at !== undefined) { fields.push('updated_at = ?'); values.push(file.updated_at) }
  if (file.folder_id !== undefined) { fields.push('folder_id = ?'); values.push(file.folder_id) }
  if (file.is_pinned !== undefined) { fields.push('is_pinned = ?'); values.push(file.is_pinned) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const stmt = database.prepare(`UPDATE files SET ${fields.join(', ')} WHERE id = ?`)
  const result = stmt.run(...values)
  
  return result.changes > 0
}

export function deleteFile(id: number): boolean {
  const database = getDatabase()
  const stmt = database.prepare('DELETE FROM files WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

export function deleteFileByPath(filePath: string): boolean {
  const database = getDatabase()
  const stmt = database.prepare('DELETE FROM files WHERE path = ?')
  const result = stmt.run(filePath)
  return result.changes > 0
}

export function getFileByPath(filePath: string): FileRecord | null {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM files WHERE path = ?')
  return stmt.get(filePath) as FileRecord | null
}

export function getFileById(id: number): FileRecord | null {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM files WHERE id = ?')
  return stmt.get(id) as FileRecord | null
}

export function getAllFiles(): FileRecord[] {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM files ORDER BY updated_at DESC')
  return stmt.all() as FileRecord[]
}

/**
 * 按仓库根路径前缀查询文件。
 *
 * 设计意图：
 * - 切换仓库时，只在视图层面"按路径身份"展示当前仓库下的文件；
 * - 原仓库的记录（含标签关联、版本、置顶等）保留在库中，切换回原仓库后可恢复显示；
 * - 通过 SQL 前缀过滤一次性命中，避免在渲染进程做大集合差集，减少抖动与卡顿。
 *
 * 跨平台路径规范化：
 * - Windows 上 path.join 返回反斜杠分隔的路径（如 C:\foo\bar），
 *   但 LIKE 中反斜杠是转义符，会导致匹配失败；
 * - 因此先将 repoPath 和数据库中的路径统一替换为正斜杠再做比较，
 *   避免反斜杠转义问题，同时兼容 macOS/Windows。
 */
export function getFilesByRepoPath(repoPath: string): FileRecord[] {
  const database = getDatabase()
  if (!repoPath) return []

  // 规范化：去除末尾分隔符，统一为正斜杠
  const normalized = repoPath.replace(/[\\/]+$/, '').replace(/\\/g, '/')
  const escaped = normalized.replace(/%/g, '\\%').replace(/_/g, '\\_')
  const likePattern = `${escaped}/%`

  const stmt = database.prepare(
    `SELECT * FROM files
     WHERE REPLACE(path, '\\', '/') = ?
        OR REPLACE(path, '\\', '/') LIKE ? ESCAPE '\\'
     ORDER BY updated_at DESC`
  )
  return stmt.all(normalized, likePattern) as FileRecord[]
}

export function getFilesByFolder(folderId: number | null): FileRecord[] {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM files WHERE folder_id = ? ORDER BY updated_at DESC')
  return stmt.all(folderId) as FileRecord[]
}

// ============ 文件夹操作 ============

export interface FolderRecord {
  id?: number
  name: string
  parent_id?: number | null
  path: string
  created_at?: string
}

export function insertFolder(folder: FolderRecord): number {
  const database = getDatabase()
  const now = new Date().toISOString()
  
  const stmt = database.prepare(`
    INSERT INTO folders (name, parent_id, path, created_at)
    VALUES (?, ?, ?, ?)
  `)
  
  const result = stmt.run(
    folder.name,
    folder.parent_id ?? null,
    folder.path,
    folder.created_at || now
  )
  
  return result.lastInsertRowid as number
}

export function getFolderByPath(folderPath: string): FolderRecord | null {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM folders WHERE path = ?')
  return stmt.get(folderPath) as FolderRecord | null
}

export function getAllFolders(): FolderRecord[] {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM folders ORDER BY name')
  return stmt.all() as FolderRecord[]
}

export function deleteFolder(id: number): boolean {
  const database = getDatabase()
  const stmt = database.prepare('DELETE FROM folders WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

// ============ 版本操作 ============

export interface VersionRecord {
  id?: number
  file_id: number
  version_path: string
  snapshot_at?: string
  remark?: string
}

export function insertVersion(version: VersionRecord): number {
  const database = getDatabase()
  const now = new Date().toISOString()
  
  const stmt = database.prepare(`
    INSERT INTO versions (file_id, version_path, snapshot_at, remark)
    VALUES (?, ?, ?, ?)
  `)
  
  const result = stmt.run(
    version.file_id,
    version.version_path,
    version.snapshot_at || now,
    version.remark || ''
  )
  
  return result.lastInsertRowid as number
}

export function getVersionsByFileId(fileId: number): VersionRecord[] {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM versions WHERE file_id = ? ORDER BY snapshot_at DESC')
  return stmt.all(fileId) as VersionRecord[]
}

export function deleteVersion(id: number): boolean {
  const database = getDatabase()
  const stmt = database.prepare('DELETE FROM versions WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

export function deleteVersionsByFileId(fileId: number): boolean {
  const database = getDatabase()
  const stmt = database.prepare('DELETE FROM versions WHERE file_id = ?')
  const result = stmt.run(fileId)
  return result.changes > 0
}

export function updateVersionPath(id: number, newPath: string): boolean {
  const database = getDatabase()
  const stmt = database.prepare('UPDATE versions SET version_path = ? WHERE id = ?')
  const result = stmt.run(newPath, id)
  return result.changes > 0
}

// ============ 标签操作 ============

export interface TagRecord {
  id?: number
  name: string
  color?: string
}

export function insertTag(tag: TagRecord): number {
  const database = getDatabase()
  const stmt = database.prepare('INSERT INTO tags (name, color) VALUES (?, ?)')
  const result = stmt.run(tag.name, tag.color || '#409EFF')
  return result.lastInsertRowid as number
}

export function updateTag(id: number, tag: Partial<TagRecord>): boolean {
  const database = getDatabase()
  const fields: string[] = []
  const values: any[] = []
  
  if (tag.name !== undefined) { fields.push('name = ?'); values.push(tag.name) }
  if (tag.color !== undefined) { fields.push('color = ?'); values.push(tag.color) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const stmt = database.prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`)
  const result = stmt.run(...values)
  
  return result.changes > 0
}

export function deleteTag(id: number): boolean {
  const database = getDatabase()
  const stmt = database.prepare('DELETE FROM tags WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

export function getAllTags(): TagRecord[] {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM tags ORDER BY name')
  return stmt.all() as TagRecord[]
}

// ============ 文件标签关联操作 ============

export function addTagToFile(fileId: number, tagId: number): boolean {
  const database = getDatabase()
  try {
    const stmt = database.prepare('INSERT INTO file_tags (file_id, tag_id) VALUES (?, ?)')
    stmt.run(fileId, tagId)
    return true
  } catch (e) {
    // 已存在关联，忽略
    return false
  }
}

export function removeTagFromFile(fileId: number, tagId: number): boolean {
  const database = getDatabase()
  const stmt = database.prepare('DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?')
  const result = stmt.run(fileId, tagId)
  return result.changes > 0
}

export function getTagsByFileId(fileId: number): TagRecord[] {
  const database = getDatabase()
  const stmt = database.prepare(`
    SELECT t.* FROM tags t
    INNER JOIN file_tags ft ON t.id = ft.tag_id
    WHERE ft.file_id = ?
  `)
  return stmt.all(fileId) as TagRecord[]
}

export function getFilesByTagId(tagId: number): FileRecord[] {
  const database = getDatabase()
  const stmt = database.prepare(`
    SELECT f.* FROM files f
    INNER JOIN file_tags ft ON f.id = ft.file_id
    WHERE ft.tag_id = ?
  `)
  return stmt.all(tagId) as FileRecord[]
}

// ============ 设置操作 ============

export function setSetting(key: string, value: string): void {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
  `)
  stmt.run(key, value)
}

export function getSetting(key: string): string | null {
  const database = getDatabase()
  const stmt = database.prepare('SELECT value FROM settings WHERE key = ?')
  const result = stmt.get(key) as { value: string } | undefined
  return result?.value ?? null
}

export function deleteSetting(key: string): boolean {
  const database = getDatabase()
  const stmt = database.prepare('DELETE FROM settings WHERE key = ?')
  const result = stmt.run(key)
  return result.changes > 0
}
