/**
 * 情感连接指标追踪器 - Issue #28
 *
 * 参考PRD §6.3 验证指标：
 *   - 孩子主动说话次数（3分钟内 ≥3 次 = 情感连接建立）
 *   - 留存意愿（"我明天还来"等表达）
 *
 * 参考技术架构文档§五 MVP验证指标：
 *   | 情感连接建立 | 3分钟内主动说话≥3次 | #1 + #2 + #5 |
 *
 * 职责：
 *   1. 记录每会话孩子主动说话次数
 *   2. 检测并记录留存意愿
 *   3. 输出 first_meeting_reactions 结构供持久化
 */

// 留存意愿关键词（参考PRD §6.3 "我明天还来"等表达）
const RETENTION_KEYWORDS = ['明天见', '还来', '再来', '找你玩', '明天还来'];

// 情感连接建立阈值：3分钟内主动说话≥3次（PRD §6.3）
const EMOTIONAL_CONNECTION_THRESHOLD = 3;

/**
 * 检测文本是否表达留存意愿
 * @param {string} text - 孩子说的话
 * @returns {boolean}
 */
function detectRetentionIntention(text) {
  if (!text) return false;
  return RETENTION_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * 创建情感连接指标追踪器
 * @param {string} sessionId - 会话 ID
 * @param {string} childId - 孩子 ID
 * @returns {object} 指标追踪器实例
 */
function createMetricsTracker(sessionId, childId) {
  let proactiveSpeechCount = 0;
  let retentionIntention = false;

  return {
    /**
     * 记录一次孩子说话（同时检测留存意愿）
     * @param {string} content - 孩子说的内容
     */
    recordSpeech(content) {
      if (content && content.trim().length > 0) {
        proactiveSpeechCount++;
        if (detectRetentionIntention(content)) {
          retentionIntention = true;
        }
      }
    },

    /**
     * 显式记录留存意愿表达（独立于 recordSpeech 的场景使用）
     * @param {string} text - 孩子说的话
     */
    recordRetention(text) {
      if (detectRetentionIntention(text)) {
        retentionIntention = true;
      }
    },

    /**
     * 获取当前指标快照
     * @returns {{ proactive_speech_count: number, retention_intention: boolean, emotional_connection_established: boolean }}
     */
    getMetrics() {
      return {
        proactive_speech_count: proactiveSpeechCount,
        retention_intention: retentionIntention,
        emotional_connection_established: proactiveSpeechCount >= EMOTIONAL_CONNECTION_THRESHOLD
      };
    },

    /**
     * 输出 first_meeting_reactions 结构（用于持久化到 child_profiles）
     * 参考PRD §4.1 画像数据结构 first_meeting_reactions
     * @returns {{ first_meeting_reactions: object }}
     */
    toProfileField() {
      return {
        first_meeting_reactions: {
          proactive_speech_count: proactiveSpeechCount,
          teaching_willingness: null,
          partner_acceptance: null,
          retention_intention: retentionIntention
        }
      };
    }
  };
}

module.exports = { createMetricsTracker, detectRetentionIntention, RETENTION_KEYWORDS };
