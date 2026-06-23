/**
 * 会话指标集成测试 - Issue #28
 *
 * 验证 session-manager 与 metrics-tracker 集成：
 *   1. 会话创建时自动挂载 metrics-tracker
 *   2. handleVoiceMessage 时自动记录说话
 *   3. endSession 时持久化指标到 DB
 */
const Database = require('better-sqlite3');
const { createSessionManager, handleVoiceMessage } = require('../../src/voice/session-manager');
const { loadMetrics } = require('../../src/dialog/metrics-repository');

// 建表辅助
function setupTestDB() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE child_profiles (
      id TEXT PRIMARY KEY,
      nickname TEXT, age INTEGER, interests TEXT,
      self_claimed_skills TEXT, fox_name TEXT, fox_name_source TEXT,
      first_meeting_reactions TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, child_id TEXT, status TEXT DEFAULT 'active',
      fsm_state TEXT DEFAULT 'APPEARANCE', session_data TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (child_id) REFERENCES child_profiles(id)
    )
  `);
  return db;
}

describe('会话指标集成 - Issue #28', () => {
  let db, sessionManager;

  beforeEach(() => {
    db = setupTestDB();
    sessionManager = createSessionManager(db);
  });

  afterEach(() => {
    db.close();
  });

  test('会话创建时自动挂载 metrics-tracker', () => {
    const session = sessionManager.createSession('child-001');
    expect(session.metricsTracker).toBeDefined();
    expect(session.metricsTracker.getMetrics().proactive_speech_count).toBe(0);
  });

  test('handleVoiceMessage 有内容时自动记录主动说话', () => {
    const session = sessionManager.createSession('child-001');
    handleVoiceMessage(sessionManager, session.id, {
      type: 'child_response',
      responseTimeMs: 500,
      content: '你好'
    });

    const metrics = session.metricsTracker.getMetrics();
    expect(metrics.proactive_speech_count).toBe(1);
  });

  test('handleVoiceMessage 多次有内容说话 → 计数累加', () => {
    const session = sessionManager.createSession('child-001');
    handleVoiceMessage(sessionManager, session.id, {
      type: 'child_response', responseTimeMs: 500, content: '你好'
    });
    handleVoiceMessage(sessionManager, session.id, {
      type: 'child_response', responseTimeMs: 500, content: '我叫小明'
    });
    handleVoiceMessage(sessionManager, session.id, {
      type: 'child_response', responseTimeMs: 500, content: '我喜欢恐龙'
    });

    expect(session.metricsTracker.getMetrics().proactive_speech_count).toBe(3);
    expect(session.metricsTracker.getMetrics().emotional_connection_established).toBe(true);
  });

  test('endSession 将指标持久化到 child_profiles.first_meeting_reactions', () => {
    // 先创建 child 记录
    db.prepare('INSERT INTO child_profiles (id) VALUES (?)').run('child-001');

    const session = sessionManager.createSession('child-001');
    handleVoiceMessage(sessionManager, session.id, {
      type: 'child_response', responseTimeMs: 500, content: '你好'
    });
    handleVoiceMessage(sessionManager, session.id, {
      type: 'child_response', responseTimeMs: 500, content: '我叫小明'
    });

    sessionManager.endSession(session.id);

    const result = loadMetrics(db, 'child-001');
    expect(result.success).toBe(true);
    expect(result.metrics.proactive_speech_count).toBe(2);
  });

  test('endSession 记录留存意愿到 DB', () => {
    db.prepare('INSERT INTO child_profiles (id) VALUES (?)').run('child-001');

    const session = sessionManager.createSession('child-001');
    handleVoiceMessage(sessionManager, session.id, {
      type: 'child_response', responseTimeMs: 500, content: '你好'
    });
    handleVoiceMessage(sessionManager, session.id, {
      type: 'child_response', responseTimeMs: 500, content: '我明天还来'
    });

    sessionManager.endSession(session.id);

    const result = loadMetrics(db, 'child-001');
    expect(result.metrics.retention_intention).toBe(true);
  });

  test('endSession 对无 child_id 的会话不报错', () => {
    const session = sessionManager.createSession(null);
    handleVoiceMessage(sessionManager, session.id, {
      type: 'child_response', responseTimeMs: 500, content: '你好'
    });

    expect(() => sessionManager.endSession(session.id)).not.toThrow();
  });
});
