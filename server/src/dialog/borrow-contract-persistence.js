/**
 * 借分契约持久化 - Issue #24 借分契约跨会话持久化
 *
 * 参考PRD §4.3 借分契约机制：孩子连续 3 次会议拒绝推进教学剧情 → 第 4 次会议触发借分契约
 *
 * 现有的内存状态机（borrow-contract-state.js）不跨会话持久化，
 * 本模块负责将拒绝计数与当前状态落盘，使计数可跨会议累积。
 *
 * 文件路径模式：borrow_state_{childId}.json（与 profile-persistence.js 的 profile_{childId}.json 对齐）
 * 存储格式：JSON，含 refusalCount / currentState / lastUpdated 字段
 */

const fs = require('fs');
const path = require('path');

/**
 * 创建借分契约持久化实例
 * @param {object} [options]
 * @param {string} [options.storageDir] - 存储目录，默认为 '../../data'
 * @returns {{
 *   loadState: (childId: string) => ({ refusalCount: number, currentState: string, lastUpdated: string } | null),
 *   saveState: (childId: string, state: { refusalCount: number, currentState: string }) => ({ success: boolean, path: string, timestamp: string }),
 *   resetState: (childId: string) => ({ success: boolean, path: string })
 * }}
 */
function createBorrowContractPersistence(options = {}) {
  const storageDir = options.storageDir || path.join(__dirname, '..', '..', 'data');

  /**
   * 计算指定孩子的状态文件路径
   * @param {string} childId
   * @returns {string}
   */
  function getFilePath(childId) {
    return path.join(storageDir, `borrow_state_${childId}.json`);
  }

  return {
    /**
     * 读取借分契约状态
     * @param {string} childId - 孩子ID
     * @returns {{ refusalCount: number, currentState: string, lastUpdated: string } | null} 无记录时返回 null
     */
    loadState(childId) {
      const filePath = getFilePath(childId);

      // 文件不存在时返回 null（不抛错）
      if (!fs.existsSync(filePath)) {
        return null;
      }

      // 读取并解析 JSON
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileContent);

      return {
        refusalCount: data.refusalCount,
        currentState: data.currentState,
        lastUpdated: data.lastUpdated
      };
    },

    /**
     * 保存借分契约状态
     * @param {string} childId - 孩子ID
     * @param {{ refusalCount: number, currentState: string }} state - 待保存状态
     * @returns {{ success: boolean, path: string, timestamp: string }}
     */
    saveState(childId, state) {
      const filePath = getFilePath(childId);

      // 如果目录不存在，自动创建
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      // 添加 lastUpdated 时间戳字段
      const timestamp = new Date().toISOString();
      const dataToSave = {
        refusalCount: state.refusalCount,
        currentState: state.currentState,
        lastUpdated: timestamp
      };

      // 写入文件（JSON 格式化输出）
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');

      return {
        success: true,
        path: filePath,
        timestamp
      };
    },

    /**
     * 清除借分契约状态（删除文件）
     * @param {string} childId - 孩子ID
     * @returns {{ success: boolean, path: string }} 即使文件不存在也返回 success:true
     */
    resetState(childId) {
      const filePath = getFilePath(childId);

      // 文件存在则删除，不存在也视为成功
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return {
        success: true,
        path: filePath
      };
    }
  };
}

module.exports = { createBorrowContractPersistence };
