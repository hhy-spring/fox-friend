/**
 * 命名仪式 - 崇拜式回应与画像采集
 *
 * 参考技术架构文档§三「对话引擎架构」：
 *   Interest Brancher（名字→兴趣分型）→ 命名仪式子状态机
 *
 * 参考技术架构文档§八「兴趣分型映射」：
 *   根据兴趣类型返回不同的崇拜式回应
 *
 * PRD §4.1 步骤3 命名仪式：
 *   - 孩子给狐狸起名后，狐狸崇拜式回应
 *   - 然后通过关系对话嵌入4个画像问题
 *   - 子状态：WORSHIP → ASK_NICKNAME → ASK_AGE → ASK_INTERESTS → ASK_SKILLS → COMPLETE
 */

// 命名仪式子状态
const CEREMONY_SUB_STATES = {
  WORSHIP: 'WORSHIP',
  ASK_NICKNAME: 'ASK_NICKNAME',
  ASK_AGE: 'ASK_AGE',
  ASK_INTERESTS: 'ASK_INTERESTS',
  ASK_SKILLS: 'ASK_SKILLS',
  COMPLETE: 'COMPLETE'
};

// 跳过检测模式 - 孩子不想回答时的常见回复
const SKIP_PATTERNS = [
  '不知道', '不晓得', '不想说', '随便', '不想', '不要', '没有', '嗯', '额'
];

// 兴趣类型对应的崇拜式回应模板
// 参考技术架构文档§八「兴趣分型映射」
const WORSHIP_TEMPLATES = {
  dinosaur: {
    mainLine: (name) => `${name}！！太酷了吧！我最喜欢恐龙了！从今天起我就叫${name}啦！嗷呜——！`,
    followUp: null,
    waitBeforeNextMs: 1500
  },
  princess: {
    mainLine: (name) => `${name}！！哇——你会魔法吗？那从今天起我就是${name}了！叮——我有魔法了！`,
    followUp: null,
    waitBeforeNextMs: 1500
  },
  speed: {
    mainLine: (name) => `${name}！！嗖——！太快了太快了！从今天起我就叫${name}了！谁也追不上我！呜——`,
    followUp: null,
    waitBeforeNextMs: 1500
  },
  generic: {
    mainLine: (name) => `${name}！好酷的名字！从现在起我就叫${name}了！`,
    followUp: null,
    waitBeforeNextMs: 1500
  }
};

// 画像问题模板
const PROFILE_QUESTIONS = {
  [CEREMONY_SUB_STATES.ASK_NICKNAME]: {
    mainLine: '你给我起了这么厉害的名字，你一定也很厉害！你叫什么？',
    followUp: null,
    field: 'nickname',
    waitBeforeNextMs: 0
  },
  [CEREMONY_SUB_STATES.ASK_AGE]: {
    mainLine: '你几岁了呀？我想知道我的搭档有多厉害！',
    followUp: null,
    field: 'age',
    waitBeforeNextMs: 0
  },
  [CEREMONY_SUB_STATES.ASK_INTERESTS]: {
    mainLine: '你喜欢做什么？我也想学！',
    followUp: null,
    field: 'interests',
    waitBeforeNextMs: 0
  },
  [CEREMONY_SUB_STATES.ASK_SKILLS]: {
    mainLine: '你最擅长什么？',
    followUp: null,
    field: 'selfClaimedSkills',
    waitBeforeNextMs: 0
  }
};

// 子状态转换顺序
const SUB_STATE_ORDER = [
  CEREMONY_SUB_STATES.WORSHIP,
  CEREMONY_SUB_STATES.ASK_NICKNAME,
  CEREMONY_SUB_STATES.ASK_AGE,
  CEREMONY_SUB_STATES.ASK_INTERESTS,
  CEREMONY_SUB_STATES.ASK_SKILLS,
  CEREMONY_SUB_STATES.COMPLETE
];

/**
 * 判断孩子是否在跳过问题
 * @param {string} content - 孩子说的内容
 * @returns {boolean}
 */
function isSkipAnswer(content) {
  if (!content || content.trim().length === 0) return true;
  const trimmed = content.trim();
  return SKIP_PATTERNS.some(pattern => trimmed === pattern || trimmed.includes(pattern));
}

/**
 * 从孩子回答中提取年龄
 * @param {string} content - 孩子说的内容
 * @returns {number|null}
 */
function extractAge(content) {
  if (!content || content.trim().length === 0) return null;
  const trimmed = content.trim();

  // 匹配"X岁"模式
  const ageMatch = trimmed.match(/(\d+)\s*岁/);
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10);
    return (age >= 2 && age <= 15) ? age : null;
  }

  // 匹配纯数字（4-7岁儿童合理范围）
  const numMatch = trimmed.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    return (num >= 2 && num <= 15) ? num : null;
  }

  // 匹配中文数字
  const chineseNumMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
  const chineseMatch = trimmed.match(/([一二三四五六七八九十]+)\s*岁/);
  if (chineseMatch) {
    const chineseNum = chineseMatch[1];
    if (chineseNumMap[chineseNum] !== undefined) {
      return chineseNumMap[chineseNum];
    }
  }

  return null;
}

