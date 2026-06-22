/**
 * 第一次见面全流程管理器 - 管理第一次见面5步流程（步骤1-5）
 *
 * 参考技术架构文档§三「对话引擎架构」：
 *   FSM Router（5-step FSM）→ LLM Generator → Emotion Adjuster → Interest Brancher
 *
 * 第一次见面5个步骤（参考 PRD §4.1）：
 *   1. 出场（小狐狸紧张惊喜出场）
 *   2. 求助（请孩子帮忙起名字）
 *   3. 命名仪式+画像采集
 *   4. 费曼学习法首次触发
 *   5. 搭档确认+画像落库
 *
 * 计时预算：5-8分钟（300000ms - 480000ms）
 * 次日提醒：步骤5完成时自动设置，小狐狸说「明天我还会来找你的」对应此标记
 */

// 流程状态定义
const FLOW_STATES = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED'
};

// 步骤范围常量
const MIN_STEP = 1;
const MAX_STEP = 5;

// 计时预算（毫秒）
const BUDGET_MIN_MS = 300000; // 5分钟
const BUDGET_MAX_MS = 480000; // 8分钟

// 一天的毫秒数（用于计算次日提醒日期）
const ONE_DAY_MS = 86400000;

/**
 * 计算次日提醒日期（ISO格式 YYYY-MM-DD）
 * @returns {string} 次日日期字符串
 */
function computeNextDayDate() {
  return new Date(Date.now() + ONE_DAY_MS).toISOString().split('T')[0];
}

/**
 * 创建第一次见面全流程管理器
 * @param {string} childId - 孩子 ID
 * @param {string} foxName - 小狐狸名字
 * @returns {object} 流程管理器实例
 */
function createFirstMeetingFlow(childId, foxName) {
  // 当前步骤（1-5）
  let currentStep = MIN_STEP;
  // 流程状态
  let state = FLOW_STATES.IN_PROGRESS;
  // 计时开始时间戳
  let startTime = null;
  // 次日提醒
  const nextDayReminder = {
    enabled: false,
    date: null
  };

  /**
   * 设置次日提醒
   */
  function applyNextDayReminder() {
    nextDayReminder.enabled = true;
    nextDayReminder.date = computeNextDayDate();
  }

  return {
    // ===== 状态查询 =====

    // 获取当前步骤号（1-5）
    getCurrentStep() {
      return currentStep;
    },

    // 获取流程状态
    getState() {
      return state;
    },

    // 判断流程是否完成（步骤5完成）
    isComplete() {
      return state === FLOW_STATES.COMPLETED;
    },

    // ===== 步骤推进 =====

    // 推进到指定步骤
    advanceToStep(stepNumber) {
      if (state === FLOW_STATES.COMPLETED) {
        throw new Error('流程已完成，无法再推进步骤');
      }
      if (stepNumber < MIN_STEP || stepNumber > MAX_STEP) {
        throw new Error(
          `无效步骤号：${stepNumber}，有效范围为 ${MIN_STEP}-${MAX_STEP}`
        );
      }
      const previousStep = currentStep;
      currentStep = stepNumber;
      return {
        success: true,
        currentStep,
        previousStep
      };
    },

    // 推进到下一步
    advanceToNext() {
      if (state === FLOW_STATES.COMPLETED) {
        throw new Error('流程已完成，无法再推进步骤');
      }
      // 如果当前已在步骤5，再推进则完成流程
      if (currentStep >= MAX_STEP) {
        state = FLOW_STATES.COMPLETED;
        // 步骤5完成时自动设置次日提醒
        applyNextDayReminder();
        return {
          success: true,
          currentStep: MAX_STEP,
          isComplete: true
        };
      }
      currentStep += 1;
      return {
        success: true,
        currentStep,
        isComplete: false
      };
    },

    // ===== 计时管理 =====

    // 开始计时
    start() {
      startTime = Date.now();
      return { started: true, startTime };
    },

    // 获取计时信息
    getTimingInfo() {
      const elapsed = startTime !== null ? Date.now() - startTime : 0;
      return {
        elapsed,
        budgetMin: BUDGET_MIN_MS,
        budgetMax: BUDGET_MAX_MS,
        withinBudget: elapsed <= BUDGET_MAX_MS,
        progress: currentStep
      };
    },

    // ===== 次日提醒 =====

    // 设置次日提醒标记
    setNextDayReminder() {
      applyNextDayReminder();
      return { ...nextDayReminder };
    },

    // 获取次日提醒状态
    getNextDayReminder() {
      return {
        enabled: nextDayReminder.enabled,
        date: nextDayReminder.date
      };
    },

    // ===== 流程完成 =====

    // 标记流程完成，自动设置次日提醒
    complete() {
      state = FLOW_STATES.COMPLETED;
      currentStep = MAX_STEP;
      applyNextDayReminder();
      return {
        success: true,
        isComplete: true
      };
    },

    // 获取完整摘要
    getSummary() {
      return {
        childId,
        foxName,
        currentStep,
        isComplete: state === FLOW_STATES.COMPLETED,
        timingInfo: this.getTimingInfo(),
        nextDayReminder: this.getNextDayReminder()
      };
    }
  };
}

module.exports = {
  FLOW_STATES,
  BUDGET_MIN_MS,
  BUDGET_MAX_MS,
  createFirstMeetingFlow
};
