/**
 * 借分契约状态机测试 - Issue #9 借分契约机制
 *
 * 参考PRD §4.3 借分契约机制
 *
 * 5 个状态：IDLE / COUNTING / TRIGGERED / IN_PROGRESS / COMPLETED
 * 核心行为：
 *   叛逆/无聊 → 递增计数器，达阈值触发契约
 *   累了 → 不递增，标记结束会话
 *   畏难 → 不递增，标记降低难度
 */
const {
  BORROW_STATES,
  createBorrowContractState
} = require('../../src/dialog/borrow-contract-state');

describe('借分契约状态机 - Issue #9', () => {
  describe('初始状态', () => {
    test('初始状态为 IDLE,计数器为 0', () => {
      const state = createBorrowContractState();
      expect(state.getCurrentState()).toBe(BORROW_STATES.IDLE);
      expect(state.getRefusalCount()).toBe(0);
    });
  });

  describe('recordRefusal - 叛逆状态递增计数器', () => {
    test('rebellious 递增计数器,状态从 IDLE 转为 COUNTING', () => {
      const state = createBorrowContractState();
      const result = state.recordRefusal('rebellious');
      expect(state.getRefusalCount()).toBe(1);
      expect(state.getCurrentState()).toBe(BORROW_STATES.COUNTING);
      expect(result.refusalCount).toBe(1);
      expect(result.currentState).toBe(BORROW_STATES.COUNTING);
    });

    test('连续 rebellious 持续递增计数器', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      expect(state.getRefusalCount()).toBe(2);
      expect(state.getCurrentState()).toBe(BORROW_STATES.COUNTING);
    });
  });

  describe('recordRefusal - 累了状态不递增计数器', () => {
    test('tired 不递增计数器,返回 shouldEndSession: true', () => {
      const state = createBorrowContractState();
      const result = state.recordRefusal('tired');
      expect(state.getRefusalCount()).toBe(0);
      expect(result.shouldEndSession).toBe(true);
      expect(result.shouldReduceDifficulty).toBe(false);
    });

    test('已有计数时 tired 仍不递增', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      const result = state.recordRefusal('tired');
      expect(state.getRefusalCount()).toBe(1);
      expect(result.shouldEndSession).toBe(true);
    });
  });

  describe('recordRefusal - 畏难状态不递增计数器', () => {
    test('difficult 不递增计数器,返回 shouldReduceDifficulty: true', () => {
      const state = createBorrowContractState();
      const result = state.recordRefusal('difficult');
      expect(state.getRefusalCount()).toBe(0);
      expect(result.shouldReduceDifficulty).toBe(true);
      expect(result.shouldEndSession).toBe(false);
    });

    test('已有计数时 difficult 仍不递增', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      const result = state.recordRefusal('difficult');
      expect(state.getRefusalCount()).toBe(2);
      expect(result.shouldReduceDifficulty).toBe(true);
    });
  });

  describe('计数器达阈值触发契约', () => {
    test('连续3次 rebellious 后状态转为 TRIGGERED', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      const result = state.recordRefusal('rebellious');
      expect(state.getRefusalCount()).toBe(3);
      expect(state.getCurrentState()).toBe(BORROW_STATES.TRIGGERED);
      expect(result.currentState).toBe(BORROW_STATES.TRIGGERED);
    });

    test('达阈值后 shouldTriggerBorrow 返回 true', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      expect(state.shouldTriggerBorrow()).toBe(true);
    });

    test('未达阈值时 shouldTriggerBorrow 返回 false', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      expect(state.shouldTriggerBorrow()).toBe(false);
    });

    test('TRIGGERED 后继续 rebellious 不再递增计数器', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      // 已触发,再记录不应继续递增
      state.recordRefusal('rebellious');
      expect(state.getRefusalCount()).toBe(3);
      expect(state.getCurrentState()).toBe(BORROW_STATES.TRIGGERED);
    });
  });

  describe('自定义阈值配置', () => {
    test('自定义阈值为 2 时,2次 rebellious 即触发', () => {
      const state = createBorrowContractState({ threshold: 2 });
      state.recordRefusal('rebellious');
      const result = state.recordRefusal('rebellious');
      expect(state.getCurrentState()).toBe(BORROW_STATES.TRIGGERED);
      expect(state.shouldTriggerBorrow()).toBe(true);
      expect(result.currentState).toBe(BORROW_STATES.TRIGGERED);
    });

    test('自定义阈值为 5 时,4次未触发,5次触发', () => {
      const state = createBorrowContractState({ threshold: 5 });
      for (let i = 0; i < 4; i++) {
        state.recordRefusal('rebellious');
      }
      expect(state.getCurrentState()).toBe(BORROW_STATES.COUNTING);
      expect(state.shouldTriggerBorrow()).toBe(false);
      state.recordRefusal('rebellious');
      expect(state.getCurrentState()).toBe(BORROW_STATES.TRIGGERED);
      expect(state.shouldTriggerBorrow()).toBe(true);
    });
  });

  describe('acceptContract - 接受对赌', () => {
    test('TRIGGERED 状态下 acceptContract 转为 IN_PROGRESS', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.acceptContract();
      expect(state.getCurrentState()).toBe(BORROW_STATES.IN_PROGRESS);
    });

    test('非 TRIGGERED 状态下 acceptContract 应抛出错误', () => {
      const state = createBorrowContractState();
      expect(() => state.acceptContract()).toThrow();
    });
  });

  describe('rejectContract - 拒绝对赌', () => {
    test('TRIGGERED 状态下 rejectContract 转为 IDLE 并重置计数器', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      expect(state.getCurrentState()).toBe(BORROW_STATES.TRIGGERED);
      state.rejectContract();
      expect(state.getCurrentState()).toBe(BORROW_STATES.IDLE);
      expect(state.getRefusalCount()).toBe(0);
    });

    test('非 TRIGGERED 状态下 rejectContract 应抛出错误', () => {
      const state = createBorrowContractState();
      expect(() => state.rejectContract()).toThrow();
    });
  });

  describe('completeContract - 完成对赌', () => {
    test('IN_PROGRESS 状态下 completeContract("win") 转为 COMPLETED', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.acceptContract();
      state.completeContract('win');
      expect(state.getCurrentState()).toBe(BORROW_STATES.COMPLETED);
    });

    test('IN_PROGRESS 状态下 completeContract("lose") 转为 COMPLETED', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.acceptContract();
      state.completeContract('lose');
      expect(state.getCurrentState()).toBe(BORROW_STATES.COMPLETED);
    });

    test('非 IN_PROGRESS 状态下 completeContract 应抛出错误', () => {
      const state = createBorrowContractState();
      expect(() => state.completeContract('win')).toThrow();
    });

    test('completeContract 返回对赌结果信息', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.acceptContract();
      const result = state.completeContract('win');
      expect(result.outcome).toBe('win');
      expect(result.currentState).toBe(BORROW_STATES.COMPLETED);
    });
  });

  describe('reset - 重置状态机', () => {
    test('reset 将状态重置为 IDLE,计数器归零', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.reset();
      expect(state.getCurrentState()).toBe(BORROW_STATES.IDLE);
      expect(state.getRefusalCount()).toBe(0);
    });

    test('COMPLETED 状态下 reset 重置为 IDLE', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.acceptContract();
      state.completeContract('win');
      state.reset();
      expect(state.getCurrentState()).toBe(BORROW_STATES.IDLE);
      expect(state.getRefusalCount()).toBe(0);
    });

    test('reset 后可重新计数触发', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.reset();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      expect(state.getCurrentState()).toBe(BORROW_STATES.TRIGGERED);
    });
  });

  describe('借分点数', () => {
    test('getBorrowPoints 返回固定 10 分', () => {
      const state = createBorrowContractState();
      expect(state.getBorrowPoints()).toBe(10);
    });

    test('getWinPoints 返回翻倍 20 分', () => {
      const state = createBorrowContractState();
      expect(state.getWinPoints()).toBe(20);
    });
  });

  describe('边界情况与非法状态转换', () => {
    test('completeContract 传入非法 outcome 应抛出错误', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.acceptContract();
      expect(() => state.completeContract('draw')).toThrow();
    });

    test('IN_PROGRESS 状态下 acceptContract 应抛出错误', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.acceptContract();
      expect(() => state.acceptContract()).toThrow();
    });

    test('COMPLETED 状态下 completeContract 应抛出错误', () => {
      const state = createBorrowContractState();
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.acceptContract();
      state.completeContract('win');
      expect(() => state.completeContract('win')).toThrow();
    });

    test('recordRefusal 传入未知类型不递增不报错', () => {
      const state = createBorrowContractState();
      const result = state.recordRefusal('unknown');
      expect(state.getRefusalCount()).toBe(0);
      expect(result.shouldEndSession).toBe(false);
      expect(result.shouldReduceDifficulty).toBe(false);
    });
  });

  describe('完整生命周期', () => {
    test('完整流程: IDLE → COUNTING → TRIGGERED → IN_PROGRESS → COMPLETED → IDLE', () => {
      const state = createBorrowContractState({ threshold: 3 });

      // IDLE → COUNTING
      expect(state.getCurrentState()).toBe(BORROW_STATES.IDLE);
      state.recordRefusal('rebellious');
      expect(state.getCurrentState()).toBe(BORROW_STATES.COUNTING);

      // COUNTING → TRIGGERED
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      expect(state.getCurrentState()).toBe(BORROW_STATES.TRIGGERED);
      expect(state.shouldTriggerBorrow()).toBe(true);

      // TRIGGERED → IN_PROGRESS
      state.acceptContract();
      expect(state.getCurrentState()).toBe(BORROW_STATES.IN_PROGRESS);

      // IN_PROGRESS → COMPLETED
      const result = state.completeContract('win');
      expect(state.getCurrentState()).toBe(BORROW_STATES.COMPLETED);
      expect(result.outcome).toBe('win');

      // COMPLETED → IDLE (通过 reset)
      state.reset();
      expect(state.getCurrentState()).toBe(BORROW_STATES.IDLE);
      expect(state.getRefusalCount()).toBe(0);
    });

    test('拒绝流程: IDLE → COUNTING → TRIGGERED → IDLE(重置)', () => {
      const state = createBorrowContractState({ threshold: 3 });

      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      expect(state.getCurrentState()).toBe(BORROW_STATES.TRIGGERED);

      state.rejectContract();
      expect(state.getCurrentState()).toBe(BORROW_STATES.IDLE);
      expect(state.getRefusalCount()).toBe(0);
      expect(state.shouldTriggerBorrow()).toBe(false);
    });

    test('输了的对赌流程也正确完成', () => {
      const state = createBorrowContractState({ threshold: 2 });

      state.recordRefusal('rebellious');
      state.recordRefusal('rebellious');
      state.acceptContract();
      const result = state.completeContract('lose');
      expect(state.getCurrentState()).toBe(BORROW_STATES.COMPLETED);
      expect(result.outcome).toBe('lose');
    });
  });
});
