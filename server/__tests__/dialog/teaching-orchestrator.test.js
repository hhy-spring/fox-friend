/**
 * 教学编排器测试 - Issue #8 每日拼音教学多智能体系统集成
 *
 * 参考PRD §4.2 血肉层 + §4.5.3 变化二/三/四
 * 参考技术架构§三「对话引擎架构」
 *
 * 多智能体系统架构：
 *   Phase 1（并行）：ChildStateAgent + PinyinContentAgent
 *   Phase 2（并行）：DensityAdjusterAgent + StyleMixerAgent
 *   Phase 3（串行）：VulnerabilityTriggerAgent
 *   Phase 4（串行）：SessionDataBuilderAgent
 */
const {
  createTeachingOrchestrator
} = require('../../src/dialog/teaching-orchestrator');
const { CHILD_STATES } = require('../../src/dialog/child-state-classifier');

describe('教学编排器 - Issue #8 多智能体集成', () => {
  describe('createTeachingOrchestrator - 初始化', () => {
    test('创建编排器实例', () => {
      const orchestrator = createTeachingOrchestrator();
      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.runTeachingRound).toBe('function');
      expect(typeof orchestrator.runFullLesson).toBe('function');
      expect(typeof orchestrator.getAgentStats).toBe('function');
    });

    test('getAgentStats 返回 6 个智能体信息', () => {
      const orchestrator = createTeachingOrchestrator();
      const stats = orchestrator.getAgentStats();
      expect(stats.agents).toBeDefined();
      const agentNames = Object.keys(stats.agents);
      expect(agentNames.length).toBeGreaterThanOrEqual(6);
      expect(agentNames).toContain('ChildStateAgent');
      expect(agentNames).toContain('PinyinContentAgent');
      expect(agentNames).toContain('DensityAdjusterAgent');
      expect(agentNames).toContain('StyleMixerAgent');
      expect(agentNames).toContain('VulnerabilityTriggerAgent');
      expect(agentNames).toContain('SessionDataBuilderAgent');
    });
  });

  describe('runTeachingRound - 单轮教学', () => {
    test('energetic 状态返回高密度教学结果', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runTeachingRound({
        childResponse: '我想学',
        currentVowel: 'a',
        round: 1
      });

      expect(result).toBeDefined();
      expect(result.childState).toBe(CHILD_STATES.ENERGETIC);
      expect(result.density).toBe('high');
      expect(result.dialogue).toBeDefined();
      expect(typeof result.dialogue).toBe('string');
      expect(result.dialogue.length).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    test('low 状态返回低密度并带关心台词', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runTeachingRound({
        childResponse: '我累了',
        currentVowel: 'a',
        round: 1
      });

      expect(result.childState).toBe(CHILD_STATES.LOW);
      expect(result.density).toBe('low');
      expect(result.careFirst).toBe(true);
    });

    test('neutral 状态正常推进', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runTeachingRound({
        childResponse: '好啊',
        currentVowel: 'o',
        round: 1
      });

      expect(result.childState).toBe(CHILD_STATES.NEUTRAL);
      expect(result.density).toBe('normal');
    });

    test('结果包含句式风格信息', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runTeachingRound({
        childResponse: '好啊',
        currentVowel: 'a',
        round: 1
      });

      expect(result.sentenceStyle).toBeDefined();
      expect(['request', 'intel', 'curious', 'challenge']).toContain(result.sentenceStyle);
    });

    test('结果包含脆弱度信息', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runTeachingRound({
        childResponse: '好啊',
        currentVowel: 'a',
        round: 1,
        masteryStatus: 'new'
      });

      expect(result.vulnerability).toBeDefined();
      expect(typeof result.vulnerability.shouldShow).toBe('boolean');
    });

    test('结果包含智能体执行结果', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runTeachingRound({
        childResponse: '好啊',
        currentVowel: 'a',
        round: 1
      });

      expect(result.agentResults).toBeDefined();
      expect(result.agentResults.childState).toBeDefined();
      expect(result.agentResults.pinyinContent).toBeDefined();
    });
  });

  describe('runFullLesson - 完整拼音课程（a/o/e）', () => {
    test('运行完整课程并输出 session_data', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runFullLesson({
        childId: 'test-child-001',
        childResponses: ['好啊', '我想学', '嗯'],
        storyStage: 'letter_stone'
      });

      expect(result).toBeDefined();
      expect(result.sessionData).toBeDefined();
      expect(result.sessionData.story_stage).toBe('letter_stone');
      expect(result.sessionData.subject).toBe('pinyin');
      expect(result.sessionData.items_learned).toBeDefined();
      expect(Array.isArray(result.sessionData.items_learned)).toBe(true);
      expect(result.sessionData.mastery_status).toBeDefined();
      expect(result.sessionData.child_mood).toBeDefined();
      expect(result.sessionData.chat_frequency).toBeGreaterThanOrEqual(0);
      expect(result.sessionData.teaching_method_used).toBeDefined();
      expect(result.sessionData.duration_minutes).toBeGreaterThanOrEqual(0);
      expect(result.sessionData.child_spontaneous_remarks).toBeDefined();
      expect(Array.isArray(result.sessionData.child_spontaneous_remarks)).toBe(true);
    });

    test('课程包含 a/o/e 三个元音', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runFullLesson({
        childId: 'test-child-002',
        childResponses: ['好啊', '我想学', '嗯'],
        storyStage: 'letter_stone'
      });

      expect(result.sessionData.items_learned).toEqual(
        expect.arrayContaining(['a', 'o', 'e'])
      );
    });

    test('课程结果包含轮次记录', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runFullLesson({
        childId: 'test-child-003',
        childResponses: ['好啊', '我想学', '嗯'],
        storyStage: 'letter_stone'
      });

      expect(result.rounds).toBeDefined();
      expect(Array.isArray(result.rounds)).toBe(true);
      expect(result.rounds.length).toBeGreaterThan(0);
    });

    test('课程结果包含总执行时间', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runFullLesson({
        childId: 'test-child-004',
        childResponses: ['好啊'],
        storyStage: 'letter_stone'
      });

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('多智能体并行执行性能', () => {
    test('Phase 1 并行执行（ChildState + PinyinContent 同时）', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runTeachingRound({
        childResponse: '好啊',
        currentVowel: 'a',
        round: 1
      });

      // 两个 Phase 1 智能体都应成功执行
      expect(result.agentResults.childState.status).toBe('success');
      expect(result.agentResults.pinyinContent.status).toBe('success');
    });

    test('rebellious 状态连续3次触发借分对赌标记', async () => {
      const orchestrator = createTeachingOrchestrator();
      // 连续3次 rebellious
      await orchestrator.runTeachingRound({
        childResponse: '不想学',
        currentVowel: 'a',
        round: 1
      });
      await orchestrator.runTeachingRound({
        childResponse: '无聊',
        currentVowel: 'a',
        round: 2
      });
      const result = await orchestrator.runTeachingRound({
        childResponse: '我不要学',
        currentVowel: 'a',
        round: 3
      });

      expect(result.shouldTriggerBorrow).toBe(true);
    });
  });

  describe('错误处理与优雅降级', () => {
    test('缺少 childResponse 时使用默认值', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runTeachingRound({
        currentVowel: 'a',
        round: 1
      });

      expect(result).toBeDefined();
      expect(result.childState).toBe(CHILD_STATES.NEUTRAL);
    });

    test('未知元音时优雅降级', async () => {
      const orchestrator = createTeachingOrchestrator();
      const result = await orchestrator.runTeachingRound({
        childResponse: '好啊',
        currentVowel: 'x',
        round: 1
      });

      expect(result).toBeDefined();
      expect(result.childState).toBe(CHILD_STATES.NEUTRAL);
    });
  });
});
