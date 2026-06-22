/**
 * 对话状态机（FSM）- 管理第一次见面5步流程
 *
 * 参考技术架构文档§三「对话引擎架构」：
 *   FSM Router（5-step FSM）→ LLM Generator → Emotion Adjuster → Interest Brancher
 *
 * 5步状态对应 PRD §4.1：
 *   1. APPEARANCE（出场）
 *   2. HELP_REQUEST（求助）
 *   3. NAMING_CEREMONY（命名仪式）
 *   4. FEYNMAN_TRIGGER（费曼触发）
 *   5. PARTNER_CONFIRM（搭档确认）
 */

// 对话状态定义
const DIALOG_STATES = {
  APPEARANCE: 'APPEARANCE',
  HELP_REQUEST: 'HELP_REQUEST',
  NAMING_CEREMONY: 'NAMING_CEREMONY',
  FEYNMAN_TRIGGER: 'FEYNMAN_TRIGGER',
  PARTNER_CONFIRM: 'PARTNER_CONFIRM'
};

// 步骤元信息
const STEP_META = {
  [DIALOG_STATES.APPEARANCE]: {
    step: 1,
    description: '出场',
    nextExpected: DIALOG_STATES.HELP_REQUEST
  },
  [DIALOG_STATES.HELP_REQUEST]: {
    step: 2,
    description: '求助',
    nextExpected: DIALOG_STATES.NAMING_CEREMONY
  },
  [DIALOG_STATES.NAMING_CEREMONY]: {
    step: 3,
    description: '命名仪式',
    nextExpected: DIALOG_STATES.FEYNMAN_TRIGGER
  },
  [DIALOG_STATES.FEYNMAN_TRIGGER]: {
    step: 4,
    description: '费曼触发',
    nextExpected: DIALOG_STATES.PARTNER_CONFIRM
  },
  [DIALOG_STATES.PARTNER_CONFIRM]: {
    step: 5,
    description: '搭档确认',
    nextExpected: null
  }
};

// 合法状态转换（严格按步骤顺序）
const TRANSITIONS = {
  [DIALOG_STATES.APPEARANCE]: [DIALOG_STATES.HELP_REQUEST],
  [DIALOG_STATES.HELP_REQUEST]: [DIALOG_STATES.NAMING_CEREMONY],
  [DIALOG_STATES.NAMING_CEREMONY]: [DIALOG_STATES.FEYNMAN_TRIGGER],
  [DIALOG_STATES.FEYNMAN_TRIGGER]: [DIALOG_STATES.PARTNER_CONFIRM],
  [DIALOG_STATES.PARTNER_CONFIRM]: []
};

/**
 * 创建对话状态机实例
 * @param {string} initialState - 初始状态，默认为 APPEARANCE
 * @returns {object} FSM 实例
 */
function createDialogFSM(initialState = DIALOG_STATES.APPEARANCE) {
  let currentState = initialState;

  return {
    // 获取当前状态
    getState() {
      return currentState;
    },

    // 尝试转换到目标状态
    transition(targetState) {
      const allowed = TRANSITIONS[currentState] || [];
      if (!allowed.includes(targetState)) {
        throw new Error(
          `不允许从 ${currentState} 转换到 ${targetState}`
        );
      }
      currentState = targetState;
      return currentState;
    },

    // 获取当前步骤信息
    getStepInfo() {
      const meta = STEP_META[currentState];
      return {
        currentStep: meta.step,
        currentStepName: currentState,
        nextExpected: meta.nextExpected,
        description: meta.description
      };
    },

    // 重置为初始状态
    reset() {
      currentState = DIALOG_STATES.APPEARANCE;
      return currentState;
    }
  };
}

module.exports = { DIALOG_STATES, TRANSITIONS, STEP_META, createDialogFSM };
