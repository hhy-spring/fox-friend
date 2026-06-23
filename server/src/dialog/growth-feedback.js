/**
 * 成长反馈管理器 - Issue #10 关系保鲜机制
 *
 * 参考Issue #10 验收标准：
 *   - 成长反馈：session_count % 3 == 0 → 总结孩子已教过多少个字/帮过多少次忙
 *   - 成长反馈可读项：items_learned 总数、故事阶段进度、连续学习天数
 *   - 所有保鲜机制不与教学内容冲突，嵌入在对话开场或结尾
 *
 * 职责：
 *   1. 判断当前会话是否应触发成长反馈（sessionCount % 3 === 0 且 > 0）
 *   2. 计算成长统计数据（已学字数、故事阶段进度、连续学习天数等）
 *   3. 生成个性化成长反馈台词，嵌入对话开场或结尾
 */

const { STORY_STAGES } = require('./story-stage-manager');

// 默认画像值（childProfile 缺失时使用）
const DEFAULT_NICKNAME = '小伙伴';
const DEFAULT_FOX_NAME = '小狐狸';

/**
 * 创建成长反馈管理器
 * @param {object} [options={}] - 配置项
 * @returns {object} 成长反馈管理器实例
 */
function createGrowthFeedbackManager(options = {}) {
  return {
    /**
     * 判断当前会话是否应触发成长反馈
     * @param {number} sessionCount - 当前会话序号
     * @returns {boolean} - sessionCount % 3 === 0 且 sessionCount > 0 时返回 true
     */
    shouldTrigger(sessionCount) {
      return sessionCount > 0 && sessionCount % 3 === 0;
    },

    /**
     * 计算成长统计数据
     * @param {object|null} childProfile - 孩子画像 { nickname, foxName, story_stage }
     * @param {object[]} allSessions - 所有历史会话列表
     * @returns {{ totalItemsLearned: number, storyStageProgress: string, consecutiveLearningDays: number }}
     */
    calculateStats(childProfile, allSessions) {
      const sessions = Array.isArray(allSessions) ? allSessions : [];

      // 统计已学字数：所有会话 items_learned 数组的总条数
      const totalItemsLearned = sessions.reduce((sum, session) => {
        const items = session && session.items_learned;
        if (Array.isArray(items)) {
          return sum + items.length;
        }
        return sum;
      }, 0);

      // 确定当前故事阶段索引
      // 优先从 childProfile 取，其次从最近一次会话取，默认为0
      let stageIndex = 0;
      if (childProfile && typeof childProfile.story_stage === 'number') {
        stageIndex = childProfile.story_stage;
      } else if (sessions.length > 0) {
        // 从最近一次会话获取 story_stage
        const lastSession = sessions[sessions.length - 1];
        if (lastSession && typeof lastSession.story_stage === 'number') {
          stageIndex = lastSession.story_stage;
        }
      }
      // 确保索引在有效范围内
      if (stageIndex < 0) stageIndex = 0;
      if (stageIndex >= STORY_STAGES.length) {
        stageIndex = STORY_STAGES.length - 1;
      }

      const stageName = STORY_STAGES[stageIndex].name;
      const storyStageProgress = `${stageName}阶段 (${stageIndex + 1}/${STORY_STAGES.length})`;

      // 计算连续学习天数：从最近一天往回数连续的天数
      const consecutiveLearningDays = calculateConsecutiveDays(sessions);

      return {
        totalItemsLearned,
        storyStageProgress,
        consecutiveLearningDays
      };
    },

    /**
     * 格式化成长反馈台词
     * @param {{ totalItemsLearned: number, storyStageProgress: string, consecutiveLearningDays: number }} stats
     * @param {object|null} childProfile - 孩子画像
     * @returns {string} 反馈台词
     */
    formatFeedbackText(stats, childProfile) {
      const profile = childProfile || {};
      const nickname = profile.nickname || DEFAULT_NICKNAME;
      const foxName = profile.foxName || DEFAULT_FOX_NAME;

      const parts = [];

      // 已学字数反馈
      if (stats.totalItemsLearned > 0) {
        parts.push(`${nickname}，你知道吗？你已经教了我${stats.totalItemsLearned}个字了！你真是我最棒的搭档！`);
      }

      // 故事阶段进度反馈
      if (stats.storyStageProgress) {
        // 提取阶段名称（去掉"阶段"后缀和进度数字）
        const stageName = stats.storyStageProgress.replace(/阶段.*$/, '');
        parts.push(`${foxName}！你帮了我${stats.totalItemsLearned || 0}次忙了！我们的故事已经走到${stageName}那一步了！`);
      }

      // 连续学习天数反馈
      if (stats.consecutiveLearningDays > 1) {
        parts.push(`你太厉害了！你已经连续${stats.consecutiveLearningDays}天来找我玩了！`);
      }

      // 如果没有任何可反馈的内容，返回鼓励台词
      if (parts.length === 0) {
        parts.push(`${nickname}，我们继续加油吧！`);
      }

      return parts.join('');
    },

    /**
     * 生成完整成长反馈
     * @param {number} sessionCount - 当前会话序号
     * @param {object|null} childProfile - 孩子画像
     * @param {object[]} allSessions - 所有历史会话列表
     * @returns {{ triggered: boolean, feedbackText: string, stats: object }}
     */
    generateFeedback(sessionCount, childProfile, allSessions) {
      const stats = this.calculateStats(childProfile, allSessions);

      if (!this.shouldTrigger(sessionCount)) {
        return {
          triggered: false,
          feedbackText: '',
          stats
        };
      }

      const feedbackText = this.formatFeedbackText(stats, childProfile);

      return {
        triggered: true,
        feedbackText,
        stats
      };
    }
  };
}

/**
 * 计算连续学习天数
 * 从最近一天往回数，遇到不连续的日期就停止
 * @param {object[]} sessions - 会话列表
 * @returns {number} 连续学习天数
 */
function calculateConsecutiveDays(sessions) {
  if (!sessions || sessions.length === 0) {
    return 0;
  }

  // 提取所有日期（去重，只取日期部分）
  const dateSet = new Set();
  for (const session of sessions) {
    if (session && session.saved_at) {
      const date = new Date(session.saved_at);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dateSet.add(dateStr);
    }
  }

  if (dateSet.size === 0) {
    return 0;
  }

  // 排序日期（升序）
  const sortedDates = Array.from(dateSet).sort();

  // 从最后一天往回数连续天数
  let consecutive = 1;
  for (let i = sortedDates.length - 1; i > 0; i--) {
    const current = new Date(sortedDates[i]);
    const prev = new Date(sortedDates[i - 1]);
    const diffMs = current.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      consecutive++;
    } else {
      break;
    }
  }

  return consecutive;
}

module.exports = {
  createGrowthFeedbackManager
};
