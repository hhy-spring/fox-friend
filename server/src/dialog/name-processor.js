/**
 * 名字处理器 - 孩子直接说名字的处理逻辑
 *
 * 参考技术架构文档§三「对话引擎架构」Interest Brancher（名字→兴趣分型）
 * 参考技术架构文档§八「兴趣分型映射」
 *
 * PRD §4.1 步骤2：
 *   - 如果孩子直接说出名字 → 跳过暗示，用孩子的名字
 *   - 名字来源：child_choice | fox_suggestion
 */

const { NAME_HINTS } = require('./name-hints');
const { isGreeting } = require('./greeting-filter');

// 排除词（不是名字的常见回复）
const NON_NAME_PATTERNS = [
  '不知道', '不晓得', '随便', '都行', '你定', '你想', '嗯嗯',
  '不要', '不想', '没有', '什么', '为什么', '怎么'
];

/**
 * 判断孩子是否提供了名字
 * @param {string} content - 孩子说的内容
 * @returns {boolean}
 */
function isNameProvided(content) {
  if (!content || content.trim().length === 0) return false;

  const trimmed = content.trim();

  // 排除明确不是名字的回复
  if (NON_NAME_PATTERNS.some(pattern => trimmed.includes(pattern))) {
    return false;
  }

  // Issue #17: 排除问候语（你好、嗨、哈喽等不应被识别为名字）
  if (isGreeting(trimmed)) {
    return false;
  }

  // 包含"叫你"或"给你起"等命名意图 → 是名字
  if (/叫你|给你起|起名|就叫/.test(trimmed)) {
    return true;
  }

  // 2-4个字的短词，很可能是名字
  if (trimmed.length >= 1 && trimmed.length <= 6) {
    return true;
  }

  return false;
}

/**
 * 从孩子输入中提取名字
 * @param {string} content - 孩子说的内容
 * @returns {{ name: string, source: string } | null}
 */
function extractName(content) {
  if (!content || content.trim().length === 0) return null;

  const trimmed = content.trim();

  // Issue #17: 问候语不提取为名字
  if (isGreeting(trimmed)) {
    return null;
  }

  // 尝试从"叫你XX"模式中提取
  const callMatch = trimmed.match(/叫你(.+)/);
  if (callMatch) {
    return { name: callMatch[1].trim(), source: 'child_choice' };
  }

  // 尝试从"给你起名XX"模式中提取
  const nameMatch = trimmed.match(/(?:给你起名?|起名|就叫)(.+)/);
  if (nameMatch) {
    return { name: nameMatch[1].trim(), source: 'child_choice' };
  }

  // 检查是否通过暗示选择（如"带龙的"）
  const hintMatch = trimmed.match(/带['"'']?(.+?)['"'']?的/);
  if (hintMatch) {
    const char = hintMatch[1];
    // 从暗示池中找到对应的名字建议
    const hint = NAME_HINTS.find(h => h.character === char);
    if (hint) {
      // 生成基于该字的名字
      return { name: `小${char}`, source: 'fox_suggestion' };
    }
    return { name: `小${char}`, source: 'fox_suggestion' };
  }

  // 短词直接作为名字
  if (trimmed.length <= 6 && !NON_NAME_PATTERNS.some(p => trimmed.includes(p))) {
    return { name: trimmed, source: 'child_choice' };
  }

  return null;
}

/**
 * 处理孩子在 HELP_REQUEST 步骤的输入
 * @param {object} params
 * @param {string} params.childContent - 孩子说的内容
 * @param {string} params.currentStep - 当前步骤
 * @param {object} params.fsm - FSM 实例
 * @returns {object} 处理结果
 */
function processChildInput({ childContent, currentStep, fsm }) {
  const isName = isNameProvided(childContent);
  const extracted = isName ? extractName(childContent) : null;

  // 不是名字 → 显示暗示
  if (!isName || !extracted) {
    return {
      nameRecorded: false,
      skipHints: false,
      showHints: true,
      nextState: currentStep
    };
  }

  // 名字已提供 → 记录名字，跳过暗示
  return {
    nameRecorded: true,
    foxName: extracted.name,
    nameSource: extracted.source,
    skipHints: extracted.source === 'child_choice',
    showHints: false,
    nextState: 'NAMING_CEREMONY'
  };
}

module.exports = { isNameProvided, extractName, processChildInput };
