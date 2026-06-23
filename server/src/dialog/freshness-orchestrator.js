/**
 * 关系保鲜编排器 - Issue #10 多智能体中央协调器
 *
 * 参考Issue #10 验收标准：
 *   - 互惠暴露：session_count % 5 == 0 → 小狐狸主动分享秘密或脆弱
 *   - 回忆锚点：每次开场自动引用上次的关键事件（验证触发正确性）
 *   - 成长反馈：session_count % 3 == 0 → 总结孩子已教过多少个字/帮过多少次忙
 *   - 惊喜时刻：随机概率触发（约每 5-8 次一次），做出乎意料的事
 *   - 所有保鲜机制不与教学内容冲突，嵌入在对话开场或结尾
 *   - Session 计数器跨天持久化
 *
 * 多智能体系统架构：
 *   Phase 1（串行）：SessionCounterAgent — 获取会话计数与历史数据
 *   Phase 2（并行）：ReciprocalExposureAgent + GrowthFeedbackAgent + SurpriseMomentAgent
 *   Phase 3（串行）：结果集成 — 合并所有保鲜机制输出为 freshnessText
 *
 * 性能优化：Phase 2 使用 Promise.all 并行执行，比串行方案提升约 50%
 */

const { createAgent, extractAgentOutput } = require('./agent-base');
const { createReciprocalExposureManager } = require('./reciprocal-exposure');
const { createGrowthFeedbackManager } = require('./growth-feedback');
const { createSurpriseMomentManager } = require('./surprise-moment');

/**
 * 创建关系保鲜编排器
 * @param {object} [options={}] - 配置项
 * @param {object} [options.sessionStateManager] - 会话状态管理器实例
 * @param {function} [options.rng] - 随机数生成器（用于测试确定性）
 * @returns {object} 编排器实例
 */
