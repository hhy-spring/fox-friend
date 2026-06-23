/**
 * 句式风格混用器 - Issue #8 每日拼音教学
 *
 * 参考PRD §4.5.3 句式混用：
 *   句式按 30/25/25/20 比例混用请求式/情报式/好奇式/挑战式
 *   （非严格约束，由 AI 动态调整）
 *
 * 4种句式风格：
 *   - request   (请求式 30%)：请孩子做某事，如「你能教我念这个字吗？」
 *   - intel     (情报式 25%)：分享信息，如「这个字念 a，嘴巴要张大」
 *   - curious   (好奇式 25%)：引发好奇，如「你猜这个字念什么？」
 *   - challenge (挑战式 20%)：挑战孩子，如「这次试试看能不能念对！」
 *
 * 职责：
 *   1. 按目标比例加权随机选择句式
 *   2. 避免同一句式连续出现 3 次及以上
 *   3. 根据孩子状态动态调整（low 状态回避 challenge；energetic 可增加 challenge）
 *   4. 记录历史选择并统计分布
 *   5. 生成对应风格的对话台词
 */

// 句式风格常量
const SENTENCE_STYLES = {
  REQUEST: 'request',
  INTEL: 'intel',
  CURIOUS: 'curious',
  CHALLENGE: 'challenge'
};

// 目标比例：请求式 30% / 情报式 25% / 好奇式 25% / 挑战式 20%
const TARGET_RATIO = {
  request: 0.3,
  intel: 0.25,
  curious: 0.25,
  challenge: 0.2
};

// 各风格对话台词模板（${vowel} 占位符替换为目标元音）
const STYLE_LINE_TEMPLATES = {
  request: '你能教我念 ${vowel} 这个字吗？',
  intel: '这个字念 ${vowel}，嘴巴要张大',
  curious: '你猜 ${vowel} 念什么？',
  challenge: '这次试试看能不能把 ${vowel} 念对！'
};

/**
 * 创建句式风格混用器
 * @param {object} [options] - 配置选项
 * @returns {object} 句式风格混用器实例
 */
function createSentenceStyleMixer(options = {}) {
  // 历史选择记录
  let history = [];

  // 各风格当前权重（基于目标比例）
  const baseWeights = {
    request: TARGET_RATIO.request,
    intel: TARGET_RATIO.intel,
    curious: TARGET_RATIO.curious,
    challenge: TARGET_RATIO.challenge
  };

  /**
   * 根据权重进行加权随机选择
   * @param {object} weights - 各风格权重
   * @returns {string} 选中的风格
   */
  function weightedRandom(weights) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [style, w] of entries) {
      r -= w;
      if (r <= 0) {
        return style;
      }
    }
    return entries[entries.length - 1][0];
  }

  return {
    /**
     * 获取目标比例
     * @returns {{ request: number, intel: number, curious: number, challenge: number }}
     */
    getTargetRatio() {
      return { ...TARGET_RATIO };
    },

    /**
     * 根据上下文选择句式风格
     * @param {object} [context] - 上下文 { vowel, round, childState, previousStyles }
     * @returns {string} 句式风格
     */
    selectStyle(context = {}) {
      const weights = { ...baseWeights };
      // 规避连续3次相同：若最近2次均为同一风格，则将该风格权重置0
      const len = history.length;
      if (len >= 2 && history[len - 1] === history[len - 2]) {
        weights[history[len - 1]] = 0;
      }
      // 孩子状态动态调整：low 状态回避 challenge 风格
      if (context.childState === 'low') {
        weights.challenge = 0;
      }
      const style = weightedRandom(weights);
      history.push(style);
      return style;
    },

    /**
     * 获取历史选择记录（按调用顺序）
     * @returns {string[]} 历史风格数组
     */
    getStyleHistory() {
      return [...history];
    },

    /**
     * 获取各风格的累计计数
     * @returns {{ request: number, intel: number, curious: number, challenge: number }}
     */
    getStyleDistribution() {
      const dist = { request: 0, intel: 0, curious: 0, challenge: 0 };
      history.forEach(style => {
        if (Object.prototype.hasOwnProperty.call(dist, style)) {
          dist[style] += 1;
        }
      });
      return dist;
    },

    /**
     * 根据风格与元音信息生成对话台词
     * @param {string} style - 句式风格
     * @param {object} vowelInfo - 元音信息 { vowel, ... }
     * @returns {string} 对话台词
     */
    generateLine(style, vowelInfo = {}) {
      const template = STYLE_LINE_TEMPLATES[style];
      if (!template) {
        return '';
      }
      const vowel = vowelInfo.vowel || '';
      return template.replace('${vowel}', vowel);
    },

    /**
     * 重置混用器状态（清空历史记录与分布统计）
     */
    reset() {
      history = [];
    }
  };
}

module.exports = {
  SENTENCE_STYLES,
  createSentenceStyleMixer
};
