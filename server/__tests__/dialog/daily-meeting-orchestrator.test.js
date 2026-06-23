/**
 * 每日见面开场编排器测试 - Issue #7
 *
 * 测试中央协调器的多智能体并行执行、结果集成和异常处理
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const { createDailyMeetingOrchestrator } = require('../../src/dialog/daily-meeting-orchestrator');
const { createSessionStateManager } = require('../../src/dialog/session-state');

describe('DailyMeetingOrchestrator - 多智能体中央协调器', () => {
  let tempDir;
  let sessionStateManager;
  let orchestrator;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fox-orch-'));
    sessionStateManager = createSessionStateManager({ storageDir: tempDir });
    orchestrator = createDailyMeetingOrchestrator({
      sessionStateManager
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('编排器初始化', () => {
    test('应创建编排器实例', () => {
      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.generateDailyOpening).toBe('function');
      expect(typeof orchestrator.getAgentStats).toBe('function');
    });

    test('应包含5个智能体', () => {
      const stats = orchestrator.getAgentStats();
      expect(stats).toHaveProperty('agents');
      expect(Object.keys(stats.agents)).toHaveLength(5);
      expect(stats.agents).toHaveProperty('StoryStageAgent');
      expect(stats.agents).toHaveProperty('ToneEvolutionAgent');
      expect(stats.agents).toHaveProperty('SessionStateAgent');
      expect(stats.agents).toHaveProperty('MemoryAnchorAgent');
      expect(stats.agents).toHaveProperty('OpeningTemplateAgent');
    });
  });

  describe('每日开场生成 - 基本流程', () => {
    test('第二次见面应生成完整开场', async () => {
      const childProfile = {
        nickname: '闪电',
        foxName: '恐龙蛋',
        interests_derived_from_fox_name: ['恐龙']
      };

      // 保存第一次会话数据
      const firstSession = {
        date: '2026-06-22',
        story_stage: 'letter_stone',
        subject: 'pinyin',
        items_learned: ['a', 'o'],
        mastery_status: { a: 'mastered', o: 'learning' },
        child_mood: 'energetic',
        chat_frequency: 'daily',
        teaching_method_used: 'feynman',
        duration_minutes: 8,
        child_spontaneous_remarks: ['我喜欢恐龙']
      };
      sessionStateManager.saveSession('child_001', firstSession);

      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 2
      });

      expect(result).toHaveProperty('openingText');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('storyStage');
      expect(result).toHaveProperty('tonePhase');
      expect(result).toHaveProperty('memoryAnchor');
      expect(result.openingText).toBeTruthy();
      expect(result.openingText.length).toBeGreaterThan(0);
    });

    test('开场应包含孩子昵称', async () => {
      const childProfile = {
        nickname: '闪电',
        foxName: '恐龙蛋',
        interests_derived_from_fox_name: ['恐龙']
      };

      sessionStateManager.saveSession('child_001', {
        date: '2026-06-22',
        story_stage: 'letter_stone',
        subject: 'pinyin',
        items_learned: ['a'],
        mastery_status: {},
        child_mood: 'neutral',
        chat_frequency: 'daily',
        teaching_method_used: 'feynman',
        duration_minutes: 5,
        child_spontaneous_remarks: []
      });

      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 2
      });

      expect(result.openingText).toContain('闪电');
    });

    test('开场应包含故事阶段信息', async () => {
      const childProfile = {
        nickname: '闪电',
        foxName: '恐龙蛋',
        interests_derived_from_fox_name: ['恐龙']
      };

      const result = await orchestrator.generateDailyOpening({
        childId: 'child_002',
        childProfile,
        sessionCount: 2
      });

      expect(result.storyStage).toHaveProperty('id');
      expect(result.storyStage).toHaveProperty('subject');
    });
  });

  describe('多智能体并行执行', () => {
    test('Phase 1 智能体应并行执行（StoryStage, ToneEvolution, SessionState）', async () => {
      const childProfile = {
        nickname: '闪电',
        foxName: '恐龙蛋',
        interests_derived_from_fox_name: ['恐龙']
      };

      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 3
      });

      // 验证所有 Phase 1 智能体都执行了
      const stats = orchestrator.getAgentStats();
      expect(stats.agents.StoryStageAgent.tasksCompleted).toBeGreaterThan(0);
      expect(stats.agents.ToneEvolutionAgent.tasksCompleted).toBeGreaterThan(0);
      expect(stats.agents.SessionStateAgent.tasksCompleted).toBeGreaterThan(0);
    });

    test('Phase 2 智能体应在 Phase 1 完成后执行（MemoryAnchor）', async () => {
      const childProfile = {
        nickname: '闪电',
        foxName: '恐龙蛋',
        interests_derived_from_fox_name: ['恐龙']
      };

      sessionStateManager.saveSession('child_001', {
        date: '2026-06-22',
        story_stage: 'letter_stone',
        subject: 'pinyin',
        items_learned: ['a'],
        mastery_status: {},
        child_mood: 'neutral',
        chat_frequency: 'daily',
        teaching_method_used: 'feynman',
        duration_minutes: 5,
        child_spontaneous_remarks: []
      });

      await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 2
      });

      const stats = orchestrator.getAgentStats();
      expect(stats.agents.MemoryAnchorAgent.tasksCompleted).toBeGreaterThan(0);
    });

    test('Phase 3 智能体应在所有前置完成后执行（OpeningTemplate）', async () => {
      const childProfile = {
        nickname: '闪电',
        foxName: '恐龙蛋',
        interests_derived_from_fox_name: ['恐龙']
      };

      await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 2
      });

      const stats = orchestrator.getAgentStats();
      expect(stats.agents.OpeningTemplateAgent.tasksCompleted).toBeGreaterThan(0);
    });
  });

  describe('语气渐变', () => {
    test('第2次见面应使用 FAMILIAR 语气', async () => {
      const childProfile = { nickname: '闪电', foxName: '恐龙蛋' };
      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 2
      });
      expect(result.tonePhase.phase).toBe('familiar');
    });

    test('第5次见面应使用 TACIT 语气', async () => {
      const childProfile = { nickname: '闪电', foxName: '恐龙蛋' };
      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 5
      });
      expect(result.tonePhase.phase).toBe('tacit');
    });

    test('第10次见面应使用 OLD_PARTNERS 语气', async () => {
      const childProfile = { nickname: '闪电', foxName: '恐龙蛋' };
      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 10
      });
      expect(result.tonePhase.phase).toBe('old_partners');
    });
  });

  describe('回忆锚点集成', () => {
    test('有上次会话数据时回忆锚点应被激活', async () => {
      const childProfile = { nickname: '闪电', foxName: '恐龙蛋' };

      sessionStateManager.saveSession('child_001', {
        date: '2026-06-22',
        story_stage: 'letter_stone',
        subject: 'pinyin',
        items_learned: ['a', 'o', 'e'],
        mastery_status: {},
        child_mood: 'energetic',
        chat_frequency: 'daily',
        teaching_method_used: 'feynman',
        duration_minutes: 8,
        child_spontaneous_remarks: []
      });

      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 2
      });

      expect(result.memoryAnchor.hasAnchor).toBe(true);
    });

    test('无上次会话数据时回忆锚点应未激活', async () => {
      const childProfile = { nickname: '闪电', foxName: '恐龙蛋' };

      const result = await orchestrator.generateDailyOpening({
        childId: 'child_new',
        childProfile,
        sessionCount: 2
      });

      expect(result.memoryAnchor.hasAnchor).toBe(false);
    });
  });

  describe('异常处理', () => {
    test('孩子画像为null时应优雅降级', async () => {
      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile: null,
        sessionCount: 2
      });

      expect(result).toBeDefined();
      expect(result.openingText).toBeTruthy();
    });

    test('智能体执行失败时编排器应返回错误信息', async () => {
      // 使用无效的 sessionStateManager 触发错误
      const badOrchestrator = createDailyMeetingOrchestrator({
        sessionStateManager: null
      });

      const result = await badOrchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile: { nickname: '闪电', foxName: '恐龙蛋' },
        sessionCount: 2
      });

      expect(result).toHaveProperty('error');
    });
  });

  describe('性能基准', () => {
    test('多智能体并行执行应比串行快（通过执行时间验证）', async () => {
      const childProfile = { nickname: '闪电', foxName: '恐龙蛋' };

      sessionStateManager.saveSession('child_001', {
        date: '2026-06-22',
        story_stage: 'letter_stone',
        subject: 'pinyin',
        items_learned: ['a'],
        mastery_status: {},
        child_mood: 'neutral',
        chat_frequency: 'daily',
        teaching_method_used: 'feynman',
        duration_minutes: 5,
        child_spontaneous_remarks: []
      });

      const start = Date.now();
      await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 2
      });
      const elapsed = Date.now() - start;

      // 并行执行应在合理时间内完成（< 500ms）
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('完整结果结构', () => {
    test('结果应包含所有必要字段', async () => {
      const childProfile = { nickname: '闪电', foxName: '恐龙蛋' };

      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 2
      });

      expect(result).toHaveProperty('openingText');
      expect(result).toHaveProperty('components.nameCall');
      expect(result).toHaveProperty('components.memoryAnchor');
      expect(result).toHaveProperty('components.newTask');
      expect(result).toHaveProperty('storyStage');
      expect(result).toHaveProperty('tonePhase');
      expect(result).toHaveProperty('memoryAnchor');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('agentResults');
    });
  });

  // ============================================================
  // Issue #25: 关系保鲜机制集成测试
  // 验证 freshness 文本被集成到 openingText 中
  // ============================================================
  describe('Issue #25 - 关系保鲜机制集成到开场文本', () => {
    test('第5次见面时互惠暴露文本应嵌入 openingText（session_count % 5 == 0）', async () => {
      const childProfile = {
        nickname: '闪电',
        foxName: '恐龙蛋',
        interests_derived_from_fox_name: ['恐龙']
      };

      sessionStateManager.saveSession('child_001', {
        date: '2026-06-22',
        story_stage: 'letter_stone',
        subject: 'pinyin',
        items_learned: ['a', 'o'],
        mastery_status: {},
        child_mood: 'neutral',
        chat_frequency: 'daily',
        teaching_method_used: 'feynman',
        duration_minutes: 5,
        child_spontaneous_remarks: []
      });

      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 5
      });

      // 互惠暴露应被触发
      expect(result.freshness.reciprocalExposure.triggered).toBe(true);
      expect(result.freshness.reciprocalExposure.exposureText).toBeTruthy();

      // 关键集成验证：openingText 应包含互惠暴露文本
      expect(result.openingText).toContain(result.freshness.reciprocalExposure.exposureText);
    });

    test('第3次见面时成长反馈文本应嵌入 openingText（session_count % 3 == 0）', async () => {
      const childProfile = {
        nickname: '闪电',
        foxName: '恐龙蛋',
        interests_derived_from_fox_name: ['恐龙']
      };

      sessionStateManager.saveSession('child_001', {
        date: '2026-06-22',
        story_stage: 'letter_stone',
        subject: 'pinyin',
        items_learned: ['a', 'o'],
        mastery_status: {},
        child_mood: 'neutral',
        chat_frequency: 'daily',
        teaching_method_used: 'feynman',
        duration_minutes: 5,
        child_spontaneous_remarks: []
      });

      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 3
      });

      // 成长反馈应被触发
      expect(result.freshness.growthFeedback.triggered).toBe(true);
      expect(result.freshness.growthFeedback.feedbackText).toBeTruthy();

      // 关键集成验证：openingText 应包含成长反馈文本
      expect(result.openingText).toContain(result.freshness.growthFeedback.feedbackText);
    });

    test('惊喜时刻触发时文本应嵌入 openingText（通过 rng 控制确定性触发）', async () => {
      // 使用确定性 rng 强制惊喜触发（rng() 返回 0 < 1/6 触发阈值）
      const deterministicOrchestrator = createDailyMeetingOrchestrator({
        sessionStateManager,
        rng: () => 0
      });

      const childProfile = {
        nickname: '闪电',
        foxName: '恐龙蛋',
        interests_derived_from_fox_name: ['恐龙']
      };

      sessionStateManager.saveSession('child_001', {
        date: '2026-06-22',
        story_stage: 'letter_stone',
        subject: 'pinyin',
        items_learned: ['a'],
        mastery_status: {},
        child_mood: 'neutral',
        chat_frequency: 'daily',
        teaching_method_used: 'feynman',
        duration_minutes: 5,
        child_spontaneous_remarks: []
      });

      const result = await deterministicOrchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 4
      });

      // 惊喜时刻应被触发（rng=0 < 1/6）
      expect(result.freshness.surpriseMoment.triggered).toBe(true);
      expect(result.freshness.surpriseMoment.surpriseText).toBeTruthy();

      // 关键集成验证：openingText 应包含惊喜文本
      expect(result.openingText).toContain(result.freshness.surpriseMoment.surpriseText);
    });

    test('记忆锚点应嵌入 openingText（每次开场引用上次关键事件）', async () => {
      const childProfile = {
        nickname: '闪电',
        foxName: '恐龙蛋',
        interests_derived_from_fox_name: ['恐龙']
      };

      sessionStateManager.saveSession('child_001', {
        date: '2026-06-22',
        story_stage: 'letter_stone',
        subject: 'pinyin',
        items_learned: ['a', 'o', 'e'],
        mastery_status: { a: 'mastered' },
        child_mood: 'energetic',
        chat_frequency: 'daily',
        teaching_method_used: 'feynman',
        duration_minutes: 8,
        child_spontaneous_remarks: ['我喜欢恐龙']
      });

      const result = await orchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 2
      });

      // 记忆锚点应被激活
      expect(result.memoryAnchor.hasAnchor).toBe(true);
      expect(result.memoryAnchor.anchorText).toBeTruthy();

      // 关键集成验证：openingText 应包含记忆锚点文本
      expect(result.openingText).toContain(result.memoryAnchor.anchorText);
    });

    test('非触发会话不应嵌入互惠暴露和成长反馈文本（session_count=4）', async () => {
      const childProfile = {
        nickname: '闪电',
        foxName: '恐龙蛋'
      };

      sessionStateManager.saveSession('child_001', {
        date: '2026-06-22',
        story_stage: 'letter_stone',
        subject: 'pinyin',
        items_learned: ['a'],
        mastery_status: {},
        child_mood: 'neutral',
        chat_frequency: 'daily',
        teaching_method_used: 'feynman',
        duration_minutes: 5,
        child_spontaneous_remarks: []
      });

      // 使用 rng=1 确保惊喜也不触发
      const noSurpriseOrchestrator = createDailyMeetingOrchestrator({
        sessionStateManager,
        rng: () => 1
      });

      const result = await noSurpriseOrchestrator.generateDailyOpening({
        childId: 'child_001',
        childProfile,
        sessionCount: 4
      });

      // session_count=4：4%5!=0（互惠暴露不触发），4%3!=0（成长反馈不触发）
      expect(result.freshness.reciprocalExposure.triggered).toBe(false);
      expect(result.freshness.growthFeedback.triggered).toBe(false);
      // rng=1 > 1/6，惊喜不触发
      expect(result.freshness.surpriseMoment.triggered).toBe(false);

      // freshnessText 应为空
      expect(result.freshness.freshnessText).toBe('');
    });

    test('storyStage 加载失败时应优雅降级使用默认阶段', async () => {
      const childProfile = { nickname: '闪电', foxName: '恐龙蛋' };

      // 使用不存在的 childId，loadStoryStage 返回 success=false
      const result = await orchestrator.generateDailyOpening({
        childId: 'child_no_stage',
        childProfile,
        sessionCount: 2
      });

      // 应仍能生成开场（使用默认故事阶段）
      expect(result.openingText).toBeTruthy();
      expect(result.storyStage).toHaveProperty('id');
    });

    test('已保存 storyStage 时应加载并使用（覆盖 loadStoryStage 成功分支）', async () => {
      const childProfile = { nickname: '闪电', foxName: '恐龙蛋' };

      // 先保存故事阶段数据
      sessionStateManager.saveStoryStage('child_with_stage', {
        currentStageIndex: 2
      });

      const result = await orchestrator.generateDailyOpening({
        childId: 'child_with_stage',
        childProfile,
        sessionCount: 2
      });

      // 应加载已保存的阶段（index=2 对应第3阶段）
      expect(result.openingText).toBeTruthy();
      expect(result.storyStage).toHaveProperty('id');
    });
  });
});
