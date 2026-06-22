const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * 初始化 SQLite 数据库
 *
 * 参考技术架构文档§二：SQLite 零配置，MVP规模足够
 * 参考技术架构文档§九：技术债务 - SQLite单文件，推翻条件：日活>100
 *
 * 参考PRD §4.1 画像数据结构：
 *   child_profile: { nickname, age, interests, self_claimed_skills,
 *                    fox_name, fox_name_source, first_meeting_reactions }
 */
function initDB(dbPath) {
  // 确保数据库目录存在
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // 启用 WAL 模式和外键约束
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 创建 child_profiles 表（匹配 PRD 画像数据结构）
  db.exec(`
    CREATE TABLE IF NOT EXISTS child_profiles (
      id TEXT PRIMARY KEY,
      nickname TEXT,
      age INTEGER,
      interests TEXT,
      self_claimed_skills TEXT,
      fox_name TEXT,
      fox_name_source TEXT,
      first_meeting_reactions TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 创建 sessions 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      child_id TEXT,
      status TEXT DEFAULT 'active',
      fsm_state TEXT DEFAULT 'APPEARANCE',
      session_data TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (child_id) REFERENCES child_profiles(id)
    )
  `);

  return db;
}

module.exports = { initDB };
