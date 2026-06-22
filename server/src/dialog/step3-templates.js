/**
 * 步骤3 台词分型引擎 - 命名仪式 + 画像采集（Issue #3 Step 3 Templates）
 *
 * 参考技术架构文档§三「对话引擎架构」：
 *   Interest Brancher（名字→兴趣分型）→ 命名仪式子状态机
 *
 * 参考技术架构文档§八「兴趣分型映射」：
 *   根据兴趣类型返回不同的崇拜式回应与画像采集追问
 *
 * PRD §4.1 步骤3 命名仪式：
 *   - 孩子给狐狸起名后，狐狸崇拜式回应（含兴趣类型对应的语气词/动作音效）
 *   - 然后通过关系对话嵌入4个画像问题（昵称/年龄/兴趣/技能）
 *   - 兴趣关键词自然嵌入到追问中
 *
 * 子状态：WORSHIP → ASK_NICKNAME → ASK_AGE → ASK_INTERESTS → ASK_SKILLS → COMPLETE
 */

const {
  INTEREST_TYPES
} = require('./interest-classifier');

// 命名仪式子状态
const STEP3_SUB_STATES = {
  WORSHIP: 'WORSHIP',
  ASK_NICKNAME: 'ASK_NICKNAME',
  ASK_AGE: 'ASK_AGE',
  ASK_INTERESTS: 'ASK_INTERESTS',
  ASK_SKILLS: 'ASK_SKILLS',
  COMPLETE: 'COMPLETE'
};

/**
 * 崇拜式回应模板（按兴趣类型分型）
 * 参考技术架构文档§八「兴趣分型映射」
 * 每个模板为函数，接收 foxName 返回 mainLine
 */
const WORSHIP_TEMPLATES = {
  [INTEREST_TYPES.DINOSAUR]: {
    mainLine: (foxName) =>
      `${foxName}！！太酷了吧！我最喜欢恐龙了！从今天起我就叫${foxName}啦！嗷呜——！`,
    followUp: null,
    waitBeforeNextMs: 1500
  },
  [INTEREST_TYPES.PRINCESS]: {
    mainLine: (foxName) =>
      `${foxName}！！哇——你会魔法吗？那从今天起我就是${foxName}了！叮——我有魔法了！`,
    followUp: null,
    waitBeforeNextMs: 1500
  },
  [INTEREST_TYPES.SPEED]: {
    mainLine: (foxName) =>
      `${foxName}！！嗖——！太快了太快了！从今天起我就叫${foxName}了！谁也追不上我！呜——`,
    followUp: null,
    waitBeforeNextMs: 1500
  },
  [INTEREST_TYPES.GENERIC]: {
    mainLine: (foxName) =>
      `${foxName}！好酷的名字！从现在起我就叫${foxName}了！`,
    followUp: null,
    waitBeforeNextMs: 1500
  }
};

/**
 * 获取步骤3崇拜式回应
 * @param {string} interestType - 兴趣类型（dinosaur/princess/speed/generic）
 * @param {string} foxName - 狐狸的名字
 * @returns {{ mainLine: string, followUp: string|null, waitBeforeNextMs: number }}
 */
function getStep3WorshipDialog(interestType, foxName) {
  const template = WORSHIP_TEMPLATES[interestType] || WORSHIP_TEMPLATES[INTEREST_TYPES.GENERIC];
  return {
    mainLine: template.mainLine(foxName),
    followUp: template.followUp,
    waitBeforeNextMs: template.waitBeforeNextMs
  };
}

/**
 * 画像采集追问模板（按兴趣类型分型）
 * 参考PRD §4.1 步骤3 命名仪式 - 4个画像问题
 * 兴趣关键词自然嵌入到 interests 追问中
 *
 * 结构：每个兴趣类型包含 nickname/age/interests/skills 四个问题
 * 每个问题为 { mainLine, followUp, field, waitBeforeNextMs }
 */