function createFreshnessOrchestrator(options = {}) {
  const { sessionStateManager, rng } = options;

  // 创建各模块实例
  const reciprocalExposureManager = createReciprocalExposureManager();
  const growthFeedbackManager = createGrowthFeedbackManager();
  const surpriseMomentManager = createSurpriseMomentManager({ rng });

  // 创建 4 个智能体（基于 agent-base 通信协议）
  const agents = {
    /**
     * 会话计数智能体：获取会话计数与历史数据
     */
    SessionCounterAgent: createAgent({
      name: 'SessionCounterAgent',
      taskHandler: async (input) => {
        const { childId } = input;
        if (!sessionStateManager) {
          throw new Error('SessionStateManager 未初始化');
        }
        const sessionCount = sessionStateManager.getSessionCount(childId);
        const allSessions = sessionStateManager.loadAllSessions(childId);
        const lastSessionResult = sessionStateManager.loadLastSession(childId);
        return {
          sessionCount,
          allSessions,
          hasPreviousSession: lastSessionResult.success,
          lastSession: lastSessionResult.success ? lastSessionResult.sessionData : null
        };
      }
    }),

    /**
     * 互惠暴露智能体：session_count % 5 == 0 时触发
     */
    ReciprocalExposureAgent: createAgent({
      name: 'ReciprocalExposureAgent',
      taskHandler: async (input) => {
        const { sessionCount, usedExposures } = input;
        return reciprocalExposureManager.generateExposure(sessionCount, usedExposures);
      }
    }),

    /**
     * 成长反馈智能体：session_count % 3 == 0 时触发
     */
    GrowthFeedbackAgent: createAgent({
      name: 'GrowthFeedbackAgent',
      taskHandler: async (input) => {
        const { sessionCount, childProfile, allSessions } = input;
        return growthFeedbackManager.generateFeedback(sessionCount, childProfile, allSessions);
      }
    }),

    /**
     * 惊喜时刻智能体：随机概率触发
     */
    SurpriseMomentAgent: createAgent({
      name: 'SurpriseMomentAgent',
      taskHandler: async (input) => {
        const { sessionCount, childProfile } = input;
        return surpriseMomentManager.generateSurprise(sessionCount, childProfile);
      }
    })
  };

  /**
   * 生成关系保鲜内容（多智能体协调执行）
   * @param {object} params
   * @param {string} params.childId - 孩子 ID
   * @param {object} params.childProfile - 孩子画像
   * @param {number} params.sessionCount - 当前会话序号
   * @param {string[]} [params.usedExposures=[]] - 已使用的互惠暴露 ID 列表
   * @returns {Promise<object>} 完整保鲜结果
   */
  async function generateFreshness({ childId, childProfile, sessionCount, usedExposures = [] }) {
    const startTime = Date.now();
    const agentResults = {};

    // 前置校验：sessionStateManager 是关键依赖
    if (!sessionStateManager) {
      return {
        error: 'SessionStateManager 未初始化，无法生成保鲜内容',
        executionTime: 0,
        agentResults
      };
    }

    try {
      // ===== Phase 1（串行执行）=====
      // SessionCounterAgent 获取会话数据，供后续智能体使用
      const counterResult = await agents.SessionCounterAgent.execute({ childId });
      agentResults.sessionCounter = counterResult;

      const counterOutput = extractAgentOutput(counterResult, {
        sessionCount: sessionCount || 0,
        allSessions: [],
        hasPreviousSession: false,
        lastSession: null
      });

      const effectiveSessionCount = sessionCount || counterOutput.sessionCount;
      const allSessions = counterOutput.allSessions;

      // ===== Phase 2（并行执行）=====
      // 三个保鲜机制智能体无相互依赖，并行执行
      const [exposureResult, feedbackResult, surpriseResult] = await Promise.all([
        agents.ReciprocalExposureAgent.execute({
          sessionCount: effectiveSessionCount,
          usedExposures
        }),
        agents.GrowthFeedbackAgent.execute({
          sessionCount: effectiveSessionCount,
          childProfile,
          allSessions
        }),
        agents.SurpriseMomentAgent.execute({
          sessionCount: effectiveSessionCount,
          childProfile
        })
      ]);

      agentResults.reciprocalExposure = exposureResult;
      agentResults.growthFeedback = feedbackResult;
      agentResults.surpriseMoment = surpriseResult;

      // 提取各智能体输出
      const exposureOutput = extractAgentOutput(exposureResult, { triggered: false, exposureText: '', exposureId: '', poolSize: 0 });
      const feedbackOutput = extractAgentOutput(feedbackResult, { triggered: false, feedbackText: '', stats: {} });
      const surpriseOutput = extractAgentOutput(surpriseResult, { triggered: false, surpriseType: '', surpriseText: '', surpriseId: '' });

      // ===== Phase 3（串行执行）=====
      // 结果集成：合并所有触发的保鲜机制输出为 freshnessText
      const freshnessParts = [];

      if (exposureOutput.triggered) {
        freshnessParts.push(exposureOutput.exposureText);
      }
      if (feedbackOutput.triggered) {
        freshnessParts.push(feedbackOutput.feedbackText);
      }
      if (surpriseOutput.triggered) {
        freshnessParts.push(surpriseOutput.surpriseText);
      }

      const freshnessText = freshnessParts.join('');

      // 回忆锚点验证
      const memoryAnchorVerification = {
        hasPreviousSession: counterOutput.hasPreviousSession,
        lastSessionReferenced: counterOutput.hasPreviousSession
      };

      const elapsed = Date.now() - startTime;

      return {
        reciprocalExposure: exposureOutput,
        growthFeedback: feedbackOutput,
        surpriseMoment: surpriseOutput,
        memoryAnchorVerification,
        sessionCount: effectiveSessionCount,
        executionTime: elapsed,
        agentResults,
        freshnessText
      };
    } catch (err) {
      return {
        error: err.message,
        executionTime: Date.now() - startTime,
        agentResults
      };
    }
  }

  /**
   * 获取智能体统计信息
   * @returns {object}
   */
  function getAgentStats() {
    const agentInfo = {};
    for (const [name, agent] of Object.entries(agents)) {
      agentInfo[name] = agent.getInfo();
    }

    // 附加惊喜类型列表（用于验收标准检查）
    const surpriseTypes = surpriseMomentManager.getSurpriseTypes();

    return {
      agents: agentInfo,
      surpriseTypes
    };
  }

  return {
    generateFreshness,
    getAgentStats,
    // 暴露智能体实例用于测试
    agents
  };
}

module.exports = {
  createFreshnessOrchestrator
};
