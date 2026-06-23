/**
 * 儿童状态分类器 - Issue #8 每日拼音教学
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

const { findMatchedKeyword } = require('./keyword-matcher');

// 儿童状态常量
const CHILD_STATES = {
  ENERGETIC: 'energetic',
  LOW: 'low',
  NEUTRAL: 'neutral',
  REBELLIOUS: 'rebellious'
};

// energetic 精力旺盛关键词
const ENERGETIC_KEYWORDS = [
  '我想学', '我来教', '好开心', '开心', '我想玩', '我来', '好玩'
];

// low 情绪低落/累了/畏难关键词
const LOW_KEYWORDS = [
  '累了', '困了', '不想玩', '太难', '不会', '不懂', '难过', '不开心'
];

// rebellious 叛逆/无聊关键词（递增计数器）
const REBELLIOUS_KEYWORDS = [
  '不想学', '我不要学', '无聊', '我想做别的', '不要学', '我不要'
];

/**
 * 分类孩子的实时状态
 * @param {string} responseText - 孩子的文本反应
 * @param {object} [context] - 上下文（可选）
 * @returns {{ state: string, confidence: number, matchedKeyword: string|null }}
 */
function classifyChildState(responseText, context) {
  const text = (responseText || '').trim();

  // rebellious 优先识别（叛逆/无聊 → 递增计数器）
  const rebelliousMatch = findMatchedKeyword(text, REBELLIOUS_KEYWORDS);
  if (rebelliousMatch) {
    return {
      state: CHILD_STATES.REBELLIOUS,
      confidence: 0.9,
      matchedKeyword: rebelliousMatch
    };
  }

  // low 识别（累了/畏难 → 不递增计数器）
  const lowMatch = findMatchedKeyword(text, LOW_KEYWORDS);
  if (lowMatch) {
    return {
      state: CHILD_STATES.LOW,
      confidence: 0.85,
      matchedKeyword: lowMatch
    };
  }

  // energetic 识别（精力旺盛）
  const energeticMatch = findMatchedKeyword(text, ENERGETIC_KEYWORDS);
  if (energeticMatch) {
    return {
      state: CHILD_STATES.ENERGETIC,
      confidence: 0.85,
      matchedKeyword: energeticMatch
    };
  }

  // 默认 neutral
  return {
    state: CHILD_STATES.NEUTRAL,
    confidence: 0.6,
    matchedKeyword: null
  };
}

/**
 * 创建儿童状态追踪器（追踪连续不愿推进次数）
 * @param {object} [options]
 * @param {number} [options.initialRefusalCount=0] - 初始不愿推进计数
 * @param {number} [options.borrowTriggerThreshold=3] - 触发借分对赌的阈值
 * @returns {object} 状态追踪器实例
 */
function createChildStateTracker(options = {}) {
  let refusalCount = options.initialRefusalCount || 0;
  const borrowTriggerThreshold = options.borrowTriggerThreshold || 3;

  return {
    /**
     * 记录一次状态分类结果，更新计数器
     * @param {{ state: string }} classification - 分类结果
     * @returns {{ refusalCount: number, shouldTriggerBorrow: boolean }}
     */
    recordClassification(classification) {
      if (classification.state === CHILD_STATES.REBELLIOUS) {
        refusalCount += 1;
      } else if (classification.state === CHILD_STATES.ENERGETIC) {
        // 孩子愿意推进时重置计数器
        refusalCount = 0;
      }
      return {
        refusalCount,
        shouldTriggerBorrow: refusalCount >= borrowTriggerThreshold
      };
    },

    getRefusalCount() {
      return refusalCount;
    },

    resetRefusalCount() {
      refusalCount = 0;
    },

    shouldTriggerBorrow() {
      return refusalCount >= borrowTriggerThreshold;
    }
  };
}

module.exports = {
  CHILD_STATES,
  ENERGETIC_KEYWORDS,
  LOW_KEYWORDS,
  REBELLIOUS_KEYWORDS,
  classifyChildState,
  createChildStateTracker
};
