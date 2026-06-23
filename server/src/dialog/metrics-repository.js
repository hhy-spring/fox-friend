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

/**
 * 保存情感连接指标到 child_profiles.first_meeting_reactions
 * @param {import('better-sqlite3').Database} db - 数据库实例
 * @param {string} childId - 孩子 ID
 * @param {object} firstMeetingReactions - 情感连接指标
 * @returns {{ success: boolean, childId: string }}
 */
function saveMetrics(db, childId, firstMeetingReactions) {
  const stmt = db.prepare(`
    UPDATE child_profiles
    SET first_meeting_reactions = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `);
  stmt.run(JSON.stringify(firstMeetingReactions), childId);

  return {
    success: true,
    childId
  };
}

/**
 * 读取情感连接指标
 * @param {import('better-sqlite3').Database} db - 数据库实例
 * @param {string} childId - 孩子 ID
 * @returns {{ success: boolean, metrics: object|null }}
 */
function loadMetrics(db, childId) {
  const stmt = db.prepare(`
    SELECT first_meeting_reactions FROM child_profiles WHERE id = ?
  `);
  const row = stmt.get(childId);

  // child 不存在，或 first_meeting_reactions 字段为 NULL，均视为读取失败
  if (!row || row.first_meeting_reactions === null) {
    return { success: false, metrics: null };
  }

  return {
    success: true,
    metrics: JSON.parse(row.first_meeting_reactions)
  };
}

/**
 * 合并保存情感连接指标（保留已有字段，只更新传入的字段）
 * @param {import('better-sqlite3').Database} db - 数据库实例
 * @param {string} childId - 孩子 ID
 * @param {object} partialMetrics - 需要更新的部分指标字段
 * @returns {{ success: boolean, mergedMetrics: object }}
 */
function mergeMetrics(db, childId, partialMetrics) {
  // 读取已有指标，若不存在则视为空对象
  const loadResult = loadMetrics(db, childId);
  const existing = loadResult.success ? loadResult.metrics : {};

  // 浅合并：传入字段覆盖已有字段
  const mergedMetrics = { ...existing, ...partialMetrics };

  // 检查 child 是否存在，不存在则先创建空记录再更新
  const existsStmt = db.prepare(`SELECT 1 FROM child_profiles WHERE id = ?`);
  const exists = existsStmt.get(childId);

  if (!exists) {
    db.prepare(`
      INSERT INTO child_profiles (id, first_meeting_reactions)
      VALUES (?, ?)
    `).run(childId, JSON.stringify(mergedMetrics));
  } else {
    saveMetrics(db, childId, mergedMetrics);
  }

  return {
    success: true,
    mergedMetrics
  };
}

module.exports = { saveMetrics, loadMetrics, mergeMetrics };
