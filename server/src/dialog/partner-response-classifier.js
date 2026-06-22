/**
 * 搭档反应分类器 - Issue #5 搭档确认流程
 *
 * 参考技术架构文档§「搭档确认」
 * 参考PRD §4.1 步骤5 搭档确认
 *
 * 职责：
 *   1. 在搭档确认流程中，小狐狸正式邀请孩子做搭档
 *   2. 将孩子的反应分类为三种：accept（愿意）/ hesitate（犹豫）/ refuse（拒绝）
 *   3. 返回分类结果（含匹配关键词与置信度），供编排器决定下一步策略
 *
 * 接口契约（供并行 Agent 使用）：
 *   classifyPartnerResponse(responseText) → {
 *     type: 'accept' | 'hesitate' | 'refuse',
 *     confidence: number,
 *     matchedKeyword: string | null
 *   }
 */

const { findMatchedKeyword, findConflictKeyword } = require('./keyword-matcher');

// 反应类型常量
const RESPONSE_TYPES = {
  ACCEPT: 'accept',
  HESITATE: 'hesitate',
  REFUSE: 'refuse'
};

// accept 肯定词列表（按长度降序匹配，长词优先）
const ACCEPT_KEYWORDS = [
  '愿意', '好', '可以', '没问题', '我想', '当你的搭档', '好啊'
];

// hesitate 犹豫词列表
const HESITATE_KEYWORDS = [
  '嗯', '让我想想', '不确定', '再想想', '可能', '也许'
];

// refuse 拒绝词列表
const REFUSE_KEYWORDS = [
  '不要', '不愿意', '不想', '别', '算了'
];

/**
 * 分类孩子对搭档邀请的反应
 * 优先级：accept > refuse > hesitate（与 child-response-classifier 模式一致，refuse 优先于 hesitate）
 * 冲突处理：当 accept 短词被 refuse/hesitate 长词包含且同时命中时，采用长词类型
 * @param {string} responseText - 孩子的文本反应
 * @returns {{ type: 'accept'|'hesitate'|'refuse', confidence: number, matchedKeyword: string|null }}
 */
function classifyPartnerResponse(responseText) {
  const text = (responseText || '').trim();

  // accept：包含肯定词（最高优先级）
  const acceptMatch = findMatchedKeyword(text, ACCEPT_KEYWORDS);
  if (acceptMatch) {
    // 检查是否有 refuse 长词包含该 accept 关键词且同时命中（如 "不愿意" 包含 "愿意"）
    const refuseConflict = findConflictKeyword(text, acceptMatch, REFUSE_KEYWORDS);
    if (refuseConflict) {
      return {
        type: RESPONSE_TYPES.REFUSE,
        confidence: 0.9,
        matchedKeyword: refuseConflict
      };
    }
    // 检查是否有 hesitate 长词包含该 accept 关键词且同时命中（如 "让我想想" 包含 "我想"）
    const hesitateConflict = findConflictKeyword(text, acceptMatch, HESITATE_KEYWORDS);
    if (hesitateConflict) {
      return {
        type: RESPONSE_TYPES.HESITATE,
        confidence: 0.8,
        matchedKeyword: hesitateConflict
      };
    }
    return {
      type: RESPONSE_TYPES.ACCEPT,
      confidence: 0.85,
      matchedKeyword: acceptMatch
    };
  }

  // refuse：包含拒绝词（明确拒绝优先于 hesitate 识别）
  const refuseMatch = findMatchedKeyword(text, REFUSE_KEYWORDS);
  if (refuseMatch) {
    return {
      type: RESPONSE_TYPES.REFUSE,
      confidence: 0.9,
      matchedKeyword: refuseMatch
    };
  }

  // hesitate：包含犹豫词
  const hesitateMatch = findMatchedKeyword(text, HESITATE_KEYWORDS);
  if (hesitateMatch) {
    return {
      type: RESPONSE_TYPES.HESITATE,
      confidence: 0.8,
      matchedKeyword: hesitateMatch
    };
  }

  // 默认回退：保守返回 hesitate
  return {
    type: RESPONSE_TYPES.HESITATE,
    confidence: 0.5,
    matchedKeyword: null
  };
}

module.exports = {
  RESPONSE_TYPES,
  ACCEPT_KEYWORDS,
  HESITATE_KEYWORDS,
  REFUSE_KEYWORDS,
  classifyPartnerResponse
};
