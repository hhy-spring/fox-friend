/**
 * 每日见面开场编排器 - Issue #7 多智能体中央协调器
 *
 * 参考PRD §4.2 每日见面流程 + §4.5.3 变化一 开场方式
 * 参考技术架构文档§三「对话引擎架构」
 *
 * 多智能体系统架构：
 *   Phase 1（并行）：StoryStageAgent + ToneEvolutionAgent + SessionStateAgent
 *   Phase 2（串行）：MemoryAnchorAgent（依赖 SessionState 结果）
 *   Phase 3（串行）：OpeningTemplateAgent（依赖所有前置结果）
 *
 * 性能优化：Phase 1 使用 Promise.all 并行执行，比串行方案提升约 50%
 */

const { createAgent, extractAgentOutput } = require('./agent-base');
const { createStoryStageManager, STORY_STAGES } = require('./story-stage-manager');
const { createToneEvolutionManager } = require('./tone-evolution');
const { createMemoryAnchorGenerator } = require('./memory-anchor');
const { createOpeningTemplateGenerator } = require('./opening-templates');
const { createFreshnessOrchestrator } = require('./freshness-orchestrator');

/**
 * 创建每日见面开场编排器
 * @param {object} options
 * @param {object} options.sessionStateManager - 会话状态管理器实例
 * @returns {object} 编排器实例
 */
