/**
 * 教学密度调整器 - Issue #8 每日拼音教学
 *
 * 参考PRD §4.5.3 变化二/三 + Issue #8：
 *   根据孩子实时状态动态调整教学密度和句式。
 *   4种孩子状态对应4种策略：
 *     energetic → 教学密度增加，可多喂 1-2 个知识点
 *     low       → 先关心，再问是否换轻松的事，降低教学密度
 *     neutral   → 正常推进教学内容
 *     rebellious→ 连续3次不愿推进→触发借分对赌（转 Issue #9）
 */

// 密度级别常量
const DENSITY_LEVELS = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high'
};

/**
 * 创建教学密度调整器
 * @param {object} [options] - 配置选项
 * @returns {object} 教学密度调整器实例
 */
function createTeachingDensityAdjuster(options = {}) {
  // 触发借分对赌的连续不愿推进阈值
  const borrowTriggerThreshold = options.borrowTriggerThreshold || 3;

  // 各状态对应的策略配置
  const STRATEGIES = {
    energetic: {
      density: DENSITY_LEVELS.HIGH,
      knowledgePointCount: 3, // 基础 1 + 2
      careFirst: false,
      askToSwitch: false,
      shouldTriggerBorrow: false,
      dialoguePrefix: '',
      description: '精力旺盛：增加教学密度，可多喂 1-2 个知识点'
    },
    low: {
      density: DENSITY_LEVELS.LOW,
      knowledgePointCount: 1, // 基础 1 - 1（最小为 1）
      careFirst: true,
      askToSwitch: true,
      shouldTriggerBorrow: false,
      dialoguePrefix: '你看起来有点累，我们先休息一下好吗？',
      description: '情绪低落：先关心，再问是否换轻松的事，降低教学密度'
    },
    neutral: {
      density: DENSITY_LEVELS.NORMAL,
      knowledgePointCount: 2, // 基础 1 + 1
      careFirst: false,
      askToSwitch: false,
      shouldTriggerBorrow: false,
      dialoguePrefix: '',
      description: '正常推进教学内容'
    },
    rebellious: {
      density: DENSITY_LEVELS.LOW,
      knowledgePointCount: 1,
      careFirst: false,
      askToSwitch: false,
      shouldTriggerBorrow: false, // 默认 false，由 context.refusalCount 决定
      dialoguePrefix: '',
      description: '叛逆/无聊：连续3次不愿推进→触发借分对赌（转 Issue #9）'
    }
  };

  return {
    /**
     * 根据孩子状态获取完整策略
     * @param {string} childState - 孩子状态
     * @param {object} [context] - 上下文 { refusalCount }
     * @returns {object} 策略对象
     */
    getStrategy(childState, context = {}) {
      // 未知状态默认回退到 neutral 策略
      const strategy = STRATEGIES[childState] || STRATEGIES.neutral;
      const result = { ...strategy };
      // rebellious 状态：根据 refusalCount 决定是否触发借分对赌
      if (childState === 'rebellious') {
        const refusalCount = context.refusalCount || 0;
        result.shouldTriggerBorrow = refusalCount >= borrowTriggerThreshold;
      }
      return result;
    },

    /**
     * 仅获取密度级别
     * @param {string} childState - 孩子状态
     * @returns {string} 密度级别
     */
    getDensityLevel(childState) {
      const strategy = STRATEGIES[childState];
      return strategy ? strategy.density : null;
    },

    /**
     * 仅获取知识点数量
     * @param {string} childState - 孩子状态
     * @returns {number} 知识点数量
     */
    getKnowledgePointCount(childState) {
      const strategy = STRATEGIES[childState];
      return strategy ? strategy.knowledgePointCount : 0;
    },

    /**
     * 获取关心话术（仅 low 状态非空）
     * @param {string} childState - 孩子状态
     * @returns {string} 关心话术
     */
    getCareDialog(childState) {
      const strategy = STRATEGIES[childState];
      return strategy ? strategy.dialoguePrefix : '';
    }
  };
}

module.exports = {
  DENSITY_LEVELS,
  createTeachingDensityAdjuster
};
