"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
function getUserDataPath() {
  const userDataPath = electron.app.getPath("userData");
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  return userDataPath;
}
function getDbPath() {
  return path.join(getUserDataPath(), "html-manager.db");
}
let db = null;
function initDatabase() {
  if (db) return db;
  const dbPath = getDbPath();
  console.log("[Database] Initializing at:", dbPath);
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  createTables();
  console.log("[Database] Initialization complete");
  return db;
}
function createTables() {
  if (!db) return;
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
  `);
  try {
    db.exec(`ALTER TABLE files ADD COLUMN is_pinned INTEGER DEFAULT 0`);
  } catch (e) {
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      path TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      version_path TEXT NOT NULL,
      snapshot_at TEXT NOT NULL,
      remark TEXT DEFAULT '',
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#409EFF'
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_tags (
      file_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (file_id, tag_id),
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  console.log("[Database] Tables created");
}
function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log("[Database] Closed");
  }
}
function insertFile(file) {
  const database = getDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const stmt = database.prepare(`
    INSERT INTO files (name, path, title, description, size, created_at, updated_at, folder_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    file.name,
    file.path,
    file.title || "",
    file.description || "",
    file.size || 0,
    file.created_at || now,
    file.updated_at || now,
    file.folder_id ?? null
  );
  return result.lastInsertRowid;
}
function updateFile(id, file) {
  const database = getDatabase();
  const fields = [];
  const values = [];
  if (file.name !== void 0) {
    fields.push("name = ?");
    values.push(file.name);
  }
  if (file.path !== void 0) {
    fields.push("path = ?");
    values.push(file.path);
  }
  if (file.title !== void 0) {
    fields.push("title = ?");
    values.push(file.title);
  }
  if (file.description !== void 0) {
    fields.push("description = ?");
    values.push(file.description);
  }
  if (file.size !== void 0) {
    fields.push("size = ?");
    values.push(file.size);
  }
  if (file.updated_at !== void 0) {
    fields.push("updated_at = ?");
    values.push(file.updated_at);
  }
  if (file.folder_id !== void 0) {
    fields.push("folder_id = ?");
    values.push(file.folder_id);
  }
  if (file.is_pinned !== void 0) {
    fields.push("is_pinned = ?");
    values.push(file.is_pinned);
  }
  if (fields.length === 0) return false;
  values.push(id);
  const stmt = database.prepare(`UPDATE files SET ${fields.join(", ")} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}
function deleteFile(id) {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM files WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}
function deleteFileByPath(filePath) {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM files WHERE path = ?");
  const result = stmt.run(filePath);
  return result.changes > 0;
}
function getFileByPath(filePath) {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM files WHERE path = ?");
  return stmt.get(filePath);
}
function getFileById(id) {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM files WHERE id = ?");
  return stmt.get(id);
}
function getAllFiles() {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM files ORDER BY updated_at DESC");
  return stmt.all();
}
function insertFolder(folder) {
  const database = getDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const stmt = database.prepare(`
    INSERT INTO folders (name, parent_id, path, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(
    folder.name,
    folder.parent_id ?? null,
    folder.path,
    folder.created_at || now
  );
  return result.lastInsertRowid;
}
function getFolderByPath(folderPath) {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM folders WHERE path = ?");
  return stmt.get(folderPath);
}
function getAllFolders() {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM folders ORDER BY name");
  return stmt.all();
}
function insertVersion(version) {
  const database = getDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const stmt = database.prepare(`
    INSERT INTO versions (file_id, version_path, snapshot_at, remark)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(
    version.file_id,
    version.version_path,
    version.snapshot_at || now,
    version.remark || ""
  );
  return result.lastInsertRowid;
}
function getVersionsByFileId(fileId) {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM versions WHERE file_id = ? ORDER BY snapshot_at DESC");
  return stmt.all(fileId);
}
function deleteVersionsByFileId(fileId) {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM versions WHERE file_id = ?");
  const result = stmt.run(fileId);
  return result.changes > 0;
}
function updateVersionPath(id, newPath) {
  const database = getDatabase();
  const stmt = database.prepare("UPDATE versions SET version_path = ? WHERE id = ?");
  const result = stmt.run(newPath, id);
  return result.changes > 0;
}
function insertTag(tag) {
  const database = getDatabase();
  const stmt = database.prepare("INSERT INTO tags (name, color) VALUES (?, ?)");
  const result = stmt.run(tag.name, tag.color || "#409EFF");
  return result.lastInsertRowid;
}
function updateTag(id, tag) {
  const database = getDatabase();
  const fields = [];
  const values = [];
  if (tag.name !== void 0) {
    fields.push("name = ?");
    values.push(tag.name);
  }
  if (tag.color !== void 0) {
    fields.push("color = ?");
    values.push(tag.color);
  }
  if (fields.length === 0) return false;
  values.push(id);
  const stmt = database.prepare(`UPDATE tags SET ${fields.join(", ")} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}
function deleteTag(id) {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM tags WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}
function getAllTags() {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM tags ORDER BY name");
  return stmt.all();
}
function addTagToFile(fileId, tagId) {
  const database = getDatabase();
  try {
    const stmt = database.prepare("INSERT INTO file_tags (file_id, tag_id) VALUES (?, ?)");
    stmt.run(fileId, tagId);
    return true;
  } catch (e) {
    return false;
  }
}
function removeTagFromFile(fileId, tagId) {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?");
  const result = stmt.run(fileId, tagId);
  return result.changes > 0;
}
function getTagsByFileId(fileId) {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT t.* FROM tags t
    INNER JOIN file_tags ft ON t.id = ft.tag_id
    WHERE ft.file_id = ?
  `);
  return stmt.all(fileId);
}
function getFilesByTagId(tagId) {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT f.* FROM files f
    INNER JOIN file_tags ft ON f.id = ft.file_id
    WHERE ft.tag_id = ?
  `);
  return stmt.all(tagId);
}
function setSetting(key, value) {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
  `);
  stmt.run(key, value);
}
function getSetting(key) {
  const database = getDatabase();
  const stmt = database.prepare("SELECT value FROM settings WHERE key = ?");
  const result = stmt.get(key);
  return (result == null ? void 0 : result.value) ?? null;
}
const isDev = process.env.NODE_ENV === "development" || !electron.app.isPackaged;
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1e3,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    show: false
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
  });
  const port = process.env.VITE_DEV_SERVER_PORT || "5173";
  if (isDev) {
    mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}
electron.ipcMain.handle("select-folder", async () => {
  const result = await electron.dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});
electron.ipcMain.handle("read-directory", async (_event, dirPath) => {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = items.filter((item) => item.isFile() && item.name.toLowerCase().endsWith(".html")).map((item) => {
      const filePath = path.join(dirPath, item.name);
      const stats = fs.statSync(filePath);
      return {
        name: item.name,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString()
      };
    });
    const folders = items.filter((item) => item.isDirectory());
    return { files, folders };
  } catch (error) {
    console.error("Error reading directory:", error);
    return { files: [], folders: [] };
  }
});
electron.ipcMain.handle("read-file", async (_event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    const descMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const description = descMatch ? descMatch[1].trim() : "";
    return { content, title, description };
  } catch (error) {
    console.error("Error reading file:", error);
    return { content: "", title: "", description: "" };
  }
});
electron.ipcMain.handle("save-file", async (_event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    return { success: true };
  } catch (error) {
    console.error("Error saving file:", error);
    return { success: false, error: String(error) };
  }
});
electron.ipcMain.handle("create-snapshot", async (_event, originalPath, versionsDir) => {
  try {
    const fileName = path.basename(originalPath);
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const snapshotFileName = `${timestamp}_${fileName}`;
    if (!fs.existsSync(versionsDir)) {
      fs.mkdirSync(versionsDir, { recursive: true });
    }
    const snapshotPath = path.join(versionsDir, snapshotFileName);
    fs.copyFileSync(originalPath, snapshotPath);
    return { success: true, snapshotPath };
  } catch (error) {
    console.error("Error creating snapshot:", error);
    return { success: false, error: String(error) };
  }
});
electron.ipcMain.handle("get-versions", async (_event, versionsDir, fileName) => {
  try {
    if (!fs.existsSync(versionsDir)) {
      return [];
    }
    const items = fs.readdirSync(versionsDir, { withFileTypes: true });
    const versions = items.filter((item) => item.isFile() && item.name.endsWith(`_${fileName}`)).map((item) => {
      const filePath = path.join(versionsDir, item.name);
      const stats = fs.statSync(filePath);
      return {
        name: item.name,
        path: filePath,
        createdAt: stats.birthtime.toISOString()
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return versions;
  } catch (error) {
    console.error("Error getting versions:", error);
    return [];
  }
});
electron.ipcMain.handle("restore-version", async (_event, versionPath, originalPath) => {
  try {
    const content = fs.readFileSync(versionPath);
    fs.writeFileSync(originalPath, content);
    return { success: true };
  } catch (error) {
    console.error("Error restoring version:", error);
    return { success: false, error: String(error) };
  }
});
electron.ipcMain.handle("get-all-folders", async (_event, rootPath) => {
  const folders = [];
  function scanDir(dirPath, parentPath = "") {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      items.forEach((item) => {
        if (item.isDirectory()) {
          const fullPath = path.join(dirPath, item.name);
          folders.push({
            name: item.name,
            path: fullPath,
            parentPath
          });
          scanDir(fullPath, fullPath);
        }
      });
    } catch (error) {
      console.error("Error scanning directory:", error);
    }
  }
  scanDir(rootPath);
  return folders;
});
electron.ipcMain.handle("open-external", async (_event, url) => {
  const { shell } = await import("electron");
  shell.openExternal(url);
});
electron.ipcMain.handle("rename-file", async (_event, oldPath, newBaseName, versionsDir) => {
  try {
    if (!fs.existsSync(oldPath)) {
      return { success: false, error: "原文件不存在" };
    }
    const dir = path.dirname(oldPath);
    const oldName = path.basename(oldPath);
    const oldExt = path.extname(oldName);
    const trimmed = (newBaseName || "").trim();
    if (!trimmed) {
      return { success: false, error: "新文件名不能为空" };
    }
    if (/[\\/\x00<>:"|?*]/.test(trimmed)) {
      return { success: false, error: "文件名包含非法字符" };
    }
    const hasExt = path.extname(trimmed) !== "";
    const newName = hasExt ? trimmed : `${trimmed}${oldExt}`;
    const newPath = path.join(dir, newName);
    if (newPath === oldPath) {
      return { success: true, newPath, newName, renamedSnapshots: [] };
    }
    if (fs.existsSync(newPath)) {
      return { success: false, error: "目标文件名已存在" };
    }
    fs.renameSync(oldPath, newPath);
    const renamedSnapshots = [];
    if (versionsDir && fs.existsSync(versionsDir)) {
      try {
        const entries = fs.readdirSync(versionsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          if (!entry.name.endsWith(`_${oldName}`)) continue;
          const prefix = entry.name.slice(0, entry.name.length - oldName.length);
          const snapOld = path.join(versionsDir, entry.name);
          const snapNew = path.join(versionsDir, `${prefix}${newName}`);
          if (snapOld === snapNew) continue;
          if (fs.existsSync(snapNew)) continue;
          fs.renameSync(snapOld, snapNew);
          renamedSnapshots.push({ oldPath: snapOld, newPath: snapNew });
        }
      } catch (e) {
        console.warn("[rename-file] migrate snapshots failed:", e);
      }
    }
    return { success: true, newPath, newName, renamedSnapshots };
  } catch (error) {
    console.error("Error renaming file:", error);
    return { success: false, error: String(error) };
  }
});
electron.ipcMain.handle("db-get-all-files", async () => {
  return getAllFiles();
});
electron.ipcMain.handle("db-get-file-by-id", async (_event, id) => {
  return getFileById(id);
});
electron.ipcMain.handle("db-insert-file", async (_event, file) => {
  return insertFile(file);
});
electron.ipcMain.handle("db-update-file", async (_event, id, file) => {
  return updateFile(id, file);
});
electron.ipcMain.handle("db-delete-file", async (_event, id) => {
  return deleteFile(id);
});
electron.ipcMain.handle("db-delete-file-by-path", async (_event, filePath) => {
  return deleteFileByPath(filePath);
});
electron.ipcMain.handle("db-get-file-by-path", async (_event, filePath) => {
  return getFileByPath(filePath);
});
electron.ipcMain.handle("db-get-all-folders", async () => {
  return getAllFolders();
});
electron.ipcMain.handle("db-insert-folder", async (_event, folder) => {
  return insertFolder(folder);
});
electron.ipcMain.handle("db-get-folder-by-path", async (_event, folderPath) => {
  return getFolderByPath(folderPath);
});
electron.ipcMain.handle("db-insert-version", async (_event, version) => {
  return insertVersion(version);
});
electron.ipcMain.handle("db-get-versions-by-file-id", async (_event, fileId) => {
  return getVersionsByFileId(fileId);
});
electron.ipcMain.handle("db-delete-versions-by-file-id", async (_event, fileId) => {
  return deleteVersionsByFileId(fileId);
});
electron.ipcMain.handle("db-update-version-path", async (_event, id, newPath) => {
  return updateVersionPath(id, newPath);
});
electron.ipcMain.handle("db-get-all-tags", async () => {
  return getAllTags();
});
electron.ipcMain.handle("db-insert-tag", async (_event, tag) => {
  return insertTag(tag);
});
electron.ipcMain.handle("db-update-tag", async (_event, id, tag) => {
  return updateTag(id, tag);
});
electron.ipcMain.handle("db-delete-tag", async (_event, id) => {
  return deleteTag(id);
});
electron.ipcMain.handle("db-add-tag-to-file", async (_event, fileId, tagId) => {
  return addTagToFile(fileId, tagId);
});
electron.ipcMain.handle("db-remove-tag-from-file", async (_event, fileId, tagId) => {
  return removeTagFromFile(fileId, tagId);
});
electron.ipcMain.handle("db-get-tags-by-file-id", async (_event, fileId) => {
  return getTagsByFileId(fileId);
});
electron.ipcMain.handle("db-get-files-by-tag-id", async (_event, tagId) => {
  return getFilesByTagId(tagId);
});
electron.ipcMain.handle("db-set-setting", async (_event, key, value) => {
  setSetting(key, value);
  return true;
});
electron.ipcMain.handle("db-get-setting", async (_event, key) => {
  return getSetting(key);
});
electron.ipcMain.handle("scan-html-files", async (_event, rootPath, recursive = true) => {
  const htmlFiles = [];
  function scanDir(dirPath, basePath) {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        if (item.isFile() && item.name.toLowerCase().endsWith(".html")) {
          const stats = fs.statSync(fullPath);
          htmlFiles.push({
            name: item.name,
            path: fullPath,
            relativePath: path.relative(basePath, fullPath),
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
            updatedAt: stats.mtime.toISOString()
          });
        } else if (item.isDirectory() && recursive && item.name !== ".versions" && !item.name.startsWith(".")) {
          scanDir(fullPath, basePath);
        }
      }
    } catch (error) {
      console.error("Error scanning directory:", error);
    }
  }
  scanDir(rootPath, rootPath);
  return htmlFiles;
});
electron.ipcMain.handle("copy-file-to-repo", async (_event, sourcePath, destDir) => {
  try {
    const fileName = path.basename(sourcePath);
    const destPath = path.join(destDir, fileName);
    let finalPath = destPath;
    if (fs.existsSync(destPath)) {
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      const timestamp = Date.now();
      finalPath = path.join(destDir, `${base}_${timestamp}${ext}`);
    }
    fs.copyFileSync(sourcePath, finalPath);
    return { success: true, path: finalPath };
  } catch (error) {
    console.error("Error copying file:", error);
    return { success: false, error: String(error) };
  }
});
electron.ipcMain.handle("select-html-files", async () => {
  const result = await electron.dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "HTML Files", extensions: ["html", "htm"] }]
  });
  return result.canceled ? [] : result.filePaths;
});
electron.app.whenReady().then(() => {
  initDatabase();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    closeDatabase();
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  closeDatabase();
});
