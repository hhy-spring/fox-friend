/**
 * 对话引擎 - 孩子反应检测与台词生成
 *
 * 参考技术架构文档§三「对话引擎架构」：
 *   FSM Router → LLM Generator（Prompt模板 + context）→ Emotion Adjuster（密度/脆弱度）
 *
 * PRD §4.5.2 通用层：步骤1-2台词对所有孩子一致，
 * 唯一变量是孩子的实时反应（回应速度/质量/情绪）调控停顿和语气
 */

// 孩子反应类型
const REACTION_TYPES = {
  QUICK: 'QUICK',         // 秒回（<1秒，或说了完整句子）
  HESITANT: 'HESITANT',   // 犹豫（1-3秒说单词，或1秒内无内容）
  SILENT: 'SILENT'        // 沉默（>3秒无回应）
};

/**
 * 检测孩子的反应类型
 * @param {object} params
 * @param {number} params.responseTimeMs - 孩子回应时间（毫秒）
 * @param {string} params.content - 孩子说的内容
 * @returns {string} 反应类型
 */
function detectReaction({ responseTimeMs, content }) {
  const hasContent = content && content.trim().length > 0;
  const isFullSentence = hasContent && content.trim().length >= 3;

  // 3秒内说了完整句子 → 秒回
  if (responseTimeMs <= 3000 && isFullSentence) {
    return REACTION_TYPES.QUICK;
  }

  // >3秒无回应 → 沉默
  if (responseTimeMs > 3000 && !hasContent) {
    return REACTION_TYPES.SILENT;
  }

  // 1秒内有实质内容 → 秒回
  if (responseTimeMs < 1000 && hasContent) {
    return REACTION_TYPES.QUICK;
  }

  // 1秒内无内容 → 犹豫
  if (responseTimeMs < 1000 && !hasContent) {
    return REACTION_TYPES.HESITANT;
  }

  // 1-3秒说了单词 → 犹豫
  if (responseTimeMs >= 1000 && responseTimeMs <= 3000 && hasContent && !isFullSentence) {
    return REACTION_TYPES.HESITANT;
  }

  // 默认：犹豫
  return REACTION_TYPES.HESITANT;
}

/**
 * 步骤1-2 台词模板
 * 参考PRD §4.5.2 通用层
 */
const STEP_DIALOGS = {
  APPEARANCE: {
    [REACTION_TYPES.QUICK]: {
      mainLine: '你好你好！我一直在等一个小朋友...你终于来了！',
      followUp: null,
      waitBeforeNextMs: 1000
    },
    [REACTION_TYPES.HESITANT]: {
      mainLine: '你好你好！我一直在等一个小朋友...你终于来了！',
      followUp: '你听见我说话了吗？',
      waitBeforeNextMs: 2000
    },
    [REACTION_TYPES.SILENT]: {
      mainLine: '你好你好！我一直在等一个小朋友...你终于来了！',
      followUp: '你是不是有点害羞呀？没关系，我也是……我第一次跟小朋友说话，有点紧张。',
      waitBeforeNextMs: 2000
    }
  },
  HELP_REQUEST: {
    [REACTION_TYPES.QUICK]: {
      mainLine: '可我遇到了一个问题...我还没有名字！你能帮我起一个吗？',
      followUp: '你想给我起个什么样的名字？',
      waitBeforeNextMs: 0
    },
    [REACTION_TYPES.HESITANT]: {
      mainLine: '我有一个小问题……我还没有名字。你觉得叫什么好呢？',
      followUp: '随便说！什么都行！',
      waitBeforeNextMs: 0
    },
    [REACTION_TYPES.SILENT]: {
      mainLine: '我跟你讲一个秘密……我没有名字。别人都有名字，就我没有。',
      followUp: '你想给我起一个名字吗？什么都行！',
      waitBeforeNextMs: 0
    }
  }
};

/**
 * 获取指定步骤和反应类型的台词
 * @param {string} step - 当前步骤状态名
 * @param {string} reactionType - 孩子反应类型
 * @returns {object} 台词对象 { mainLine, followUp, waitBeforeNextMs }
 */
function getStepDialog(step, reactionType) {
  const stepDialogs = STEP_DIALOGS[step];
  if (!stepDialogs) {
    throw new Error(`未定义步骤 ${step} 的台词`);
  }
  const dialog = stepDialogs[reactionType];
  if (!dialog) {
    throw new Error(`未定义步骤 ${step} 在反应 ${reactionType} 下的台词`);
  }
  return dialog;
}

module.exports = {
  REACTION_TYPES,
  detectReaction,
  getStepDialog,
  STEP_DIALOGS
};
