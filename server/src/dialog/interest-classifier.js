/**
 * 兴趣分型引擎 - 台词分型核心模块（Issue #3）
 *
 * 参考技术架构文档§三「对话引擎架构」Interest Brancher（名字→兴趣分型）
 * 参考技术架构文档§八「兴趣分型映射」
 *
 * 职责：
 *   1. 从孩子起的狐狸名字中提取兴趣关键词
 *   2. 据此分类为 4 种兴趣分型：dinosaur / princess / speed / generic
 *   3. 返回分类结果（含匹配关键词），供步骤3-5台词分型使用
 *   4. 分类结果写入 child_profile.interests_derived_from_fox_name
 *
 * 接口契约（供并行 Agent 使用）：
 *   classifyInterest(foxName) → {
 *     type: string,           // 'dinosaur' | 'princess' | 'speed' | 'generic'
 *     keywords: string[],     // 匹配到的兴趣关键词（如 ['恐龙']）
 *     matchedTerms: string[], // 名字中实际命中的子串（如 ['恐龙蛋'] 中的 '恐龙'）
 *     foxName: string,        // 原始名字
 *     isClassified: boolean   // 是否成功分类（generic 时为 false）
 *   }
 */

// 兴趣分型类型常量
const INTEREST_TYPES = {
  DINOSAUR: 'dinosaur',
  PRINCESS: 'princess',
  SPEED: 'speed',
  GENERIC: 'generic'
};

// 兴趣关键词映射表
// 参考技术架构文档§八「兴趣分型映射」
const INTEREST_KEYWORD_MAP = {
  [INTEREST_TYPES.DINOSAUR]: [
    '恐龙', '霸王龙', '三角龙', '翼龙', '剑龙', '雷龙', '甲龙',
    '龙', '恐龙蛋', '化石'
  ],
  [INTEREST_TYPES.PRINCESS]: [
    '艾莎', '安娜', '公主', '魔法', '城堡', '仙女', '精灵',
    '莎', '宝石', '皇冠', '水晶'
  ],
  [INTEREST_TYPES.SPEED]: [
    '闪电', '赛车', '麦昆', '飞机', '火箭', '赛车手',
    '闪', '飞', '快', '涡轮', '引擎'
  ]
};

/**
 * 从狐狸名字中提取兴趣关键词并分类
 * @param {string} foxName - 孩子起的狐狸名字
 * @returns {{ type: string, keywords: string[], matchedTerms: string[], foxName: string, isClassified: boolean }}
 */
function classifyInterest(foxName) {
  const name = (foxName || '').trim();
  const result = {
    type: INTEREST_TYPES.GENERIC,
    keywords: [],
    matchedTerms: [],
    foxName: name,
    isClassified: false
  };

  if (!name) {
    return result;
  }

  // 按优先级顺序检查各兴趣分型
  // 优先级：dinosaur > princess > speed（长关键词优先匹配）
  const typeOrder = [
    INTEREST_TYPES.DINOSAUR,
    INTEREST_TYPES.PRINCESS,
    INTEREST_TYPES.SPEED
  ];

  for (const type of typeOrder) {
    const keywords = INTEREST_KEYWORD_MAP[type];
    // 按长度降序匹配，优先匹配长关键词（如"霸王龙"优先于"龙"）
    const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);

    for (const keyword of sortedKeywords) {
      if (name.includes(keyword)) {
        result.type = type;
        result.keywords.push(keyword);
        result.matchedTerms.push(keyword);
        result.isClassified = true;
      }
    }

    // 找到匹配就停止（不跨类型混合）
    if (result.isClassified) {
      break;
    }
  }

  return result;
}

/**
 * 获取兴趣分型的中文标签（用于搭档确认台词等）
 * @param {string} interestType - 兴趣类型
 * @returns {string}
 */
function getInterestLabel(interestType) {
  const labels = {
    [INTEREST_TYPES.DINOSAUR]: '恐龙',
    [INTEREST_TYPES.PRINCESS]: '魔法',
    [INTEREST_TYPES.SPEED]: '赛车',
    [INTEREST_TYPES.GENERIC]: '小伙伴'
  };
  return labels[interestType] || labels[INTEREST_TYPES.GENERIC];
}

/**
 * 获取兴趣分型对应的语气词/动作音效
 * 参考PRD §4.5.2 命名仪式 - 兴趣分支崇拜回应
 * @param {string} interestType - 兴趣类型
 * @returns {string}
 */
function getInterestSound(interestType) {
  const sounds = {
    [INTEREST_TYPES.DINOSAUR]: '嗷呜——',
    [INTEREST_TYPES.PRINCESS]: '叮——',
    [INTEREST_TYPES.SPEED]: '嗖——',
    [INTEREST_TYPES.GENERIC]: ''
  };
  return sounds[interestType] || '';
}

module.exports = {
  INTEREST_TYPES,
  INTEREST_KEYWORD_MAP,
  classifyInterest,
  getInterestLabel,
  getInterestSound
};
