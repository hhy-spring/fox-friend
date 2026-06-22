/**
 * 搭档确认流程编排器 - Issue #5 搭档确认流程
 *
 * 参考技术架构文档§「搭档确认」
 * 参考PRD §4.1 步骤5 搭档确认
 *
 * 职责：
 *   1. 编排搭档确认完整流程：邀请 → 等待反应 → 确认/拒绝/再邀
 *   2. 串联 step5-templates（台词）和 partner-response-classifier（反应分类）
 *   3. 维护流程状态机与计时预算（2分钟）
 *
 * 流程状态机：
 *   INVITE → AWAIT_RESPONSE → CONFIRMED (accept) / DECLINED (refuse) / RE_INVITE (hesitate → 回到 AWAIT_RESPONSE)
 *
 * 接口契约：
 *   createPartnerOrchestrator(interestType, foxName) → 编排器实例
 */

const step5Templates = require('./step5-templates');
const partnerResponseClassifier = require('./partner-response-classifier');

// 流程状态常量
const STATES = {
  INVITE: 'INVITE',
  AWAIT_RESPONSE: 'AWAIT_RESPONSE',
  CONFIRMED: 'CONFIRMED',
  DECLINED: 'DECLINED'
};

// 2分钟预算（毫秒）
const TIMING_BUDGET_MS = 120000;

/**
 * 创建搭档确认流程编排器实例
 * @param {string} interestType - 兴趣分型（dinosaur | princess | speed | generic）
 * @param {string} foxName - 狐狸的名字
 * @returns {object} 编排器实例
 */
function createPartnerOrchestrator(interestType, foxName) {
  // 流程状态
  let state = STATES.INVITE;
  // 搭档接受状态：null（未确定）| true（接受）| false（拒绝）
  let partnerAcceptance = null;
  // 流程起始时间戳
  let startedAt = Date.now();

  return {
    /**
     * 获取当前流程状态
     * @returns {string} 'INVITE' | 'AWAIT_RESPONSE' | 'CONFIRMED' | 'DECLINED'
     */
    getState() {
      return state;
    },

    /**
     * 获取搭档邀请台词
     * 调用 step5-templates.getStep5Dialog（不传 childResponse）
     * 状态从 INVITE → AWAIT_RESPONSE
     * @returns {{ mainLine: string, followUp: string|null, waitBeforeNextMs: number }}
     */
    getInvitationDialog() {
      // 仅 INVITE 状态可获取邀请台词
      if (state !== STATES.INVITE) {
        throw new Error(`当前状态 ${state} 不允许获取邀请台词，必须在 INVITE 状态调用`);
      }
      const invitationDialog = step5Templates.getStep5Dialog(interestType, foxName);
      // 状态转换：INVITE → AWAIT_RESPONSE
      state = STATES.AWAIT_RESPONSE;
      return invitationDialog;
    },

    /**
     * 处理孩子的反应文本
     * 1. 调用 partner-response-classifier.classifyPartnerResponse 分类
     * 2. 调用 step5-templates.getStep5Dialog（传 childResponse）获取回应台词
     * 3. 根据分类结果转换状态：
     *    - accept → CONFIRMED，partnerAcceptance = true
     *    - refuse → DECLINED，partnerAcceptance = false
     *    - hesitate → RE_INVITE → 回到 AWAIT_RESPONSE，partnerAcceptance 保持 null
     * @param {string} responseText - 孩子的反应文本
     * @returns {{ mainLine: string, followUp: string|null, partnerAcceptance: boolean|null, classification: object }}
     */
    processChildResponse(responseText) {
      // INVITE 状态调用应抛出错误：必须先调用 getInvitationDialog
      if (state === STATES.INVITE) {
        throw new Error('必须先调用 getInvitationDialog 发出邀请，再处理孩子反应');
      }
      // CONFIRMED/DECLINED 状态调用应抛出错误：流程已完成
      if (state === STATES.CONFIRMED || state === STATES.DECLINED) {
        throw new Error('搭档确认流程已完成，不能再次处理孩子反应');
      }
      // 仅 AWAIT_RESPONSE 状态可处理孩子反应
      if (state !== STATES.AWAIT_RESPONSE) {
        throw new Error(`当前状态 ${state} 不允许处理孩子反应`);
      }

      // 1. 调用分类器对孩子反应进行分类
      const classification = partnerResponseClassifier.classifyPartnerResponse(responseText);

      // 2. 根据分类结果获取回应台词
      const responseDialog = step5Templates.getStep5Dialog(
        interestType,
        foxName,
        classification.type
      );

      // 3. 根据分类结果转换状态
      if (classification.type === 'accept') {
        // accept → CONFIRMED
        state = STATES.CONFIRMED;
        partnerAcceptance = true;
      } else if (classification.type === 'refuse') {
        // refuse → DECLINED
        state = STATES.DECLINED;
        partnerAcceptance = false;
      } else {
        // hesitate → RE_INVITE → 回到 AWAIT_RESPONSE（partnerAcceptance 保持 null）
        state = STATES.AWAIT_RESPONSE;
      }

      return {
        mainLine: responseDialog.mainLine,
        followUp: responseDialog.followUp,
        partnerAcceptance: responseDialog.partnerAcceptance,
        classification: {
          type: classification.type,
          confidence: classification.confidence,
          matchedKeyword: classification.matchedKeyword
        }
      };
    },

    /**
     * 获取搭档接受状态
     * @returns {boolean|null} null（未确定）| true（接受）| false（拒绝）
     */
    getPartnerAcceptance() {
      return partnerAcceptance;
    },

    /**
     * 判断流程是否完成
     * @returns {boolean} 流程处于 CONFIRMED 或 DECLINED 状态时返回 true
     */
    isComplete() {
      return state === STATES.CONFIRMED || state === STATES.DECLINED;
    },

    /**
     * 获取计时信息（2分钟预算）
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
     * 状态回到 INVITE，清空搭档接受状态，重置计时
     */
    reset() {
      state = STATES.INVITE;
      partnerAcceptance = null;
      startedAt = Date.now();
    }
  };
}

module.exports = {
  createPartnerOrchestrator,
  STATES
};
