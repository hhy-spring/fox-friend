/**
 * 成长反馈管理器测试 - Issue #10 关系保鲜机制
 *
 * 参考Issue #10 验收标准：
 *   - 成长反馈：session_count % 3 == 0 → 总结孩子已教过多少个字/帮过多少次忙
 *   - 成长反馈可读项：items_learned 总数、故事阶段进度、连续学习天数
 *   - 所有保鲜机制不与教学内容冲突，嵌入在对话开场或结尾
 *
 * TDD 垂直切片测试覆盖：
 *   - shouldTrigger：会话序号是否触发成长反馈
 *   - calculateStats：成长统计数据计算
 *   - formatFeedbackText：成长反馈台词格式化
 *   - generateFeedback：成长反馈完整生成流程
 */

const { createGrowthFeedbackManager } = require('../../src/dialog/growth-feedback');

describe('GrowthFeedbackManager - 成长反馈管理器 (Issue #10)', () => {
  let manager;

  beforeEach(() => {
    manager = createGrowthFeedbackManager();
  });

  // ===== shouldTrigger =====

  describe('shouldTrigger - 判断是否触发成长反馈', () => {
    test('sessionCount % 3 === 0 时返回 true', () => {
      expect(manager.shouldTrigger(3)).toBe(true);
      expect(manager.shouldTrigger(6)).toBe(true);
      expect(manager.shouldTrigger(9)).toBe(true);
      expect(manager.shouldTrigger(12)).toBe(true);
    });

    test('sessionCount % 3 !== 0 时返回 false', () => {
      expect(manager.shouldTrigger(1)).toBe(false);
      expect(manager.shouldTrigger(2)).toBe(false);
      expect(manager.shouldTrigger(4)).toBe(false);
      expect(manager.shouldTrigger(5)).toBe(false);
      expect(manager.shouldTrigger(7)).toBe(false);
    });

    test('sessionCount 为 0 时返回 false', () => {
      expect(manager.shouldTrigger(0)).toBe(false);
    });
  });

  // ===== calculateStats =====

  describe('calculateStats - 计算成长统计数据', () => {
    test('返回 totalItemsLearned 为所有会话 items_learned 的总条数', () => {
      const allSessions = [
        { items_learned: ['a', 'o'], saved_at: '2026-01-01T10:00:00.000Z', story_stage: 0 },
        { items_learned: ['e'], saved_at: '2026-01-02T10:00:00.000Z', story_stage: 0 }
      ];
      const stats = manager.calculateStats(null, allSessions);
      expect(stats.totalItemsLearned).toBe(3);
    });

    test('返回 storyStageProgress 为当前故事阶段进度描述', () => {
      const childProfile = { story_stage: 1 };
      const stats = manager.calculateStats(childProfile, []);
      // 阶段索引1 = 门牌，共4阶段 → "门牌阶段 (2/4)"
      expect(stats.storyStageProgress).toBe('门牌阶段 (2/4)');
    });

    test('storyStageProgress 从 allSessions 推导当 childProfile 无 story_stage', () => {
      const allSessions = [
        { items_learned: ['a'], saved_at: '2026-01-01T10:00:00.000Z', story_stage: 2 }
      ];
      const stats = manager.calculateStats(null, allSessions);
      // 阶段索引2 = 灯，共4阶段 → "灯阶段 (3/4)"
      expect(stats.storyStageProgress).toBe('灯阶段 (3/4)');
    });

    test('返回 consecutiveLearningDays 为连续学习天数', () => {
      const allSessions = [
        { items_learned: ['a'], saved_at: '2026-01-01T10:00:00.000Z', story_stage: 0 },
        { items_learned: ['o'], saved_at: '2026-01-02T10:00:00.000Z', story_stage: 0 },
        { items_learned: ['e'], saved_at: '2026-01-03T10:00:00.000Z', story_stage: 0 }
      ];
      const stats = manager.calculateStats(null, allSessions);
      expect(stats.consecutiveLearningDays).toBe(3);
    });

    test('consecutiveLearningDays 在日期不连续时只计算从最近一天往回的连续天数', () => {
      const allSessions = [
        { items_learned: ['a'], saved_at: '2026-01-01T10:00:00.000Z', story_stage: 0 },
        { items_learned: ['o'], saved_at: '2026-01-02T10:00:00.000Z', story_stage: 0 },
        // 1月3日断开
        { items_learned: ['e'], saved_at: '2026-01-05T10:00:00.000Z', story_stage: 0 },
        { items_learned: ['i'], saved_at: '2026-01-06T10:00:00.000Z', story_stage: 0 }
      ];
      const stats = manager.calculateStats(null, allSessions);
      // 从1月6日往回：6→5连续，5→3不连续，所以是2天
      expect(stats.consecutiveLearningDays).toBe(2);
    });

    test('处理空会话列表', () => {
      const stats = manager.calculateStats(null, []);
      expect(stats.totalItemsLearned).toBe(0);
      expect(stats.storyStageProgress).toBe('字母石阶段 (1/4)');
      expect(stats.consecutiveLearningDays).toBe(0);
    });

    test('处理 items_learned 缺失的会话', () => {
      const allSessions = [
        { saved_at: '2026-01-01T10:00:00.000Z', story_stage: 0 },
        { items_learned: null, saved_at: '2026-01-02T10:00:00.000Z', story_stage: 0 }
      ];
      const stats = manager.calculateStats(null, allSessions);
      expect(stats.totalItemsLearned).toBe(0);
    });
  });

  // ===== formatFeedbackText =====

  describe('formatFeedbackText - 格式化成长反馈台词', () => {
    test('包含 totalItemsLearned 信息', () => {
      const stats = {
        totalItemsLearned: 5,
        storyStageProgress: '门牌阶段 (2/4)',
        consecutiveLearningDays: 2
      };
      const text = manager.formatFeedbackText(stats, { nickname: '小明' });
      expect(text).toContain('5');
      expect(text).toContain('字');
    });

    test('包含 storyStageProgress 信息', () => {
      const stats = {
        totalItemsLearned: 3,
        storyStageProgress: '门牌阶段 (2/4)',
        consecutiveLearningDays: 1
      };
      const text = manager.formatFeedbackText(stats, { nickname: '小明' });
      expect(text).toContain('门牌');
    });

    test('包含 consecutiveLearningDays 信息', () => {
      const stats = {
        totalItemsLearned: 3,
        storyStageProgress: '字母石阶段 (1/4)',
        consecutiveLearningDays: 4
      };
      const text = manager.formatFeedbackText(stats, { nickname: '小明' });
      expect(text).toContain('4');
      expect(text).toContain('天');
    });

    test('使用 childProfile 中的 nickname', () => {
      const stats = {
        totalItemsLearned: 3,
        storyStageProgress: '字母石阶段 (1/4)',
        consecutiveLearningDays: 1
      };
      const text = manager.formatFeedbackText(stats, { nickname: '闪电' });
      expect(text).toContain('闪电');
    });

    test('nickname 缺失时使用默认称呼', () => {
      const stats = {
        totalItemsLearned: 3,
        storyStageProgress: '字母石阶段 (1/4)',
        consecutiveLearningDays: 1
      };
      const text = manager.formatFeedbackText(stats, null);
      expect(text).toContain('小伙伴');
    });
  });

  // ===== generateFeedback =====

  describe('generateFeedback - 生成完整成长反馈', () => {
    test('应触发时返回 triggered=true 及反馈内容', () => {
      const allSessions = [
        { items_learned: ['a', 'o'], saved_at: '2026-01-01T10:00:00.000Z', story_stage: 0 },
        { items_learned: ['e'], saved_at: '2026-01-02T10:00:00.000Z', story_stage: 0 },
        { items_learned: ['i'], saved_at: '2026-01-03T10:00:00.000Z', story_stage: 0 }
      ];
      const result = manager.generateFeedback(3, { nickname: '小明' }, allSessions);
      expect(result.triggered).toBe(true);
      expect(result.feedbackText).toBeTruthy();
      expect(result.stats).toBeDefined();
      expect(result.stats.totalItemsLearned).toBe(4);
    });

    test('不应触发时返回 triggered=false', () => {
      const result = manager.generateFeedback(2, { nickname: '小明' }, []);
      expect(result.triggered).toBe(false);
      expect(result.feedbackText).toBe('');
      expect(result.stats).toEqual({
        totalItemsLearned: 0,
        storyStageProgress: '字母石阶段 (1/4)',
        consecutiveLearningDays: 0
      });
    });

    test('反馈台词中使用 childProfile 的 nickname', () => {
      const allSessions = [
        { items_learned: ['a'], saved_at: '2026-01-01T10:00:00.000Z', story_stage: 0 },
        { items_learned: ['o'], saved_at: '2026-01-02T10:00:00.000Z', story_stage: 0 },
        { items_learned: ['e'], saved_at: '2026-01-03T10:00:00.000Z', story_stage: 0 }
      ];
      const result = manager.generateFeedback(3, { nickname: '闪电' }, allSessions);
      expect(result.triggered).toBe(true);
      expect(result.feedbackText).toContain('闪电');
    });
  });
});