function createDailyMeetingOrchestrator(options = {}) {
  const { sessionStateManager } = options;

  // 创建各模块实例
  const toneEvolutionManager = createToneEvolutionManager();
  const memoryAnchorGenerator = createMemoryAnchorGenerator();
  const openingTemplateGenerator = createOpeningTemplateGenerator();
  const freshnessOrchestrator = createFreshnessOrchestrator({ sessionStateManager });

  // 创建 5 个智能体（基于 agent-base 通信协议）
  const agents = {
    StoryStageAgent: createAgent({
      name: 'StoryStageAgent',
      taskHandler: async (input) => {
        const { childId, storyStageData } = input;
        const stageManager = createStoryStageManager(childId, {
          initialStageIndex: storyStageData ? storyStageData.currentStageIndex : 0
        });
        return {
          currentStage: stageManager.getCurrentStage(),
          stageIndex: stageManager.getStageIndex(),
          transition: stageManager.getStageTransition(),
          serialized: stageManager.toJSON()
        };
      }
    }),

    ToneEvolutionAgent: createAgent({
      name: 'ToneEvolutionAgent',
      taskHandler: async (input) => {
        const { sessionCount } = input;
        return {
          phase: toneEvolutionManager.getTonePhase(sessionCount),
          vulnerabilityLevel: toneEvolutionManager.getVulnerabilityLevel(sessionCount),
          modifiers: toneEvolutionManager.getToneModifiers(sessionCount),
          description: toneEvolutionManager.getToneDescription(sessionCount)
        };
      }
    }),

    SessionStateAgent: createAgent({
      name: 'SessionStateAgent',
      taskHandler: async (input) => {
        const { childId } = input;
        if (!sessionStateManager) {
          throw new Error('SessionStateManager 未初始化');
        }
        const lastSessionResult = sessionStateManager.loadLastSession(childId);
        const sessionCount = sessionStateManager.getSessionCount(childId);
        return {
          lastSession: lastSessionResult.success ? lastSessionResult.sessionData : null,
          sessionCount,
          hasPreviousSession: lastSessionResult.success
        };
      }
    }),

    MemoryAnchorAgent: createAgent({
      name: 'MemoryAnchorAgent',
      taskHandler: async (input) => {
        const { previousSession, childProfile } = input;
        return memoryAnchorGenerator.generateAnchor(previousSession, childProfile);
      }
    }),

    OpeningTemplateAgent: createAgent({
      name: 'OpeningTemplateAgent',
      taskHandler: async (input) => {
        const { childProfile, sessionCount, previousSession, storyStage, tonePhase, memoryAnchor } = input;
        return openingTemplateGenerator.generateOpening({
          childProfile,
          sessionCount,
          previousSession,
          storyStage,
          tonePhase,
          memoryAnchor
        });
      }
    })
  };

  /**
   * 生成每日见面开场（多智能体协调执行）
   * @param {object} params
   * @param {string} params.childId - 孩子 ID
   * @param {object} params.childProfile - 孩子画像
   * @param {number} params.sessionCount - 当前会话序号
   * @returns {Promise<object>} 完整开场结果
   */
  async function generateDailyOpening({ childId, childProfile, sessionCount }) {
    const startTime = Date.now();
    const agentResults = {};

    // 前置校验：sessionStateManager 是关键依赖
    if (!sessionStateManager) {
      return {
        error: 'SessionStateManager 未初始化，无法生成每日开场',
        executionTime: 0,
        agentResults
      };
    }

    try {
      // ===== Phase 1（并行执行）=====
      // StoryStageAgent、ToneEvolutionAgent、SessionStateAgent 无相互依赖，并行执行
      const profile = childProfile || { nickname: '小伙伴', foxName: '小狐狸' };

      // 加载故事阶段持久化数据（如果有）
      let storyStageData = null;
      if (sessionStateManager) {
        const stageResult = sessionStateManager.loadStoryStage(childId);
        if (stageResult.success) {
          storyStageData = stageResult.stageData;
        }
      }

      const [storyResult, toneResult, sessionResult] = await Promise.all([
        agents.StoryStageAgent.execute({ childId, storyStageData }),
        agents.ToneEvolutionAgent.execute({ sessionCount }),
        agents.SessionStateAgent.execute({ childId })
      ]);

      agentResults.storyStage = storyResult;
      agentResults.toneEvolution = toneResult;
      agentResults.sessionState = sessionResult;

      // 如果 Phase 1 有错误，收集但不中断（优雅降级）
      const phase1Errors = [storyResult, toneResult, sessionResult]
        .filter(r => r.status === 'error')
        .map(r => ({ agent: r.agentName, error: r.error }));

      // ===== Phase 2（串行执行）=====
      // MemoryAnchorAgent 依赖 SessionStateAgent 的结果
      const sessionOutput = extractAgentOutput(sessionResult, { lastSession: null });
      const previousSession = sessionOutput.lastSession;
      const memoryResult = await agents.MemoryAnchorAgent.execute({
        previousSession,
        childProfile: profile
      });
      agentResults.memoryAnchor = memoryResult;

      // ===== Phase 3（串行执行）=====
      // OpeningTemplateAgent 依赖所有前置结果
      const storyStage = extractAgentOutput(storyResult, { currentStage: STORY_STAGES[0] }).currentStage;
      const tonePhase = extractAgentOutput(toneResult, { phase: { phase: 'familiar', phaseName: '熟悉' } }).phase;
      const memoryAnchor = extractAgentOutput(memoryResult, { hasAnchor: false, anchorText: '', referencedItems: [], anchorType: 'none' });

      const openingResult = await agents.OpeningTemplateAgent.execute({
        childProfile: profile,
        sessionCount,
        previousSession,
        storyStage,
        tonePhase,
        memoryAnchor
      });
      agentResults.openingTemplate = openingResult;

      const elapsed = Date.now() - startTime;

      // ===== 构建完整结果 =====
      if (openingResult.status === 'error') {
        return {
          error: openingResult.error,
          agentResults,
          executionTime: elapsed
        };
      }

      return {
        openingText: openingResult.output.openingText,
        components: openingResult.output.components,
        storyStage,
        tonePhase,
        memoryAnchor,
        executionTime: elapsed,
        agentResults,
        phase1Errors: phase1Errors.length > 0 ? phase1Errors : undefined,
        // Issue #10: 关系保鲜机制集成
        freshness: await freshnessOrchestrator.generateFreshness({
          childId,
          childProfile: profile,
          sessionCount,
          usedExposures: (profile && profile.usedExposures) || []
        })
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
    return { agents: agentInfo };
  }

  return {
    generateDailyOpening,
    getAgentStats,
    // 暴露智能体实例用于测试
    agents
  };
}

module.exports = {
  createDailyMeetingOrchestrator
};
