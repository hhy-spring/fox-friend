/**
 * 儿童状态分类器测试 - Issue #8 每日拼音教学
 *
 * 参考PRD §4.5.3 变化二/三 + 技术架构§七「三状态分类器」
 *
 * 4 种孩子状态：energetic / low / neutral / rebellious
 * 行为映射：
 *   energetic → 增加教学密度
 *   low（累了/畏难）→ 降低密度，先关心
 *   neutral → 正常推进
 *   rebellious → 递增不愿推进计数器，连续3次触发借分对赌（转 Issue #9）
 */
const {
  classifyChildState,
  CHILD_STATES,
  createChildStateTracker
} = require('../../src/dialog/child-state-classifier');

describe('儿童状态分类器 - Issue #8 每日拼音教学', () => {
  describe('classifyChildState - energetic 分类（精力旺盛）', () => {
    test('「我想学」→ energetic', () => {
      const result = classifyChildState('我想学');
      expect(result.state).toBe(CHILD_STATES.ENERGETIC);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('「好开心」→ energetic', () => {
      const result = classifyChildState('好开心');
      expect(result.state).toBe(CHILD_STATES.ENERGETIC);
    });

    test('「我来教你」→ energetic', () => {
      const result = classifyChildState('我来教你');
      expect(result.state).toBe(CHILD_STATES.ENERGETIC);
    });
  });

  describe('classifyChildState - low 分类（情绪低落/累了/畏难）', () => {
    test('「我累了」→ low', () => {
      const result = classifyChildState('我累了');
      expect(result.state).toBe(CHILD_STATES.LOW);
      expect(result.matchedKeyword).toBe('累了');
    });

    test('「我困了」→ low', () => {
      const result = classifyChildState('我困了');
      expect(result.state).toBe(CHILD_STATES.LOW);
    });

    test('「太难了」→ low（畏难不递增计数器）', () => {
      const result = classifyChildState('太难了');
      expect(result.state).toBe(CHILD_STATES.LOW);
      expect(result.matchedKeyword).toBe('太难');
    });

    test('「我不会」→ low', () => {
      const result = classifyChildState('我不会');
      expect(result.state).toBe(CHILD_STATES.LOW);
    });
  });

  describe('classifyChildState - rebellious 分类（叛逆/无聊）', () => {
    test('「我不想学」→ rebellious', () => {
      const result = classifyChildState('我不想学');
      expect(result.state).toBe(CHILD_STATES.REBELLIOUS);
      expect(result.matchedKeyword).toBe('不想学');
    });

    test('「无聊」→ rebellious', () => {
      const result = classifyChildState('无聊');
      expect(result.state).toBe(CHILD_STATES.REBELLIOUS);
    });

    test('「我不要学这个」→ rebellious', () => {
      const result = classifyChildState('我不要学这个');
      expect(result.state).toBe(CHILD_STATES.REBELLIOUS);
    });

    test('「我想做别的」→ rebellious', () => {
      const result = classifyChildState('我想做别的');
      expect(result.state).toBe(CHILD_STATES.REBELLIOUS);
    });
  });

  describe('classifyChildState - neutral 分类（正常）', () => {
    test('「好啊」→ neutral', () => {
      const result = classifyChildState('好啊');
      expect(result.state).toBe(CHILD_STATES.NEUTRAL);
    });

    test('「嗯」→ neutral', () => {
      const result = classifyChildState('嗯');
      expect(result.state).toBe(CHILD_STATES.NEUTRAL);
    });

    test('空字符串 → neutral', () => {
      const result = classifyChildState('');
      expect(result.state).toBe(CHILD_STATES.NEUTRAL);
    });
  });

  describe('createChildStateTracker - 连续不愿推进计数器', () => {
    test('初始计数为 0', () => {
      const tracker = createChildStateTracker();
      expect(tracker.getRefusalCount()).toBe(0);
      expect(tracker.shouldTriggerBorrow()).toBe(false);
    });

    test('rebellious 状态递增计数器', () => {
      const tracker = createChildStateTracker();
      const result = tracker.recordClassification({ state: CHILD_STATES.REBELLIOUS });
      expect(result.refusalCount).toBe(1);
      expect(result.shouldTriggerBorrow).toBe(false);
    });

    test('连续3次 rebellious → 触发借分对赌', () => {
      const tracker = createChildStateTracker();
      tracker.recordClassification({ state: CHILD_STATES.REBELLIOUS });
      tracker.recordClassification({ state: CHILD_STATES.REBELLIOUS });
      const result = tracker.recordClassification({ state: CHILD_STATES.REBELLIOUS });
      expect(result.refusalCount).toBe(3);
      expect(result.shouldTriggerBorrow).toBe(true);
    });

    test('low 状态不递增计数器', () => {
      const tracker = createChildStateTracker();
      tracker.recordClassification({ state: CHILD_STATES.REBELLIOUS });
      tracker.recordClassification({ state: CHILD_STATES.LOW });
      expect(tracker.getRefusalCount()).toBe(1);
    });

    test('energetic 状态重置计数器', () => {
      const tracker = createChildStateTracker();
      tracker.recordClassification({ state: CHILD_STATES.REBELLIOUS });
      tracker.recordClassification({ state: CHILD_STATES.REBELLIOUS });
      tracker.recordClassification({ state: CHILD_STATES.ENERGETIC });
      expect(tracker.getRefusalCount()).toBe(0);
    });

    test('resetRefusalCount 手动重置', () => {
      const tracker = createChildStateTracker();
      tracker.recordClassification({ state: CHILD_STATES.REBELLIOUS });
      tracker.resetRefusalCount();
      expect(tracker.getRefusalCount()).toBe(0);
    });

    test('自定义阈值', () => {
      const tracker = createChildStateTracker({ borrowTriggerThreshold: 2 });
      tracker.recordClassification({ state: CHILD_STATES.REBELLIOUS });
      const result = tracker.recordClassification({ state: CHILD_STATES.REBELLIOUS });
      expect(result.shouldTriggerBorrow).toBe(true);
    });
  });
});
