/**
 * 教学密度调整器测试 - Issue #8 每日拼音教学
 *
 * 参考PRD §4.5.3 变化二/三 + Issue #8：
 *   根据孩子实时状态动态调整教学密度和句式。
 *   4种孩子状态对应4种策略：
 *     energetic → 教学密度增加，可多喂 1-2 个知识点
 *     low       → 先关心，再问是否换轻松的事，降低教学密度
 *     neutral   → 正常推进教学内容
 *     rebellious→ 连续3次不愿推进→触发借分对赌（转 Issue #9）
 */
const {
  DENSITY_LEVELS,
  createTeachingDensityAdjuster
} = require('../../src/dialog/teaching-density-adjuster');

describe('TeachingDensityAdjuster - 教学密度调整器', () => {
  describe('DENSITY_LEVELS 常量', () => {
    test('应定义3个密度级别常量 LOW/NORMAL/HIGH', () => {
      expect(DENSITY_LEVELS).toHaveProperty('LOW');
      expect(DENSITY_LEVELS).toHaveProperty('NORMAL');
      expect(DENSITY_LEVELS).toHaveProperty('HIGH');
      expect(Object.keys(DENSITY_LEVELS)).toHaveLength(3);
    });
  });

  describe('getStrategy - energetic 状态（精力旺盛）', () => {
    test('应返回 high 密度、3 个知识点、careFirst false', () => {
      const adjuster = createTeachingDensityAdjuster();
      const strategy = adjuster.getStrategy('energetic');
      expect(strategy.density).toBe('high');
      expect(strategy.knowledgePointCount).toBe(3);
      expect(strategy.careFirst).toBe(false);
    });
  });

  describe('getStrategy - low 状态（情绪低落/累了）', () => {
    test('应返回 low 密度、1 个知识点、careFirst true、askToSwitch true', () => {
      const adjuster = createTeachingDensityAdjuster();
      const strategy = adjuster.getStrategy('low');
      expect(strategy.density).toBe('low');
      expect(strategy.knowledgePointCount).toBe(1);
      expect(strategy.careFirst).toBe(true);
      expect(strategy.askToSwitch).toBe(true);
    });
  });

  describe('getStrategy - neutral 状态（正常）', () => {
    test('应返回 normal 密度、2 个知识点、careFirst false', () => {
      const adjuster = createTeachingDensityAdjuster();
      const strategy = adjuster.getStrategy('neutral');
      expect(strategy.density).toBe('normal');
      expect(strategy.knowledgePointCount).toBe(2);
      expect(strategy.careFirst).toBe(false);
    });
  });

  describe('getStrategy - rebellious 状态（叛逆/无聊）', () => {
    test('无 refusalCount 上下文时应返回 low 密度、shouldTriggerBorrow false', () => {
      const adjuster = createTeachingDensityAdjuster();
      const strategy = adjuster.getStrategy('rebellious');
      expect(strategy.density).toBe('low');
      expect(strategy.shouldTriggerBorrow).toBe(false);
    });

    test('refusalCount >= 3 时应触发借分对赌 shouldTriggerBorrow true', () => {
      const adjuster = createTeachingDensityAdjuster();
      const strategy = adjuster.getStrategy('rebellious', { refusalCount: 3 });
      expect(strategy.shouldTriggerBorrow).toBe(true);
    });
  });

  describe('getDensityLevel - 获取密度级别', () => {
    test('energetic 状态应返回 high 密度', () => {
      const adjuster = createTeachingDensityAdjuster();
      expect(adjuster.getDensityLevel('energetic')).toBe('high');
    });

    test('low 状态应返回 low 密度', () => {
      const adjuster = createTeachingDensityAdjuster();
      expect(adjuster.getDensityLevel('low')).toBe('low');
    });
  });

  describe('getKnowledgePointCount - 获取知识点数量', () => {
    test('energetic 状态应返回 3 个知识点', () => {
      const adjuster = createTeachingDensityAdjuster();
      expect(adjuster.getKnowledgePointCount('energetic')).toBe(3);
    });

    test('low 状态应返回 1 个知识点', () => {
      const adjuster = createTeachingDensityAdjuster();
      expect(adjuster.getKnowledgePointCount('low')).toBe(1);
    });
  });

  describe('getCareDialog - 获取关心话术', () => {
    test('low 状态应返回非空关心话术', () => {
      const adjuster = createTeachingDensityAdjuster();
      const dialog = adjuster.getCareDialog('low');
      expect(typeof dialog).toBe('string');
      expect(dialog.length).toBeGreaterThan(0);
    });

    test('energetic 状态应返回空字符串', () => {
      const adjuster = createTeachingDensityAdjuster();
      const dialog = adjuster.getCareDialog('energetic');
      expect(dialog).toBe('');
    });
  });

  describe('getStrategy - 未知状态默认策略', () => {
    test('未知状态应默认返回 neutral 策略', () => {
      const adjuster = createTeachingDensityAdjuster();
      const strategy = adjuster.getStrategy('unknown_state');
      expect(strategy.density).toBe('normal');
      expect(strategy.knowledgePointCount).toBe(2);
      expect(strategy.careFirst).toBe(false);
    });
  });

  describe('knowledgePointCount 下界保护', () => {
    test('所有状态的 knowledgePointCount 均不小于 1', () => {
      const adjuster = createTeachingDensityAdjuster();
      const states = ['energetic', 'low', 'neutral', 'rebellious'];
      states.forEach(state => {
        const count = adjuster.getKnowledgePointCount(state);
        expect(count).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
