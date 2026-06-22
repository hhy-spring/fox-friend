/**
 * 关键词匹配工具 - 共享模块
 *
 * 从 child-response-classifier.js 和 partner-response-classifier.js 中提取的公共逻辑
 * 消除重复代码，提升内聚性与可维护性
 *
 * 接口契约：
 *   findMatchedKeyword(text, keywords) → string | null
 *   findConflictKeyword(text, shortKeyword, keywords) → string | null
 */

/**
 * 在文本中查找首个命中的关键词（按长度降序优先，长词优先匹配）
 * @param {string} text - 待检测文本
 * @param {string[]} keywords - 关键词列表
 * @returns {string|null} 首个命中的关键词，未命中返回 null
 */
function findMatchedKeyword(text, keywords) {
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  for (const kw of sorted) {
    if (text.includes(kw)) {
      return kw;
    }
  }
  return null;
}

/**
 * 在文本中查找包含指定短词的长词关键词
 * 解决关键词冲突（如 "不愿意" 包含 "愿意"、"让我想想" 包含 "我想"）
 * 长词优先：当长词包含短词且同时命中时，返回长词
 * @param {string} text - 待检测文本
 * @param {string} shortKeyword - 已命中的短关键词
 * @param {string[]} keywords - 待检测的长词关键词列表
 * @returns {string|null} 命中的长词，未命中返回 null
 */
function findConflictKeyword(text, shortKeyword, keywords) {
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  for (const kw of sorted) {
    if (kw.includes(shortKeyword) && text.includes(kw)) {
      return kw;
    }
  }
  return null;
}

module.exports = {
  findMatchedKeyword,
  findConflictKeyword
};
