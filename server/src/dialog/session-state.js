/**
 * 会话状态持久化管理器 - Issue #7 每日见面开场
 *
 * 参考PRD §4.2 session_data 结构：
 *   date, story_stage, subject, items_learned, mastery_status,
 *   child_mood, chat_frequency, teaching_method_used,
 *   duration_minutes, child_spontaneous_remarks
 *
 * 职责：
 *   1. 持久化每次会话的 session_data（数组形式追加）
 *   2. 提供会话计数，用于关系新鲜度机制
 *   3. 故事阶段状态独立持久化（跨 app 重启恢复）
 *   4. 跨会话状态衔接（loadLastSession / loadAllSessions）
 *
 * 文件结构：
 *   - 会话数据：data/sessions_{childId}.json - 会话对象数组
 *   - 故事阶段：data/story_stage_{childId}.json - 单个对象
 */

const fs = require('fs');
const path = require('path');

/**
 * 创建会话状态管理器
 * @param {object} [options] - 选项
 * @param {string} [options.storageDir] - 存储目录，默认为 '../../data'
 * @returns {object} 会话状态管理器实例
 */
function createSessionStateManager(options = {}) {
  const storageDir = options.storageDir || path.join(__dirname, '..', '..', 'data');

  /**
   * 确保存储目录存在
   */
  function ensureStorageDir() {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  /**
   * 获取孩子会话文件路径
   * @param {string} childId
   * @returns {string}
   */
  function getSessionsFilePath(childId) {
    return path.join(storageDir, `sessions_${childId}.json`);
  }

  /**
   * 获取孩子故事阶段文件路径
   * @param {string} childId
   * @returns {string}
   */
  function getStoryStageFilePath(childId) {
    return path.join(storageDir, `story_stage_${childId}.json`);
  }

  /**
   * 读取孩子的所有会话（文件不存在时返回空数组）
   * @param {string} childId
   * @returns {object[]}
   */
  function readSessions(childId) {
    const filePath = getSessionsFilePath(childId);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(fileContent);
    return Array.isArray(parsed) ? parsed : [];
  }

  return {
    /**
     * 保存会话数据
     * 追加到 sessions_{childId}.json 数组中
     * @param {string} childId - 孩子 ID
     * @param {object} sessionData - 会话数据（参考 PRD §4.2）
     * @returns {{ success: boolean, path: string, sessionCount: number }}
     */
    saveSession(childId, sessionData) {
      ensureStorageDir();
      const filePath = getSessionsFilePath(childId);

      // 读取已有会话列表
      const sessions = readSessions(childId);

      // 添加 saved_at 时间戳后追加
      const timestamp = new Date().toISOString();
      const sessionToSave = { ...sessionData, saved_at: timestamp };
      sessions.push(sessionToSave);

      // 写入文件
      fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2), 'utf8');

      return {
        success: true,
        path: filePath,
        sessionCount: sessions.length
      };
    },

    /**
     * 读取最近一次会话
     * @param {string} childId - 孩子 ID
     * @returns {{ success: boolean, sessionData?: object, sessionCount?: number }}
     *   无历史会话时返回 { success: false }
     */
    loadLastSession(childId) {
      const sessions = readSessions(childId);
      if (sessions.length === 0) {
        return { success: false };
      }
      // 数组末尾即最近一次会话（按保存顺序）
      return {
        success: true,
        sessionData: sessions[sessions.length - 1],
        sessionCount: sessions.length
      };
    },

    /**
     * 获取会话计数
     * @param {string} childId - 孩子 ID
     * @returns {number}
     */
    getSessionCount(childId) {
      return readSessions(childId).length;
    },

    /**
     * 读取所有会话（按时间顺序，用于记忆锚点）
     * @param {string} childId - 孩子 ID
     * @returns {object[]}
     */
    loadAllSessions(childId) {
      return readSessions(childId);
    },

    /**
     * 保存故事阶段状态（独立于会话数据）
     * @param {string} childId - 孩子 ID
     * @param {object} stageData - 故事阶段状态
     * @returns {{ success: boolean, path: string }}
     */
    saveStoryStage(childId, stageData) {
      ensureStorageDir();
      const filePath = getStoryStageFilePath(childId);

      // 故事阶段为单一对象，直接覆盖写入
      fs.writeFileSync(filePath, JSON.stringify(stageData, null, 2), 'utf8');

      return {
        success: true,
        path: filePath
      };
    },

    /**
     * 读取故事阶段状态
     * @param {string} childId - 孩子 ID
     * @returns {{ success: boolean, stageData?: object }}
     *   无保存数据时返回 { success: false }
     */
    loadStoryStage(childId) {
      const filePath = getStoryStageFilePath(childId);
      if (!fs.existsSync(filePath)) {
        return { success: false };
      }
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const stageData = JSON.parse(fileContent);
      return {
        success: true,
        stageData
      };
    }
  };
}

module.exports = {
  createSessionStateManager
};
