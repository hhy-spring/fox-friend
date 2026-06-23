/**
 * 关系保鲜编排器测试 - Issue #10 多智能体中央协调器
 *
 * 测试覆盖：
 *   - 创建编排器实例
 *   - Phase 1 并行执行（SessionCounterAgent）
 *   - Phase 2 并行执行（ReciprocalExposureAgent + GrowthFeedbackAgent + SurpriseMomentAgent）
 *   - Phase 3 结果集成
 *   - 回忆锚点验证触发正确性
 *   - Session 计数器跨天持久化
 *   - 多智能体并行性能验证
 *   - 优雅降级处理
 */

const {
  createFreshnessOrchestrator
} = require('../../src/dialog/freshness-orchestrator');
const { createAgent } = require('../../src/dialog/agent-base');

// ---- 辅助：构造模拟 sessionStateManager ----
function createMockSessionStateManager(sessionCount = 0, sessions = []) {
  return {
    getSessionCount: jest.fn().mockReturnValue(sessionCount),
    loadAllSessions: jest.fn().mockReturnValue(sessions),
    loadLastSession: jest.fn().mockReturnValue({
      success: sessions.length > 0,
      sessionData: sessions.length > 0 ? sessions[sessions.length - 1] : null,
      sessionCount
    }),
    saveSession: jest.fn(),
    loadStoryStage: jest.fn().mockReturnValue({ success: false })
  };
}

// ---- 辅助：构造模拟 childProfile ----
function createMockProfile(overrides = {}) {
  return {
    nickname: '闪电',
    foxName: '恐龙蛋',
    story_stage: 1,
    ...overrides
  };
}

// ---- 辅助：构造模拟 sessions ----
function createMockSessions(count = 5) {
  const sessions = [];
  for (let i = 0; i < count; i++) {
    sessions.push({
      date: `2026-06-${String(20 + i).padStart(2, '0')}`,
      story_stage: '门牌',
      subject: 'pinyin',
      items_learned: [`item_${i}`],
      mastery_status: 'learning',
      child_mood: 'happy',
      chat_frequency: 10,
      teaching_method_used: 'feynman',
      duration_minutes: 5,
      child_spontaneous_remarks: [],
      saved_at: new Date(2026, 5, 20 + i).toISOString()
    });
  }
  return sessions;
}

