/**
 * 情感连接指标持久化仓库 - Issue #28
 *
 * 参考PRD §4.1 画像数据结构 first_meeting_reactions 字段
 * 参考PRD §6.3 验证指标（主动说话次数、留存意愿）
 *
 * 职责：
 *   1. 将 metrics-tracker 输出的 first_meeting_reactions 持久化到 child_profiles 表
 *   2. 从 child_profiles 表读取并解析 first_meeting_reactions
 *   3. 支持合并保存（保留已有字段，只更新传入字段）
 */
const Database = require('better-sqlite3');
const { saveMetrics, loadMetrics, mergeMetrics } = require('../../src/dialog/metrics-repository');

/**
 * 创建内存数据库并建表（参考 src/db/init.js 的 CREATE TABLE 语句）
 * @returns {Database}
 */
function createTestDB() {
  const db = new Database(':memory:');
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
  return db;
}

/**
 * 插入一条孩子记录（用于测试前构造数据）
 * @param {Database} db
 * @param {string} childId
 * @param {string|null} firstMeetingReactions - 已有的 first_meeting_reactions JSON 字符串
 */
function insertChild(db, childId, firstMeetingReactions = null) {
  db.prepare(`
    INSERT INTO child_profiles (id, nickname, first_meeting_reactions)
    VALUES (?, ?, ?)
  `).run(childId, '测试孩子', firstMeetingReactions);
}

describe('情感连接指标持久化仓库 - Issue #28', () => {
  describe('saveMetrics / loadMetrics 端到端读写', () => {
    test('saveMetrics 写入后 loadMetrics 能读回相同指标', () => {
      const db = createTestDB();
      insertChild(db, 'child-001');

      const metrics = {
        proactive_speech_count: 3,
        teaching_willingness: null,
        partner_acceptance: null,
        retention_intention: true
      };

      const saveResult = saveMetrics(db, 'child-001', metrics);
      expect(saveResult.success).toBe(true);
      expect(saveResult.childId).toBe('child-001');

      const loadResult = loadMetrics(db, 'child-001');
      expect(loadResult.success).toBe(true);
      expect(loadResult.metrics).toEqual(metrics);

      db.close();
    });
  });

  describe('loadMetrics - 边界场景', () => {
    test('对不存在的 child 返回 success=false, metrics=null', () => {
      const db = createTestDB();

      const loadResult = loadMetrics(db, 'non-existent-child');

      expect(loadResult.success).toBe(false);
      expect(loadResult.metrics).toBeNull();

      db.close();
    });

    test('对存在但 first_meeting_reactions 为 NULL 的 child 返回 success=false, metrics=null', () => {
      const db = createTestDB();
      // 插入一条 first_meeting_reactions 为 NULL 的记录
      insertChild(db, 'child-null', null);

      const loadResult = loadMetrics(db, 'child-null');

      expect(loadResult.success).toBe(false);
      expect(loadResult.metrics).toBeNull();

      db.close();
    });
  });

  describe('mergeMetrics - 合并保存', () => {
    test('保留已有字段，只更新传入的字段', () => {
      const db = createTestDB();
      // 预置已有指标
      const existing = {
        proactive_speech_count: 3,
        teaching_willingness: null,
        partner_acceptance: null,
        retention_intention: true
      };
      insertChild(db, 'child-merge-1', JSON.stringify(existing));

      // 只更新 teaching_willingness
      const partial = { teaching_willingness: true };
      const result = mergeMetrics(db, 'child-merge-1', partial);

      expect(result.success).toBe(true);
      expect(result.mergedMetrics).toEqual({
        proactive_speech_count: 3,
        teaching_willingness: true,
        partner_acceptance: null,
        retention_intention: true
      });

      // 通过 loadMetrics 再次验证落库内容
      const loadResult = loadMetrics(db, 'child-merge-1');
      expect(loadResult.metrics).toEqual({
        proactive_speech_count: 3,
        teaching_willingness: true,
        partner_acceptance: null,
        retention_intention: true
      });

      db.close();
    });

    test('对不存在的 child 先创建空记录再合并', () => {
      const db = createTestDB();
      // 不预置任何 child 记录

      const partial = { proactive_speech_count: 2, retention_intention: false };
      const result = mergeMetrics(db, 'child-new', partial);

      expect(result.success).toBe(true);
      // 合并结果应只包含传入字段（因为不存在已有字段）
      expect(result.mergedMetrics).toEqual({
        proactive_speech_count: 2,
        retention_intention: false
      });

      // 通过 loadMetrics 再次验证落库内容
      const loadResult = loadMetrics(db, 'child-new');
      expect(loadResult.success).toBe(true);
      expect(loadResult.metrics).toEqual({
        proactive_speech_count: 2,
        retention_intention: false
      });

      db.close();
    });
  });
});
