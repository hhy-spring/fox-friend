/**
 * 借分契约结果处理测试 - Issue #9 借分契约机制
 *
 * 参考PRD §4.3 借分契约
 *   处理借分契约对赌的三种结果: 赢 / 输 / 改变主意
 *   - 赢了: 解锁新故事(正面强化),返回 20 分
 *   - 输了: 执行搞笑任务(不涉及惩罚),从搞笑任务池随机选一个
 *   - 改变主意: 立即退出对赌
 *
 * 测试覆盖(TDD 垂直切片,逐步追加):
 *   - handleWin 返回正确结构
 *   - handleLose 返回包含 funnyTask 的结构
 *   - handleChangeMind 返回退出结构
 *   - isValidOutcome 验证结果类型
 *   - getUnlockableStories 返回新故事列表
 *   - 依赖注入 funnyTaskPool
 *   - OUTCOME_TYPES 常量
 *   - 边界情况与结果验证
 */
const {
  createContractOutcome,
  OUTCOME_TYPES
} = require('../../src/dialog/contract-outcome');

describe('ContractOutcome - 借分契约结果处理 (Issue #9)', () => {
  describe('handleWin - 赢了对赌', () => {
    test('1. handleWin 返回 outcome=win, storyUnlocked=true 的结构', () => {
      const outcome = createContractOutcome();
      const result = outcome.handleWin();
      expect(result.outcome).toBe('win');
      expect(result.storyUnlocked).toBe(true);
    });
  });

  describe('handleLose - 输了对赌', () => {
    test('2. handleLose 返回 outcome=lose 且包含完整 funnyTask 的结构', () => {
      const outcome = createContractOutcome();
      const result = outcome.handleLose();
      expect(result.outcome).toBe('lose');
      // funnyTask 应包含 id/name/description/emoji 四个字段
      expect(result.funnyTask).not.toBeNull();
      expect(result.funnyTask).toHaveProperty('id');
      expect(result.funnyTask).toHaveProperty('name');
      expect(result.funnyTask).toHaveProperty('description');
      expect(result.funnyTask).toHaveProperty('emoji');
    });
  });

  describe('handleChangeMind - 孩子改变主意', () => {
    test('3. handleChangeMind 返回 outcome=changed_mind, exited=true 的退出结构', () => {
      const outcome = createContractOutcome();
      const result = outcome.handleChangeMind();
      expect(result.outcome).toBe('changed_mind');
      expect(result.exited).toBe(true);
    });
  });

  describe('isValidOutcome - 验证结果类型', () => {
    test('4. isValidOutcome 对合法类型 win/lose/changed_mind 返回 true', () => {
      const outcome = createContractOutcome();
      expect(outcome.isValidOutcome('win')).toBe(true);
      expect(outcome.isValidOutcome('lose')).toBe(true);
      expect(outcome.isValidOutcome('changed_mind')).toBe(true);
    });

    test('4b. isValidOutcome 对非法类型返回 false', () => {
      const outcome = createContractOutcome();
      expect(outcome.isValidOutcome('invalid')).toBe(false);
      expect(outcome.isValidOutcome('draw')).toBe(false);
      expect(outcome.isValidOutcome('')).toBe(false);
    });
  });

  describe('getUnlockableStories - 赢了可解锁的新故事', () => {
    test('5. getUnlockableStories 返回命运主线4阶段故事列表', () => {
      const outcome = createContractOutcome();
      const stories = outcome.getUnlockableStories();
      expect(Array.isArray(stories)).toBe(true);
      expect(stories).toHaveLength(4);
      // 参考技术架构命运主线4阶段
      expect(stories).toContain('字母石冒险');
      expect(stories).toContain('门牌的秘密');
      expect(stories).toContain('灯塔之光');
      expect(stories).toContain('小鸟的旅程');
    });
  });

  describe('依赖注入 funnyTaskPool', () => {
    test('6. 注入自定义 funnyTaskPool 后 handleLose 使用注入的实例', () => {
      // 构造一个可控的 mock 任务池
      const mockTask = {
        id: 'mock_task',
        name: '模拟搞笑任务',
        description: '这是用于测试的模拟任务',
        emoji: '🃏'
      };
      let getRandomCallCount = 0;
      const mockPool = {
        getRandomTask() {
          getRandomCallCount += 1;
          return mockTask;
        }
      };

      const outcome = createContractOutcome({ funnyTaskPool: mockPool });
      const result = outcome.handleLose();
      // 应调用注入池的 getRandomTask
      expect(getRandomCallCount).toBe(1);
      // 返回的 funnyTask 应为 mock 任务
      expect(result.funnyTask).toEqual(mockTask);
      expect(result.funnyTask.id).toBe('mock_task');
    });

    test('6b. 不注入 funnyTaskPool 时使用默认实例仍能正常工作', () => {
      const outcome = createContractOutcome();
      const result = outcome.handleLose();
      expect(result.funnyTask).not.toBeNull();
      expect(result.funnyTask).toHaveProperty('id');
    });
  });

  describe('OUTCOME_TYPES 常量', () => {
    test('7. OUTCOME_TYPES 导出三个常量 win/lose/changed_mind', () => {
      expect(OUTCOME_TYPES.WIN).toBe('win');
      expect(OUTCOME_TYPES.LOSE).toBe('lose');
      expect(OUTCOME_TYPES.CHANGED_MIND).toBe('changed_mind');
    });

    test('7b. handle* 方法返回的 outcome 与 OUTCOME_TYPES 常量一致', () => {
      const outcome = createContractOutcome();
      expect(outcome.handleWin().outcome).toBe(OUTCOME_TYPES.WIN);
      expect(outcome.handleLose().outcome).toBe(OUTCOME_TYPES.LOSE);
      expect(outcome.handleChangeMind().outcome).toBe(OUTCOME_TYPES.CHANGED_MIND);
    });
  });

  describe('结果结构完整性', () => {
    test('8. handleWin 返回完整结构: outcome/storyUnlocked/dialogue/points', () => {
      const outcome = createContractOutcome();
      const result = outcome.handleWin();
      expect(result).toHaveProperty('outcome', 'win');
      expect(result).toHaveProperty('storyUnlocked', true);
      expect(result).toHaveProperty('dialogue');
      expect(typeof result.dialogue).toBe('string');
      expect(result.dialogue.length).toBeGreaterThan(0);
      expect(result).toHaveProperty('points', 20);
    });

    test('8b. handleLose 返回完整结构: outcome/funnyTask/dialogue/points', () => {
      const outcome = createContractOutcome();
      const result = outcome.handleLose();
      expect(result).toHaveProperty('outcome', 'lose');
      expect(result).toHaveProperty('funnyTask');
      expect(result).toHaveProperty('dialogue');
      expect(typeof result.dialogue).toBe('string');
      expect(result.dialogue.length).toBeGreaterThan(0);
      expect(result).toHaveProperty('points', 0);
    });

    test('8c. handleChangeMind 返回完整结构: outcome/dialogue/exited', () => {
      const outcome = createContractOutcome();
      const result = outcome.handleChangeMind();
      expect(result).toHaveProperty('outcome', 'changed_mind');
      expect(result).toHaveProperty('dialogue');
      expect(typeof result.dialogue).toBe('string');
      expect(result.dialogue.length).toBeGreaterThan(0);
      expect(result).toHaveProperty('exited', true);
      // 改变主意不产生点数,不应包含 points 字段
      expect(result).not.toHaveProperty('points');
    });
  });

  describe('边界情况', () => {
    test('9. handleLose 任务池耗尽后 funnyTask 返回 null', () => {
      // 注入一个总是返回 null 的任务池(模拟任务池耗尽)
      const emptyPool = {
        getRandomTask() {
          return null;
        }
      };
      const outcome = createContractOutcome({ funnyTaskPool: emptyPool });
      const result = outcome.handleLose();
      expect(result.outcome).toBe('lose');
      expect(result.funnyTask).toBeNull();
      expect(result.points).toBe(0);
    });

    test('10. isValidOutcome 对非字符串输入返回 false', () => {
      const outcome = createContractOutcome();
      expect(outcome.isValidOutcome(null)).toBe(false);
      expect(outcome.isValidOutcome(undefined)).toBe(false);
      expect(outcome.isValidOutcome(123)).toBe(false);
      expect(outcome.isValidOutcome({})).toBe(false);
    });

    test('11. getUnlockableStories 返回副本,修改不影响后续调用', () => {
      const outcome = createContractOutcome();
      const stories1 = outcome.getUnlockableStories();
      // 篡改第一次返回的数组
      stories1.push('篡改的故事');
      stories1[0] = '被改的故事';
      // 第二次调用应仍返回原始4个故事
      const stories2 = outcome.getUnlockableStories();
      expect(stories2).toHaveLength(4);
      expect(stories2).toContain('字母石冒险');
      expect(stories2).not.toContain('篡改的故事');
    });

    test('12. 多个实例之间互不影响(各自持有独立任务池)', () => {
      const outcomeA = createContractOutcome();
      const outcomeB = createContractOutcome();
      // A 调用 handleLose 不影响 B 的任务池
      const resultA = outcomeA.handleLose();
      const resultB = outcomeB.handleLose();
      expect(resultA.funnyTask).not.toBeNull();
      expect(resultB.funnyTask).not.toBeNull();
      // 两个实例各自独立,任务池不共享已使用记录
      // (注:由于随机性,id 可能相同也可能不同,这里只验证都能正常返回)
    });
  });
});
