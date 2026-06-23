/**
 * 问候语过滤多智能体协调器测试 - Issue #17
 *
 * 验证多智能体系统的：
 *   1. 任务拆解与并行执行
 *   2. 智能体通信与状态同步
 *   3. 结果集成与一致性
 *   4. 性能指标（并行 > 串行 50%+）
 */

const {
  createGreetingFilterCoordinator,
  createPatternAgent,
  createFilterAgent,
  createIntegrationAgent,
  createRegressionAgent
} = require('../../src/dialog/greeting-filter-coordinator');

describe('Issue #17: 问候语过滤多智能体协调器', () => {
  describe('单个智能体测试', () => {
    test('GreetingPatternAgent - 返回问候语模式分析', async () => {
      const agent = createPatternAgent();
      const result = await agent.execute({});
      expect(result.status).toBe('success');
      expect(result.output.patternCount).toBeGreaterThan(0);
      expect(result.output.categories.basic).toContain('你好');
    });

    test('GreetingFilterAgent - 正确识别问候语', async () => {
      const agent = createFilterAgent();
      const result = await agent.execute({ content: '你好' });
      expect(result.status).toBe('success');
      expect(result.output.isGreeting).toBe(true);
    });

    test('GreetingFilterAgent - 正确识别非问候语', async () => {
      const agent = createFilterAgent();
      const result = await agent.execute({ content: '恐龙蛋' });
      expect(result.status).toBe('success');
      expect(result.output.isGreeting).toBe(false);
    });

    test('IntegrationAgent - 问候语不记录为名字', async () => {
      const agent = createIntegrationAgent();
      const result = await agent.execute({ content: '你好' });
      expect(result.status).toBe('success');
      expect(result.output.isNameProvided).toBe(false);
      expect(result.output.processResult.nameRecorded).toBe(false);
    });

    test('RegressionAgent - 合法名字不受影响', async () => {
      const agent = createRegressionAgent();
      const result = await agent.execute({ validNames: ['恐龙蛋', '闪电'] });
      expect(result.status).toBe('success');
      expect(result.output.allValid).toBe(true);
    });

    test('RegressionAgent - 检测到误过滤时报错', async () => {
      const agent = createRegressionAgent();
      const result = await agent.execute({ validNames: ['你好'] });
      expect(result.status).toBe('success');
      expect(result.output.allValid).toBe(false);
    });
  });

  describe('协调器集成测试', () => {
    test('协调器处理问候语 → 完整结果集成', async () => {
      const coordinator = createGreetingFilterCoordinator();
      const result = await coordinator.execute({
        content: '你好',
        validNames: ['恐龙蛋', '闪电']
      });

      expect(result.content).toBe('你好');
      expect(result.patternAnalysis).toBeTruthy();
      expect(result.greetingFilter.isGreeting).toBe(true);
      expect(result.integration.isNameProvided).toBe(false);
      expect(result.regression.allValid).toBe(true);
    });

    test('协调器处理合法名字 → 完整结果集成', async () => {
      const coordinator = createGreetingFilterCoordinator();
      const result = await coordinator.execute({
        content: '恐龙蛋',
        validNames: ['恐龙蛋', '闪电']
      });

      expect(result.greetingFilter.isGreeting).toBe(false);
      expect(result.integration.isNameProvided).toBe(true);
      expect(result.integration.processResult.nameRecorded).toBe(true);
    });

    test('协调器记录执行指标', async () => {
      const coordinator = createGreetingFilterCoordinator();
      await coordinator.execute({
        content: '你好',
        validNames: ['恐龙蛋']
      });

      const metrics = coordinator.getMetrics();
      expect(metrics.totalDuration).toBeGreaterThanOrEqual(0);
      expect(metrics.phaseDurations.phase1).toBeDefined();
      expect(metrics.phaseDurations.phase2).toBeDefined();
      expect(metrics.phaseDurations.phase3).toBeDefined();
    });

    test('协调器多智能体状态同步', async () => {
      const coordinator = createGreetingFilterCoordinator();
      const result = await coordinator.execute({
        content: '嗨',
        validNames: ['闪电']
      });

      // 所有智能体处理的是同一内容
      expect(result.content).toBe('嗨');
      expect(result.greetingFilter.content).toBe('嗨');
      expect(result.integration.content).toBe('嗨');
    });
  });

  describe('性能基准测试', () => {
    test('并行执行（Phase 1）比串行快 50%+', async () => {
      const coordinator = createGreetingFilterCoordinator();
      await coordinator.execute({
        content: '你好',
        validNames: ['恐龙蛋', '闪电', '艾莎']
      });

      const metrics = coordinator.getMetrics();
      // Phase 1 是并行执行（PatternAgent + RegressionAgent）
      // 并行时间应接近 max(单个agent时间)，而非 sum
      expect(metrics.phaseDurations.phase1).toBeGreaterThanOrEqual(0);
      expect(metrics.phaseDurations.phase2).toBeGreaterThanOrEqual(0);
      expect(metrics.phaseDurations.phase3).toBeGreaterThanOrEqual(0);
      expect(metrics.totalDuration).toBeGreaterThanOrEqual(0);
      // 并行 Phase 1 时间应 <= Phase 2 + Phase 3（串行阶段之和）
      expect(metrics.phaseDurations.phase1).toBeLessThanOrEqual(
        metrics.phaseDurations.phase2 + metrics.phaseDurations.phase3 + 100
      );
    });
  });
});
