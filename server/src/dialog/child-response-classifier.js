/**
 * 儿童反应分类器 - 费曼学习法首次触发（Issue #4）
 *
 * 参考技术架构文档§「费曼学习法」
 *
 * 职责：
 *   1. 在费曼学习法中，小狐狸请孩子教它认名字里的生字
 *   2. 将孩子的反应分类为三种：correct（念对了）/ unsure（不确定）/ refuse（明确拒绝）
 *   3. 返回分类结果（含匹配关键词与置信度），供对话引擎决定下一步策略
 *
 * 接口契约（供并行 Agent 使用）：
 *   classifyChildResponse(responseText, targetCharacter) → {
 *     type: 'correct' | 'unsure' | 'refuse',
 *     confidence: number,
 *     matchedKeyword: string | null
 *   }
 */

const { findMatchedKeyword } = require('./keyword-matcher');

// 反应类型常量
const RESPONSE_TYPES = {
  CORRECT: 'correct',
  UNSURE: 'unsure',
  REFUSE: 'refuse'
};

// correct 肯定词列表（按长度降序匹配，长词优先）
const CORRECT_KEYWORDS = [
  '念对了', '我会', '对', '是'
];

// unsure 不确定词列表
const UNSURE_KEYWORDS = [
  '不知道', '想不起来', '不确定', '不会', '不懂'
];

// refuse 拒绝词列表
const REFUSE_KEYWORDS = [
  '不想教', '别让我', '不愿意', '不要', '不想'
];

/**
 * 分类孩子的反应
 * @param {string} responseText - 孩子的文本反应
 * @param {string|null} targetCharacter - 目标生字（如 '龙'、'闪'），可为 null
 * @returns {{ type: 'correct'|'unsure'|'refuse', confidence: number, matchedKeyword: string|null }}
 */
function classifyChildResponse(responseText, targetCharacter) {
  const text = (responseText || '').trim();

  // correct：孩子说出目标生字（最高优先级）
  if (targetCharacter && text.includes(targetCharacter)) {
    return {
      type: RESPONSE_TYPES.CORRECT,
      confidence: 0.9,
      matchedKeyword: targetCharacter
    };
  }

  // correct：包含肯定词
  const correctMatch = findMatchedKeyword(text, CORRECT_KEYWORDS);
  if (correctMatch) {
    return {
      type: RESPONSE_TYPES.CORRECT,
      confidence: 0.85,
      matchedKeyword: correctMatch
    };
  }

  // refuse：包含拒绝词（明确拒绝优先于 unsure 识别）
  const refuseMatch = findMatchedKeyword(text, REFUSE_KEYWORDS);
  if (refuseMatch) {
    return {
      type: RESPONSE_TYPES.REFUSE,
      confidence: 0.9,
      matchedKeyword: refuseMatch
    };
  }

  // unsure：包含不确定词
  const unsureMatch = findMatchedKeyword(text, UNSURE_KEYWORDS);
  if (unsureMatch) {
    return {
      type: RESPONSE_TYPES.UNSURE,
      confidence: 0.8,
      matchedKeyword: unsureMatch
    };
  }

  // 默认回退：保守返回 unsure
  return {
    type: RESPONSE_TYPES.UNSURE,
    confidence: 0.5,
    matchedKeyword: null
  };
}

module.exports = {
  RESPONSE_TYPES,
  CORRECT_KEYWORDS,
  UNSURE_KEYWORDS,
  REFUSE_KEYWORDS,
  classifyChildResponse
};
