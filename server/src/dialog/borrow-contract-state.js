/**
 * 借分契约状态机 - Issue #9 借分契约机制
 *
 * 参考PRD §4.3 借分契约机制
 *
 * 5 个状态：
 *   IDLE        - 空闲（计数器未达阈值）
 *   COUNTING    - 计数中（正在追踪不愿推进次数）
 *   TRIGGERED   - 已触发（计数器达到阈值，准备发起契约）
 *   IN_PROGRESS - 契约进行中（孩子已接受对赌）
 *   COMPLETED   - 已完成（对赌结束，准备重置）
 */

// 借分契约状态常量
const BORROW_STATES = {
  IDLE: 'IDLE',
  COUNTING: 'COUNTING',
  TRIGGERED: 'TRIGGERED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED'
};

// 不愿推进类型常量
const REFUSAL_TYPES = {
  REBELLIOUS: 'rebellious', // 叛逆/无聊 → 递增计数器
  TIRED: 'tired',           // 累了 → 不递增,标记结束会话
  DIFFICULT: 'difficult'    // 畏难 → 不递增,标记降低难度
};

// 借分点数常量
const BORROW_POINTS = 10; // 借分固定 10 分
const WIN_POINTS = 20;    // 赢了翻倍 20 分

// 对赌结果常量
const CONTRACT_OUTCOMES = {
  WIN: 'win',
  LOSE: 'lose'
};

/**
 * 创建借分契约状态机
 * @param {object} [options]
 * @param {number} [options.threshold=3] - 触发借分契约的阈值
 * @returns {object} 状态机实例
 */
function createBorrowContractState(options = {}) {
  const threshold = options.threshold || 3;
  let currentState = BORROW_STATES.IDLE;
  let refusalCount = 0;

  return {
    getCurrentState() {
      return currentState;
    },

    getRefusalCount() {
      return refusalCount;
    },

    /**
     * 是否应触发借分契约(计数器达阈值且处于可触发状态)
     * @returns {boolean}
     */
    shouldTriggerBorrow() {
      return refusalCount >= threshold;
    },

    /**
     * 记录孩子的不愿推进反应
     * @param {string} type - 不愿推进类型(rebellious/tired/difficult)
     * @returns {{ refusalCount: number, currentState: string, shouldEndSession: boolean, shouldReduceDifficulty: boolean }}
     */
    recordRefusal(type) {
      // 默认返回值
      const result = {
        refusalCount,
        currentState,
        shouldEndSession: false,
        shouldReduceDifficulty: false
      };

      if (type === REFUSAL_TYPES.REBELLIOUS) {
        // 已触发后不再继续递增
        if (currentState !== BORROW_STATES.TRIGGERED) {
          refusalCount += 1;
          result.refusalCount = refusalCount;
          // 有不愿推进记录时从 IDLE 进入 COUNTING
          if (currentState === BORROW_STATES.IDLE) {
            currentState = BORROW_STATES.COUNTING;
          }
          // 计数器达阈值,转为 TRIGGERED
          if (refusalCount >= threshold) {
            currentState = BORROW_STATES.TRIGGERED;
          }
          result.currentState = currentState;
        }
      } else if (type === REFUSAL_TYPES.TIRED) {
        // 累了:不递增,标记结束会话
        result.shouldEndSession = true;
      } else if (type === REFUSAL_TYPES.DIFFICULT) {
        // 畏难:不递增,标记降低难度
        result.shouldReduceDifficulty = true;
      }

      return result;
    },

    /**
     * 接受对赌契约(TRIGGERED → IN_PROGRESS)
     */
    acceptContract() {
      if (currentState !== BORROW_STATES.TRIGGERED) {
        throw new Error(`acceptContract 只能在 TRIGGERED 状态下调用,当前状态: ${currentState}`);
      }
      currentState = BORROW_STATES.IN_PROGRESS;
    },

    /**
     * 拒绝对赌契约(TRIGGERED → IDLE,计数器重置)
     */
    rejectContract() {
      if (currentState !== BORROW_STATES.TRIGGERED) {
        throw new Error(`rejectContract 只能在 TRIGGERED 状态下调用,当前状态: ${currentState}`);
      }
      currentState = BORROW_STATES.IDLE;
      refusalCount = 0;
    },

    /**
     * 完成对赌契约(IN_PROGRESS → COMPLETED)
     * @param {string} outcome - 对赌结果('win'/'lose')
     * @returns {{ outcome: string, currentState: string }}
     */
    completeContract(outcome) {
      if (currentState !== BORROW_STATES.IN_PROGRESS) {
        throw new Error(`completeContract 只能在 IN_PROGRESS 状态下调用,当前状态: ${currentState}`);
      }
      if (outcome !== CONTRACT_OUTCOMES.WIN && outcome !== CONTRACT_OUTCOMES.LOSE) {
        throw new Error(`completeContract 的 outcome 必须是 'win' 或 'lose',收到: ${outcome}`);
      }
      currentState = BORROW_STATES.COMPLETED;
      return {
        outcome,
        currentState
      };
    },

    /**
     * 重置状态机到 IDLE,计数器归零
     */
    reset() {
      currentState = BORROW_STATES.IDLE;
      refusalCount = 0;
    },

    /**
     * 获取借分点数(固定 10 分)
     * @returns {number}
     */
    getBorrowPoints() {
      return BORROW_POINTS;
    },

    /**
     * 获取赢了后的点数(翻倍 20 分)
     * @returns {number}
     */
    getWinPoints() {
      return WIN_POINTS;
    }
  };
}

module.exports = {
  BORROW_STATES,
  createBorrowContractState
};