/**
 * 从孩子回答中提取昵称
 * 剥离"我叫"、"我是"等常见前缀
 * @param {string} content - 孩子说的内容
 * @returns {string|null}
 */
function extractNickname(content) {
  if (!content || content.trim().length === 0) return null;
  const trimmed = content.trim();

  // 如果是跳过回答，返回null
  if (isSkipAnswer(trimmed)) return null;

  // 剥离"我叫X"、"我是X"前缀
  const prefixMatch = trimmed.match(/^我叫(.+)$/);
  if (prefixMatch) {
    return prefixMatch[1].trim();
  }
  const amPrefixMatch = trimmed.match(/^我是(.+)$/);
  if (amPrefixMatch) {
    return amPrefixMatch[1].trim();
  }

  return trimmed;
}

/**
 * 从孩子回答中提取兴趣
 * @param {string} content - 孩子说的内容
 * @returns {string[]|null}
 */
function extractInterests(content) {
  if (!content || content.trim().length === 0) return null;
  const trimmed = content.trim();

  // 如果是跳过回答，返回null
  if (isSkipAnswer(trimmed)) return null;

  // 常见分隔符拆分
  const parts = trimmed
    .replace(/[，。！？、；和与还有还有以及]/g, '，')
    .split('，')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return parts.length > 0 ? parts : null;
}

/**
 * 创建命名仪式实例
 * @param {string} foxName - 狐狸的名字（来自Issue #1）
 * @param {string} nameSource - 名字来源（child_choice | fox_suggestion）
 * @param {string} interestType - 兴趣类型，默认 generic
 * @returns {object} 命名仪式实例
 */
function createNamingCeremony(foxName, nameSource, interestType = 'generic') {
  let subState = CEREMONY_SUB_STATES.WORSHIP;
  let proactiveSpeechCount = 0;

  // 画像数据
  const profile = {
    foxName,
    foxNameSource: nameSource,
    nickname: null,
    age: null,
    interests: null,
    selfClaimedSkills: null
  };

  return {
    // 获取当前子状态
    getSubState() {
      return subState;
    },

    // 获取崇拜式回应
    getWorshipResponse() {
      if (subState !== CEREMONY_SUB_STATES.WORSHIP) {
        return null;
      }
      const template = WORSHIP_TEMPLATES[interestType] || WORSHIP_TEMPLATES.generic;
      return {
        mainLine: template.mainLine(foxName),
        followUp: template.followUp,
        waitBeforeNextMs: template.waitBeforeNextMs
      };
    },

    // 开始画像采集（崇拜回应已返回，推进到 ASK_NICKNAME）
    // Issue #19: 替代 processAnswer('') 的语义化方法
    startCollection() {
      if (subState === CEREMONY_SUB_STATES.WORSHIP) {
        subState = CEREMONY_SUB_STATES.ASK_NICKNAME;
      }
      return subState;
    },

    // 获取当前画像问题
    getCurrentQuestion() {
      const question = PROFILE_QUESTIONS[subState];
      if (!question) return null;
      return {
        mainLine: question.mainLine,
        followUp: question.followUp,
        field: question.field,
        waitBeforeNextMs: question.waitBeforeNextMs
      };
    },

    // 处理孩子的回答
    processAnswer(content) {
      const currentIdx = SUB_STATE_ORDER.indexOf(subState);
      if (currentIdx === -1 || currentIdx >= SUB_STATE_ORDER.length - 1) {
        return { field: null, value: null, skipped: false, nextSubState: subState, isComplete: subState === CEREMONY_SUB_STATES.COMPLETE };
      }

      const currentField = PROFILE_QUESTIONS[subState]?.field;
      const skipped = isSkipAnswer(content);
      let value = null;

      if (!skipped && currentField) {
        // 根据字段类型提取值
        if (currentField === 'age') {
          value = extractAge(content);
        } else if (currentField === 'interests') {
          value = extractInterests(content);
        } else if (currentField === 'nickname') {
          value = extractNickname(content);
        } else if (currentField === 'selfClaimedSkills') {
          value = extractInterests(content);
        } else {
          value = content.trim();
        }
      }

      // 存储到画像
      if (currentField) {
        profile[currentField] = skipped ? null : value;
      }

      // 转换到下一个子状态
      const nextIdx = currentIdx + 1;
      const nextSubState = SUB_STATE_ORDER[nextIdx];
      subState = nextSubState;

      return {
        field: currentField,
        value: skipped ? null : value,
        skipped,
        nextSubState,
        isComplete: nextSubState === CEREMONY_SUB_STATES.COMPLETE
      };
    },

    // 获取画像数据
    getProfile() {
      return { ...profile };
    },

    // 获取主动发言计数
    getProactiveSpeechCount() {
      return proactiveSpeechCount;
    },

    // 增加主动发言计数
    incrementProactiveSpeech() {
      proactiveSpeechCount++;
    }
  };
}

module.exports = {
  CEREMONY_SUB_STATES,
  SKIP_PATTERNS,
  isSkipAnswer,
  extractAge,
  extractNickname,
  extractInterests,
  createNamingCeremony
};
