PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS cms_categories (
 id TEXT PRIMARY KEY,label TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0,visible INTEGER NOT NULL DEFAULT 1,
 revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS cms_category_labels ON cms_categories(label COLLATE NOCASE);
CREATE TABLE IF NOT EXISTS cms_templates (
 id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL REFERENCES cms_categories(id),description TEXT NOT NULL DEFAULT '',tags TEXT NOT NULL DEFAULT '[]',
 position INTEGER NOT NULL DEFAULT 0,published INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,
 width INTEGER NOT NULL,height INTEGER NOT NULL,parameter_count INTEGER NOT NULL,
 package_key TEXT NOT NULL,thumbnail_key TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cms_templates_category ON cms_templates(category,published,position);
CREATE TABLE IF NOT EXISTS cms_settings (id TEXT PRIMARY KEY,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cms_sessions (token_hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires_at INTEGER NOT NULL,auth_version TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cms_login_limits (key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cms_audit (id INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT NOT NULL,object_id TEXT NOT NULL,created_at INTEGER NOT NULL);
INSERT OR IGNORE INTO cms_categories VALUES
 ('poster','宣传海报',10,1,1,0,0),('social','社交媒体配图',20,1,1,0,0),('ecommerce','电商商品图片',30,1,1,0,0),
 ('notice','活动通知',40,1,1,0,0),('festival','节日祝福',50,1,1,0,0),('general','通用图文设计',60,1,1,0,0),
 ('huimin-15','惠民十五五',70,1,1,0,0),('blank','空白画布',80,1,1,0,0);
CREATE TABLE IF NOT EXISTS cms_gc (key TEXT PRIMARY KEY);
