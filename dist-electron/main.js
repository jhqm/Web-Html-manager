"use strict";var N=Object.create;var m=Object.defineProperty;var b=Object.getOwnPropertyDescriptor;var _=Object.getOwnPropertyNames;var S=Object.getPrototypeOf,I=Object.prototype.hasOwnProperty;var O=(t,e,n,a)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of _(e))!I.call(t,r)&&r!==n&&m(t,r,{get:()=>e[r],enumerable:!(a=b(e,r))||a.enumerable});return t};var F=(t,e,n)=>(n=t!=null?N(S(t)):{},O(e||!t||!t.__esModule?m(n,"default",{value:t,enumerable:!0}):n,t));const s=require("electron"),u=require("path"),l=require("fs"),L=require("better-sqlite3");function v(){const t=s.app.getPath("userData");return l.existsSync(t)||l.mkdirSync(t,{recursive:!0}),t}function M(){return u.join(v(),"html-manager.db")}let d=null;function y(){if(d)return d;const t=M();return console.log("[Database] Initializing at:",t),d=new L(t),d.pragma("journal_mode = WAL"),A(),console.log("[Database] Initialization complete"),d}function A(){d&&(d.exec(`
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
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    )
  `),d.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      path TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
    )
  `),d.exec(`
    CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      version_path TEXT NOT NULL,
      snapshot_at TEXT NOT NULL,
      remark TEXT DEFAULT '',
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `),d.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#409EFF'
    )
  `),d.exec(`
    CREATE TABLE IF NOT EXISTS file_tags (
      file_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (file_id, tag_id),
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `),d.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `),console.log("[Database] Tables created"))}function c(){return d||y()}function R(){d&&(d.close(),d=null,console.log("[Database] Closed"))}function D(t){const e=c(),n=new Date().toISOString();return e.prepare(`
    INSERT INTO files (name, path, title, description, size, created_at, updated_at, folder_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(t.name,t.path,t.title||"",t.description||"",t.size||0,t.created_at||n,t.updated_at||n,t.folder_id??null).lastInsertRowid}function w(t,e){const n=c(),a=[],r=[];return e.name!==void 0&&(a.push("name = ?"),r.push(e.name)),e.path!==void 0&&(a.push("path = ?"),r.push(e.path)),e.title!==void 0&&(a.push("title = ?"),r.push(e.title)),e.description!==void 0&&(a.push("description = ?"),r.push(e.description)),e.size!==void 0&&(a.push("size = ?"),r.push(e.size)),e.updated_at!==void 0&&(a.push("updated_at = ?"),r.push(e.updated_at)),e.folder_id!==void 0&&(a.push("folder_id = ?"),r.push(e.folder_id)),a.length===0?!1:(r.push(t),n.prepare(`UPDATE files SET ${a.join(", ")} WHERE id = ?`).run(...r).changes>0)}function C(t){return c().prepare("DELETE FROM files WHERE id = ?").run(t).changes>0}function U(t){return c().prepare("DELETE FROM files WHERE path = ?").run(t).changes>0}function W(t){return c().prepare("SELECT * FROM files WHERE path = ?").get(t)}function P(t){return c().prepare("SELECT * FROM files WHERE id = ?").get(t)}function X(){return c().prepare("SELECT * FROM files ORDER BY updated_at DESC").all()}function Y(t){const e=c(),n=new Date().toISOString();return e.prepare(`
    INSERT INTO folders (name, parent_id, path, created_at)
    VALUES (?, ?, ?, ?)
  `).run(t.name,t.parent_id??null,t.path,t.created_at||n).lastInsertRowid}function B(t){return c().prepare("SELECT * FROM folders WHERE path = ?").get(t)}function x(){return c().prepare("SELECT * FROM folders ORDER BY name").all()}function H(t){const e=c(),n=new Date().toISOString();return e.prepare(`
    INSERT INTO versions (file_id, version_path, snapshot_at, remark)
    VALUES (?, ?, ?, ?)
  `).run(t.file_id,t.version_path,t.snapshot_at||n,t.remark||"").lastInsertRowid}function G(t){return c().prepare("SELECT * FROM versions WHERE file_id = ? ORDER BY snapshot_at DESC").all(t)}function j(t){return c().prepare("DELETE FROM versions WHERE file_id = ?").run(t).changes>0}function z(t){return c().prepare("INSERT INTO tags (name, color) VALUES (?, ?)").run(t.name,t.color||"#409EFF").lastInsertRowid}function K(t,e){const n=c(),a=[],r=[];return e.name!==void 0&&(a.push("name = ?"),r.push(e.name)),e.color!==void 0&&(a.push("color = ?"),r.push(e.color)),a.length===0?!1:(r.push(t),n.prepare(`UPDATE tags SET ${a.join(", ")} WHERE id = ?`).run(...r).changes>0)}function V(t){return c().prepare("DELETE FROM tags WHERE id = ?").run(t).changes>0}function k(){return c().prepare("SELECT * FROM tags ORDER BY name").all()}function $(t,e){const n=c();try{return n.prepare("INSERT INTO file_tags (file_id, tag_id) VALUES (?, ?)").run(t,e),!0}catch{return!1}}function q(t,e){return c().prepare("DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?").run(t,e).changes>0}function Q(t){return c().prepare(`
    SELECT t.* FROM tags t
    INNER JOIN file_tags ft ON t.id = ft.tag_id
    WHERE ft.file_id = ?
  `).all(t)}function J(t){return c().prepare(`
    SELECT f.* FROM files f
    INNER JOIN file_tags ft ON f.id = ft.file_id
    WHERE ft.tag_id = ?
  `).all(t)}function Z(t,e){c().prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
  `).run(t,e)}function ee(t){const a=c().prepare("SELECT value FROM settings WHERE key = ?").get(t);return(a==null?void 0:a.value)??null}const te=process.env.NODE_ENV==="development"||!s.app.isPackaged;let h=null;function g(){h=new s.BrowserWindow({width:1400,height:900,minWidth:1e3,minHeight:700,webPreferences:{preload:u.join(__dirname,"preload.js"),nodeIntegration:!1,contextIsolation:!0,webSecurity:!1},show:!1}),h.once("ready-to-show",()=>{h==null||h.show()}),te?(h.loadURL("http://localhost:5173"),h.webContents.openDevTools()):h.loadFile(u.join(__dirname,"../dist/index.html"))}s.ipcMain.handle("select-folder",async()=>{const t=await s.dialog.showOpenDialog({properties:["openDirectory"]});return t.canceled?null:t.filePaths[0]});s.ipcMain.handle("read-directory",async(t,e)=>{try{const n=l.readdirSync(e,{withFileTypes:!0}),a=n.filter(i=>i.isFile()&&i.name.toLowerCase().endsWith(".html")).map(i=>{const o=u.join(e,i.name),E=l.statSync(o);return{name:i.name,path:o,size:E.size,createdAt:E.birthtime.toISOString(),updatedAt:E.mtime.toISOString()}}),r=n.filter(i=>i.isDirectory());return{files:a,folders:r}}catch(n){return console.error("Error reading directory:",n),{files:[],folders:[]}}});s.ipcMain.handle("read-file",async(t,e)=>{try{const n=l.readFileSync(e,"utf-8"),a=n.match(/<title[^>]*>([^<]*)<\/title>/i),r=a?a[1].trim():"",i=n.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i),o=i?i[1].trim():"";return{content:n,title:r,description:o}}catch(n){return console.error("Error reading file:",n),{content:"",title:"",description:""}}});s.ipcMain.handle("save-file",async(t,e,n)=>{try{return l.writeFileSync(e,n,"utf-8"),{success:!0}}catch(a){return console.error("Error saving file:",a),{success:!1,error:String(a)}}});s.ipcMain.handle("create-snapshot",async(t,e,n)=>{try{const a=u.basename(e),i=`${new Date().toISOString().replace(/[:.]/g,"-")}_${a}`;l.existsSync(n)||l.mkdirSync(n,{recursive:!0});const o=u.join(n,i);return l.copyFileSync(e,o),{success:!0,snapshotPath:o}}catch(a){return console.error("Error creating snapshot:",a),{success:!1,error:String(a)}}});s.ipcMain.handle("get-versions",async(t,e,n)=>{try{return l.existsSync(e)?l.readdirSync(e,{withFileTypes:!0}).filter(i=>i.isFile()&&i.name.endsWith(`_${n}`)).map(i=>{const o=u.join(e,i.name),E=l.statSync(o);return{name:i.name,path:o,createdAt:E.birthtime.toISOString()}}).sort((i,o)=>new Date(o.createdAt).getTime()-new Date(i.createdAt).getTime()):[]}catch(a){return console.error("Error getting versions:",a),[]}});s.ipcMain.handle("restore-version",async(t,e,n)=>{try{const a=l.readFileSync(e);return l.writeFileSync(n,a),{success:!0}}catch(a){return console.error("Error restoring version:",a),{success:!1,error:String(a)}}});s.ipcMain.handle("get-all-folders",async(t,e)=>{const n=[];function a(r,i=""){try{l.readdirSync(r,{withFileTypes:!0}).forEach(E=>{if(E.isDirectory()){const p=u.join(r,E.name);n.push({name:E.name,path:p,parentPath:i}),a(p,p)}})}catch(o){console.error("Error scanning directory:",o)}}return a(e),n});s.ipcMain.handle("open-external",async(t,e)=>{const{shell:n}=await import("electron");n.openExternal(e)});s.ipcMain.handle("db-get-all-files",async()=>X());s.ipcMain.handle("db-get-file-by-id",async(t,e)=>P(e));s.ipcMain.handle("db-insert-file",async(t,e)=>D(e));s.ipcMain.handle("db-update-file",async(t,e,n)=>w(e,n));s.ipcMain.handle("db-delete-file",async(t,e)=>C(e));s.ipcMain.handle("db-delete-file-by-path",async(t,e)=>U(e));s.ipcMain.handle("db-get-file-by-path",async(t,e)=>W(e));s.ipcMain.handle("db-get-all-folders",async()=>x());s.ipcMain.handle("db-insert-folder",async(t,e)=>Y(e));s.ipcMain.handle("db-get-folder-by-path",async(t,e)=>B(e));s.ipcMain.handle("db-insert-version",async(t,e)=>H(e));s.ipcMain.handle("db-get-versions-by-file-id",async(t,e)=>G(e));s.ipcMain.handle("db-delete-versions-by-file-id",async(t,e)=>j(e));s.ipcMain.handle("db-get-all-tags",async()=>k());s.ipcMain.handle("db-insert-tag",async(t,e)=>z(e));s.ipcMain.handle("db-update-tag",async(t,e,n)=>K(e,n));s.ipcMain.handle("db-delete-tag",async(t,e)=>V(e));s.ipcMain.handle("db-add-tag-to-file",async(t,e,n)=>$(e,n));s.ipcMain.handle("db-remove-tag-from-file",async(t,e,n)=>q(e,n));s.ipcMain.handle("db-get-tags-by-file-id",async(t,e)=>Q(e));s.ipcMain.handle("db-get-files-by-tag-id",async(t,e)=>J(e));s.ipcMain.handle("db-set-setting",async(t,e,n)=>(Z(e,n),!0));s.ipcMain.handle("db-get-setting",async(t,e)=>ee(e));s.ipcMain.handle("scan-html-files",async(t,e,n=!0)=>{const a=[];function r(i,o){try{const E=l.readdirSync(i,{withFileTypes:!0});for(const p of E){const f=u.join(i,p.name);if(p.isFile()&&p.name.toLowerCase().endsWith(".html")){const T=l.statSync(f);a.push({name:p.name,path:f,relativePath:u.relative(o,f),size:T.size,createdAt:T.birthtime.toISOString(),updatedAt:T.mtime.toISOString()})}else p.isDirectory()&&n&&p.name!==".versions"&&!p.name.startsWith(".")&&r(f,o)}}catch(E){console.error("Error scanning directory:",E)}}return r(e,e),a});s.ipcMain.handle("copy-file-to-repo",async(t,e,n)=>{try{const a=u.basename(e),r=u.join(n,a);let i=r;if(l.existsSync(r)){const o=u.extname(a),E=u.basename(a,o),p=Date.now();i=u.join(n,`${E}_${p}${o}`)}return l.copyFileSync(e,i),{success:!0,path:i}}catch(a){return console.error("Error copying file:",a),{success:!1,error:String(a)}}});s.ipcMain.handle("select-html-files",async()=>{const t=await s.dialog.showOpenDialog({properties:["openFile","multiSelections"],filters:[{name:"HTML Files",extensions:["html","htm"]}]});return t.canceled?[]:t.filePaths});s.app.whenReady().then(()=>{y(),g(),s.app.on("activate",()=>{s.BrowserWindow.getAllWindows().length===0&&g()})});s.app.on("window-all-closed",()=>{process.platform!=="darwin"&&(R(),s.app.quit())});s.app.on("before-quit",()=>{R()});
