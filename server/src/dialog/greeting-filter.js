/**
 * 问候语过滤器 - 识别并过滤儿童常见问候语
 *
 * Issue #17: 名字处理器将问候语误识别为名字（P0 阻断性 Bug）
 *
 * 参考技术架构文档§三「对话引擎架构」
 * 参考技术架构文档§四「关键API」WS `/ws/voice/{child_id}`
 *
 * 多智能体系统设计：
 *   GreetingPatternAgent → GreetingFilterAgent → IntegrationAgent
 *   (问候语模式分析)      (过滤逻辑实现)        (集成验证)
 */

/**
 * 问候语模式库
 *
 * 多智能体协作产物：由 GreetingPatternAgent 分析儿童语音交互场景生成
 * 覆盖4-7岁儿童常见问候语，包括：
 *   - 基础问候：你好、嗨、哈喽
 *   - 时段问候：早上好、下午好、晚上好
 *   - 语气词：嗯、哦、啊、哎
 *   - 口语化问候：在吗、你好呀、你好啊
 */
const GREETING_PATTERNS = [
  // 基础问候
  '你好', '嗨', '哈喽', '哈罗', '嗨喽',
  // 时段问候
  '早上好', '下午好', '晚上好', '早安', '晚安',
  // 口语化问候
  '你好呀', '你好啊', '你好哦', '嗨呀', '嗨啊',
  '在吗', '在不在', '是你吗',
  // 单字语气词（儿童常见应答）
  '嗯', '哦', '啊', '哎', '噢', '唔',
  // 叠词问候
  '嗯嗯', '哦哦', '好好',
];

/**
 * 判断内容是否为问候语
 *
 * 由 GreetingFilterAgent 实现，基于 GreetingPatternAgent 提供的模式库
 * 采用精确匹配 + 包含匹配双重策略，避免误过滤含问候语的合法名字
 *
 * @param {string} content - 孩子说的内容
 * @returns {boolean} true 表示是问候语（不应记录为名字）
 */
function isGreeting(content) {
  if (!content || content.trim().length === 0) return false;

  const trimmed = content.trim();

  // 精确匹配（内容完全等于问候语）
  if (GREETING_PATTERNS.includes(trimmed)) {
    return true;
  }

  // 包含匹配（内容以问候语开头 + 问候语后跟标点或语气词）
  // 例如 "你好！" "嗨呀。" "嗯嗯嗯"
  const greetingPrefix = GREETING_PATTERNS.find(g => trimmed.startsWith(g));
  if (greetingPrefix) {
    const remainder = trimmed.slice(greetingPrefix.length);
    // 剩余部分为空、标点、语气词 → 判定为问候语
    if (remainder.length === 0 || /^[！。.!？?~\s]+$/.test(remainder)) {
      return true;
    }
    // 叠词情况（如"嗯嗯嗯"）
    if (remainder === greetingPrefix || GREETING_PATTERNS.includes(remainder)) {
      return true;
    }
  }

  return false;
}

/**
 * 获取问候语模式列表（供多智能体系统查询使用）
 * @returns {string[]}
 */
function getGreetingPatterns() {
  return [...GREETING_PATTERNS];
}

/**
 * 问候语前缀列表（Issue #23: 以这些词开头的输入不应被识别为名字）
 * 用于检测 "你好小狐狸" 等问候语+内容的组合
 */
const GREETING_PREFIXES = [
  '你好', '嗨', '哈喽', '哈罗', '早上好', '下午好', '晚上好', '早安', '晚安'
];

/**
 * 检测输入是否以问候语前缀开头
 * Issue #23: "你好小狐狸" 等问候语+内容的组合不应被识别为名字
 * @param {string} content - 输入内容
 * @returns {boolean}
 */
function hasGreetingPrefix(content) {
  if (!content || content.trim().length === 0) return false;
  const trimmed = content.trim();
  return GREETING_PREFIXES.some(g => trimmed.startsWith(g));
}

module.exports = { isGreeting, getGreetingPatterns, GREETING_PATTERNS, hasGreetingPrefix, GREETING_PREFIXES };