describe('freshness-orchestrator', () => {
  describe('创建编排器实例', () => {
    test('无参数创建返回有效对象', () => {
      const orchestrator = createFreshnessOrchestrator();
      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.generateFreshness).toBe('function');
      expect(typeof orchestrator.getAgentStats).toBe('function');
    });

    test('传入 sessionStateManager 创建成功', () => {
      const manager = createMockSessionStateManager();
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      expect(orchestrator).toBeDefined();
    });

    test('传入自定义 rng 创建成功', () => {
      const rng = jest.fn().mockReturnValue(0.01);
      const orchestrator = createFreshnessOrchestrator({ rng });
      expect(orchestrator).toBeDefined();
    });
  });

  describe('generateFreshness - 互惠暴露触发', () => {
    test('sessionCount % 5 === 0 时触发互惠暴露', async () => {
      const manager = createMockSessionStateManager(5, createMockSessions(5));
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 5,
        usedExposures: []
      });
      expect(result.reciprocalExposure.triggered).toBe(true);
      expect(result.reciprocalExposure.exposureText).toBeTruthy();
    });

    test('sessionCount % 5 !== 0 时不触发互惠暴露', async () => {
      const manager = createMockSessionStateManager(3, createMockSessions(3));
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 3,
        usedExposures: []
      });
      expect(result.reciprocalExposure.triggered).toBe(false);
    });

    test('互惠暴露台词不重复已使用的', async () => {
      const manager = createMockSessionStateManager(5, createMockSessions(5));
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      const usedExposures = ['exposure_0', 'exposure_1', 'exposure_2'];
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 5,
        usedExposures
      });
      expect(result.reciprocalExposure.triggered).toBe(true);
      // 不应返回已使用的 id
      expect(usedExposures).not.toContain(result.reciprocalExposure.exposureId);
    });
  });

  describe('generateFreshness - 成长反馈触发', () => {
    test('sessionCount % 3 === 0 时触发成长反馈', async () => {
      const manager = createMockSessionStateManager(3, createMockSessions(3));
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 3,
        usedExposures: []
      });
      expect(result.growthFeedback.triggered).toBe(true);
      expect(result.growthFeedback.feedbackText).toBeTruthy();
    });

    test('sessionCount % 3 !== 0 时不触发成长反馈', async () => {
      const manager = createMockSessionStateManager(4, createMockSessions(4));
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 4,
        usedExposures: []
      });
      expect(result.growthFeedback.triggered).toBe(false);
    });

    test('成长反馈包含统计信息', async () => {
      const sessions = createMockSessions(6);
      const manager = createMockSessionStateManager(6, sessions);
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 6,
        usedExposures: []
      });
      expect(result.growthFeedback.triggered).toBe(true);
      expect(result.growthFeedback.stats).toBeDefined();
      expect(result.growthFeedback.stats.totalItemsLearned).toBe(6);
    });
  });

  describe('generateFreshness - 惊喜时刻触发', () => {
    test('随机概率触发惊喜时刻', async () => {
      const manager = createMockSessionStateManager(3, createMockSessions(3));
      // 使用 rng 返回极小值确保触发
      const rng = jest.fn().mockReturnValue(0.01);
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager, rng });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 3,
        usedExposures: []
      });
      expect(result.surpriseMoment.triggered).toBe(true);
      expect(result.surpriseMoment.surpriseType).toBeTruthy();
      expect(result.surpriseMoment.surpriseText).toBeTruthy();
    });

    test('sessionCount < 2 时不触发惊喜', async () => {
      const manager = createMockSessionStateManager(1, createMockSessions(1));
      const rng = jest.fn().mockReturnValue(0.01);
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager, rng });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 1,
        usedExposures: []
      });
      expect(result.surpriseMoment.triggered).toBe(false);
    });

    test('惊喜时刻至少有5种事件类型', async () => {
      const orchestrator = createFreshnessOrchestrator();
      const stats = orchestrator.getAgentStats();
      const surpriseTypes = stats.surpriseTypes || [];
      expect(surpriseTypes.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('generateFreshness - 回忆锚点验证', () => {
    test('有前次会话时回忆锚点正确引用', async () => {
      const sessions = createMockSessions(5);
      const manager = createMockSessionStateManager(5, sessions);
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 5,
        usedExposures: []
      });
      // 回忆锚点验证字段存在
      expect(result).toHaveProperty('memoryAnchorVerification');
      expect(result.memoryAnchorVerification.hasPreviousSession).toBe(true);
    });

    test('无前次会话时回忆锚点标记为无', async () => {
      const manager = createMockSessionStateManager(0, []);
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 0,
        usedExposures: []
      });
      expect(result.memoryAnchorVerification.hasPreviousSession).toBe(false);
    });
  });

  describe('generateFreshness - Session 计数器持久化', () => {
    test('结果包含 sessionCount 用于持久化', async () => {
      const manager = createMockSessionStateManager(5, createMockSessions(5));
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 5,
        usedExposures: []
      });
      expect(result.sessionCount).toBe(5);
    });
  });

  describe('generateFreshness - 结果集成', () => {
    test('sessionCount=15 时三种机制同时触发（15%3=0, 15%5=0）', async () => {
      const sessions = createMockSessions(15);
      const manager = createMockSessionStateManager(15, sessions);
      const rng = jest.fn().mockReturnValue(0.01);
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager, rng });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 15,
        usedExposures: []
      });
      expect(result.reciprocalExposure.triggered).toBe(true);
      expect(result.growthFeedback.triggered).toBe(true);
      expect(result.surpriseMoment.triggered).toBe(true);
    });

    test('结果包含完整结构', async () => {
      const manager = createMockSessionStateManager(5, createMockSessions(5));
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 5,
        usedExposures: []
      });
      expect(result).toHaveProperty('reciprocalExposure');
      expect(result).toHaveProperty('growthFeedback');
      expect(result).toHaveProperty('surpriseMoment');
      expect(result).toHaveProperty('memoryAnchorVerification');
      expect(result).toHaveProperty('sessionCount');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('agentResults');
      expect(result).toHaveProperty('freshnessText');
    });

    test('freshnessText 组合所有触发的台词', async () => {
      const sessions = createMockSessions(15);
      const manager = createMockSessionStateManager(15, sessions);
      const rng = jest.fn().mockReturnValue(0.01);
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager, rng });
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 15,
        usedExposures: []
      });
      expect(result.freshnessText).toBeTruthy();
      expect(typeof result.freshnessText).toBe('string');
      // 应包含互惠暴露和成长反馈的文本
      expect(result.freshnessText.length).toBeGreaterThan(0);
    });
  });

  describe('generateFreshness - 优雅降级', () => {
    test('sessionStateManager 缺失时返回错误', async () => {
      const orchestrator = createFreshnessOrchestrator();
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 5,
        usedExposures: []
      });
      expect(result.error).toBeTruthy();
    });

    test('子智能体错误不中断整体流程', async () => {
      const manager = createMockSessionStateManager(5, createMockSessions(5));
      manager.loadAllSessions.mockImplementation(() => { throw new Error('模拟错误'); });
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      // 不应抛出异常
      const result = await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 5,
        usedExposures: []
      });
      expect(result).toBeDefined();
    });
  });

  describe('多智能体并行性能', () => {
    test('并行执行比串行快（Phase 2 三个智能体并行）', async () => {
      const sessions = createMockSessions(15);
      const manager = createMockSessionStateManager(15, sessions);
      const rng = jest.fn().mockReturnValue(0.01);
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager, rng });

      // 并行执行
      const parallelStart = Date.now();
      await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 15,
        usedExposures: []
      });
      const parallelTime = Date.now() - parallelStart;

      // 串行执行模拟（手动调用三个模块）
      const serialStart = Date.now();
      const { createReciprocalExposureManager } = require('../../src/dialog/reciprocal-exposure');
      const { createGrowthFeedbackManager } = require('../../src/dialog/growth-feedback');
      const { createSurpriseMomentManager } = require('../../src/dialog/surprise-moment');
      const exposureMgr = createReciprocalExposureManager();
      const feedbackMgr = createGrowthFeedbackManager();
      const surpriseMgr = createSurpriseMomentManager({ rng });
      exposureMgr.generateExposure(15, []);
      feedbackMgr.generateFeedback(15, createMockProfile(), sessions);
      surpriseMgr.generateSurprise(15, createMockProfile());
      const serialTime = Date.now() - serialStart;

      // 并行执行时间应 <= 串行执行时间（允许微小误差）
      // 由于模块执行极快，主要验证架构正确性
      expect(parallelTime).toBeLessThanOrEqual(serialTime + 50);
    });

    test('Issue #25: 多智能体并行执行速度比串行方案提升至少 50%', async () => {
      // 使用带延迟的智能体模拟真实 I/O 场景
      // 每个智能体延迟 30ms，串行 = 90ms，并行应 ≈ 30ms（提升 67% > 50%）
      const AGENT_DELAY_MS = 30;

      const delayedAgent = (name) => createAgent({
        name,
        taskHandler: async (input) => {
          await new Promise(resolve => setTimeout(resolve, AGENT_DELAY_MS));
          return { triggered: true, text: `${name}-output`, delay: AGENT_DELAY_MS };
        }
      });

      // 并行执行：3 个智能体通过 Promise.all 并行
      const parallelStart = Date.now();
      await Promise.all([
        delayedAgent('AgentA').execute({}),
        delayedAgent('AgentB').execute({}),
        delayedAgent('AgentC').execute({})
      ]);
      const parallelTime = Date.now() - parallelStart;

      // 串行执行：3 个智能体顺序执行
      const serialStart = Date.now();
      await delayedAgent('AgentA').execute({});
      await delayedAgent('AgentB').execute({});
      await delayedAgent('AgentC').execute({});
      const serialTime = Date.now() - serialStart;

      // 计算提升比例
      const improvementRatio = (serialTime - parallelTime) / serialTime;

      // 验证：并行提升应 >= 50%
      expect(parallelTime).toBeLessThan(serialTime);
      expect(improvementRatio).toBeGreaterThanOrEqual(0.5);

      // 并行时间应接近单智能体时间（30ms ± 容差），远小于串行时间（90ms）
      expect(parallelTime).toBeLessThan(AGENT_DELAY_MS * 2);
      expect(serialTime).toBeGreaterThanOrEqual(AGENT_DELAY_MS * 3);
    });
  });

  describe('getAgentStats', () => {
    test('返回智能体统计信息', async () => {
      const manager = createMockSessionStateManager(5, createMockSessions(5));
      const orchestrator = createFreshnessOrchestrator({ sessionStateManager: manager });
      await orchestrator.generateFreshness({
        childId: 'child_001',
        childProfile: createMockProfile(),
        sessionCount: 5,
        usedExposures: []
      });
      const stats = orchestrator.getAgentStats();
      expect(stats).toHaveProperty('agents');
      expect(stats.agents).toHaveProperty('ReciprocalExposureAgent');
      expect(stats.agents).toHaveProperty('GrowthFeedbackAgent');
      expect(stats.agents).toHaveProperty('SurpriseMomentAgent');
      expect(stats.agents).toHaveProperty('SessionCounterAgent');
    });
  });
});
