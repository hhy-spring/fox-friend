/**
 * 费曼学习法流程编排器 - Issue #4 费曼学习法首次触发
 *
 * 参考技术架构文档§「费曼学习法」
 * 参考PRD §4.1 步骤4 费曼学习法首次触发
 *
 * 职责：
 *   1. 编排费曼学习法的完整流程：触发 → 等待反应 → 反馈 → 完成
 *   2. 串联 step4-templates（台词）和 child-response-classifier（反应分类）
 *   3. 维护流程状态机与计时预算（1分钟）
 *
 * 流程状态机：
 *   TRIGGER → AWAIT_RESPONSE → FEEDBACK → COMPLETE
 *
 * 接口契约：
 *   createFeynmanOrchestrator(interestType, foxName) → 编排器实例
 */

const step4Templates = require('./step4-templates');
const childResponseClassifier = require('./child-response-classifier');

// 流程状态常量
const STATES = {
  TRIGGER: 'TRIGGER',
  AWAIT_RESPONSE: 'AWAIT_RESPONSE',
  FEEDBACK: 'FEEDBACK',
  COMPLETE: 'COMPLETE'
};

// 1分钟预算（毫秒）
const TIMING_BUDGET_MS = 60000;

/**
 * 创建费曼学习法流程编排器实例
 * @param {string} interestType - 兴趣分型（dinosaur | princess | speed | generic）
 * @param {string} foxName - 狐狸的名字
 * @returns {object} 编排器实例
 */
function createFeynmanOrchestrator(interestType, foxName) {
  // 流程状态
  let state = STATES.TRIGGER;
  // 目标生字（在 getTriggerDialog 时确定）
  let targetCharacter = null;
  // 流程起始时间戳
  let startedAt = Date.now();

  return {
    /**
     * 获取当前流程状态
     * @returns {string} 'TRIGGER' | 'AWAIT_RESPONSE' | 'FEEDBACK' | 'COMPLETE'
     */
    getState() {
      return state;
    },

    /**
     * 获取费曼触发台词（小狐狸请孩子教它认字）
     * 调用 step4-templates.getStep4TriggerDialog
     * 状态从 TRIGGER → AWAIT_RESPONSE
     * @returns {{ mainLine: string, followUp: string|null, targetCharacter: string|null, waitBeforeNextMs: number }}
     */
    getTriggerDialog() {
      const triggerDialog = step4Templates.getStep4TriggerDialog(interestType, foxName);
      // 记录目标生字，供后续反应分类使用
      targetCharacter = triggerDialog.targetCharacter;
      // 状态转换：TRIGGER → AWAIT_RESPONSE
      state = STATES.AWAIT_RESPONSE;
      return triggerDialog;
    },

    /**
     * 获取目标生字
     * @returns {string|null} 目标生字（如 '龙'、'闪'），未触发或无目标字时为 null
     */
    getTargetCharacter() {
      return targetCharacter;
    },

    /**
     * 处理孩子的反应文本
     * 1. 调用 child-response-classifier.classifyChildResponse 分类
     * 2. 调用 step4-templates.getStep4FeedbackDialog 获取反馈
     * 3. 状态从 AWAIT_RESPONSE → FEEDBACK → COMPLETE
     * @param {string} responseText - 孩子的反应文本
     * @returns {{ mainLine: string, followUp: string|null, teachingWillingness: boolean, classification: object, waitBeforeNextMs: number }}
     */
    processChildResponse(responseText) {
      // TRIGGER 状态调用应抛出错误：必须先调用 getTriggerDialog
      if (state === STATES.TRIGGER) {
        throw new Error('必须先调用 getTriggerDialog 触发费曼流程，再处理孩子反应');
      }
      // COMPLETE 状态调用应抛出错误：流程已完成
      if (state === STATES.COMPLETE) {
        throw new Error('费曼学习法流程已完成，不能再次处理孩子反应');
      }
      // 仅 AWAIT_RESPONSE 状态可处理孩子反应
      if (state !== STATES.AWAIT_RESPONSE) {
        throw new Error(`当前状态 ${state} 不允许处理孩子反应`);
      }

      // 1. 调用分类器对孩子反应进行分类
      const classification = childResponseClassifier.classifyChildResponse(
        responseText,
        targetCharacter
      );

      // 2. 根据分类结果获取反馈台词
      const feedbackDialog = step4Templates.getStep4FeedbackDialog(classification.type);

      // 3. 状态转换：AWAIT_RESPONSE → FEEDBACK → COMPLETE
      state = STATES.FEEDBACK;
      state = STATES.COMPLETE;

      return {
        mainLine: feedbackDialog.mainLine,
        followUp: feedbackDialog.followUp,
        teachingWillingness: feedbackDialog.teachingWillingness,
        classification: {
          type: classification.type,
          confidence: classification.confidence,
          matchedKeyword: classification.matchedKeyword
        },
        waitBeforeNextMs: feedbackDialog.waitBeforeNextMs
      };
    },

    /**
     * 判断流程是否完成
     * @returns {boolean} 流程处于 COMPLETE 状态时返回 true
     */
    isComplete() {
      return state === STATES.COMPLETE;
    },

    /**
     * 获取计时信息（1分钟预算）
     * @returns {{ elapsed: number, budget: number, withinBudget: boolean }}
     */
    getTimingInfo() {
      const elapsed = Date.now() - startedAt;
      return {
        elapsed,
        budget: TIMING_BUDGET_MS,
        withinBudget: elapsed <= TIMING_BUDGET_MS
      };
    },

    /**
     * 重置编排器到初始状态
     * 状态回到 TRIGGER，清空目标生字，重置计时
     */
    reset() {
      state = STATES.TRIGGER;
      targetCharacter = null;
      startedAt = Date.now();
    }
  };
}

module.exports = {
  createFeynmanOrchestrator,
  STATES
};
