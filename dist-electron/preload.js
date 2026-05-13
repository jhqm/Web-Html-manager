"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // 选择文件夹
  selectFolder: () => electron.ipcRenderer.invoke("select-folder"),
  // 读取目录
  readDirectory: (dirPath) => electron.ipcRenderer.invoke("read-directory", dirPath),
  // 读取文件
  readFile: (filePath) => electron.ipcRenderer.invoke("read-file", filePath),
  // 保存文件
  saveFile: (filePath, content) => electron.ipcRenderer.invoke("save-file", filePath, content),
  // 创建版本快照
  createSnapshot: (originalPath, versionsDir) => electron.ipcRenderer.invoke("create-snapshot", originalPath, versionsDir),
  // 获取版本列表
  getVersions: (versionsDir, fileName) => electron.ipcRenderer.invoke("get-versions", versionsDir, fileName),
  // 恢复版本
  restoreVersion: (versionPath, originalPath) => electron.ipcRenderer.invoke("restore-version", versionPath, originalPath),
  // 获取所有文件夹
  getAllFolders: (rootPath) => electron.ipcRenderer.invoke("get-all-folders", rootPath),
  // 打开外部浏览器
  openExternal: (url) => electron.ipcRenderer.invoke("open-external", url),
  // 重命名磁盘文件（同时迁移同名版本快照）
  renameFile: (oldPath, newBaseName, versionsDir) => electron.ipcRenderer.invoke("rename-file", oldPath, newBaseName, versionsDir),
  // ============ 数据库操作 ============
  // 文件相关
  dbGetAllFiles: () => electron.ipcRenderer.invoke("db-get-all-files"),
  dbGetFileById: (id) => electron.ipcRenderer.invoke("db-get-file-by-id", id),
  dbInsertFile: (file) => electron.ipcRenderer.invoke("db-insert-file", file),
  dbUpdateFile: (id, file) => electron.ipcRenderer.invoke("db-update-file", id, file),
  dbDeleteFile: (id) => electron.ipcRenderer.invoke("db-delete-file", id),
  dbDeleteFileByPath: (filePath) => electron.ipcRenderer.invoke("db-delete-file-by-path", filePath),
  dbGetFileByPath: (filePath) => electron.ipcRenderer.invoke("db-get-file-by-path", filePath),
  // 文件夹相关
  dbGetAllFolders: () => electron.ipcRenderer.invoke("db-get-all-folders"),
  dbInsertFolder: (folder) => electron.ipcRenderer.invoke("db-insert-folder", folder),
  dbGetFolderByPath: (folderPath) => electron.ipcRenderer.invoke("db-get-folder-by-path", folderPath),
  // 版本相关
  dbInsertVersion: (version) => electron.ipcRenderer.invoke("db-insert-version", version),
  dbGetVersionsByFileId: (fileId) => electron.ipcRenderer.invoke("db-get-versions-by-file-id", fileId),
  dbDeleteVersionsByFileId: (fileId) => electron.ipcRenderer.invoke("db-delete-versions-by-file-id", fileId),
  dbUpdateVersionPath: (id, newPath) => electron.ipcRenderer.invoke("db-update-version-path", id, newPath),
  // 标签相关
  dbGetAllTags: () => electron.ipcRenderer.invoke("db-get-all-tags"),
  dbInsertTag: (tag) => electron.ipcRenderer.invoke("db-insert-tag", tag),
  dbUpdateTag: (id, tag) => electron.ipcRenderer.invoke("db-update-tag", id, tag),
  dbDeleteTag: (id) => electron.ipcRenderer.invoke("db-delete-tag", id),
  dbAddTagToFile: (fileId, tagId) => electron.ipcRenderer.invoke("db-add-tag-to-file", fileId, tagId),
  dbRemoveTagFromFile: (fileId, tagId) => electron.ipcRenderer.invoke("db-remove-tag-from-file", fileId, tagId),
  dbGetTagsByFileId: (fileId) => electron.ipcRenderer.invoke("db-get-tags-by-file-id", fileId),
  dbGetFilesByTagId: (tagId) => electron.ipcRenderer.invoke("db-get-files-by-tag-id", tagId),
  // 设置相关
  dbSetSetting: (key, value) => electron.ipcRenderer.invoke("db-set-setting", key, value),
  dbGetSetting: (key) => electron.ipcRenderer.invoke("db-get-setting", key),
  // 文件扫描
  scanHtmlFiles: (rootPath, recursive) => electron.ipcRenderer.invoke("scan-html-files", rootPath, recursive),
  copyFileToRepo: (sourcePath, destDir) => electron.ipcRenderer.invoke("copy-file-to-repo", sourcePath, destDir),
  selectHtmlFiles: () => electron.ipcRenderer.invoke("select-html-files")
});