const PROFILE_QUESTION_TEMPLATES = {
  [INTEREST_TYPES.DINOSAUR]: {
    nickname: {
      mainLine: '你给我起了这么厉害的名字，你一定也很厉害！你叫什么？',
      followUp: null,
      field: 'nickname',
      waitBeforeNextMs: 0
    },
    age: {
      mainLine: '你几岁了呀？我想知道我的搭档有多厉害！',
      followUp: null,
      field: 'age',
      waitBeforeNextMs: 0
    },
    interests: {
      mainLine: '你还喜欢什么恐龙？我也想认识它们！',
      followUp: null,
      field: 'interests',
      waitBeforeNextMs: 0
    },
    skills: {
      mainLine: '你最擅长什么？',
      followUp: null,
      field: 'selfClaimedSkills',
      waitBeforeNextMs: 0
    }
  },
  [INTEREST_TYPES.PRINCESS]: {
    nickname: {
      mainLine: '你给我起了这么厉害的名字，你一定也很厉害！你叫什么？',
      followUp: null,
      field: 'nickname',
      waitBeforeNextMs: 0
    },
    age: {
      mainLine: '你几岁了呀？我想知道我的搭档有多厉害！',
      followUp: null,
      field: 'age',
      waitBeforeNextMs: 0
    },
    interests: {
      mainLine: '你还喜欢什么公主？我也想和她们做朋友！',
      followUp: null,
      field: 'interests',
      waitBeforeNextMs: 0
    },
    skills: {
      mainLine: '你最擅长什么？',
      followUp: null,
      field: 'selfClaimedSkills',
      waitBeforeNextMs: 0
    }
  },
  [INTEREST_TYPES.SPEED]: {
    nickname: {
      mainLine: '你给我起了这么厉害的名字，你一定也很厉害！你叫什么？',
      followUp: null,
      field: 'nickname',
      waitBeforeNextMs: 0
    },
    age: {
      mainLine: '你几岁了呀？我想知道我的搭档有多厉害！',
      followUp: null,
      field: 'age',
      waitBeforeNextMs: 0
    },
    interests: {
      mainLine: '你还喜欢什么？赛车？飞机？我也想学！',
      followUp: null,
      field: 'interests',
      waitBeforeNextMs: 0
    },
    skills: {
      mainLine: '你最擅长什么？',
      followUp: null,
      field: 'selfClaimedSkills',
      waitBeforeNextMs: 0
    }
  },
  [INTEREST_TYPES.GENERIC]: {
    nickname: {
      mainLine: '你给我起了这么厉害的名字，你一定也很厉害！你叫什么？',
      followUp: null,
      field: 'nickname',
      waitBeforeNextMs: 0
    },
    age: {
      mainLine: '你几岁了呀？我想知道我的搭档有多厉害！',
      followUp: null,
      field: 'age',
      waitBeforeNextMs: 0
    },
    interests: {
      mainLine: '你喜欢做什么？我也想学！',
      followUp: null,
      field: 'interests',
      waitBeforeNextMs: 0
    },
    skills: {
      mainLine: '你最擅长什么？',
      followUp: null,
      field: 'selfClaimedSkills',
      waitBeforeNextMs: 0
    }
  }
};

/**
 * 获取步骤3画像采集追问
 * @param {string} interestType - 兴趣类型（dinosaur/princess/speed/generic）
 * @returns {{ nickname: object, age: object, interests: object, skills: object }}
 *   每个字段为 { mainLine, followUp, field, waitBeforeNextMs }
 */
function getStep3ProfileQuestions(interestType) {
  const template = PROFILE_QUESTION_TEMPLATES[interestType] || PROFILE_QUESTION_TEMPLATES[INTEREST_TYPES.GENERIC];
  // 返回深拷贝避免外部修改模板
  return {
    nickname: { ...template.nickname },
    age: { ...template.age },
    interests: { ...template.interests },
    skills: { ...template.skills }
  };
}

// 子状态到画像问题字段的映射
const SUB_STATE_TO_FIELD = {
  [STEP3_SUB_STATES.ASK_NICKNAME]: 'nickname',
  [STEP3_SUB_STATES.ASK_AGE]: 'age',
  [STEP3_SUB_STATES.ASK_INTERESTS]: 'interests',
  [STEP3_SUB_STATES.ASK_SKILLS]: 'skills'
};

/**
 * 获取步骤3统一访问器 - 根据子状态返回对应台词
 * @param {string} interestType - 兴趣类型（dinosaur/princess/speed/generic）
 * @param {string} foxName - 狐狸的名字
 * @param {string} subState - 子状态（WORSHIP/ASK_NICKNAME/ASK_AGE/ASK_INTERESTS/ASK_SKILLS/COMPLETE）
 * @returns {object|null} 台词对象 { mainLine, followUp, waitBeforeNextMs, field? } 或 null
 */
function getStep3Dialog(interestType, foxName, subState) {
  // WORSHIP 子状态返回崇拜式回应
  if (subState === STEP3_SUB_STATES.WORSHIP) {
    return getStep3WorshipDialog(interestType, foxName);
  }

  // COMPLETE 或未知子状态返回 null
  if (subState === STEP3_SUB_STATES.COMPLETE) {
    return null;
  }

  // 画像问题子状态返回对应问题
  const field = SUB_STATE_TO_FIELD[subState];
  if (!field) {
    return null;
  }

  const questions = getStep3ProfileQuestions(interestType);
  return questions[field];
}

module.exports = {
  STEP3_SUB_STATES,
  WORSHIP_TEMPLATES,
  PROFILE_QUESTION_TEMPLATES,
  getStep3WorshipDialog,
  getStep3ProfileQuestions,
  getStep3Dialog
};
