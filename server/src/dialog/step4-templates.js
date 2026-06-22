/**
 * 步骤4 费曼学习触发台词模板 - Issue #3 台词分型引擎
 *
 * 参考技术架构文档§三「对话引擎架构」
 * 参考PRD §4.1 步骤4 费曼学习法首次触发
 *
 * 职责：
 *   1. 根据兴趣分型从狐狸名字中提取要教的"生字"
 *   2. 输出费曼触发的主动台词（小狐狸请孩子教它认字）
 *   3. 根据孩子反应输出对应反馈台词，并记录 teaching_willingness
 *
 * 接口契约：
 *   getStep4TriggerDialog(interestType, foxName) → { mainLine, followUp, targetCharacter, waitBeforeNextMs }
 *   getStep4FeedbackDialog(childResponse) → { mainLine, followUp, teachingWillingness, waitBeforeNextMs }
 *   extractTargetCharacter(interestType, foxName) → string|null
 *   getStep4Dialog(interestType, foxName, childResponse) → 组合访问器
 */

// 兴趣分型 → 目标生字候选映射
// 参考PRD §4.1 步骤4：恐龙线教「龙」，速度线教「闪」，公主线教「莎」或「魔」
const TARGET_CHARACTER_MAP = {
  dinosaur: ['龙'],
  speed: ['闪'],
  princess: ['莎', '魔']
};

/**
 * 根据兴趣分型从狐狸名字中提取要教的生字
 * @param {string} interestType - 兴趣分型（dinosaur | princess | speed | generic）
 * @param {string} foxName - 狐狸的名字
 * @returns {string|null} 要教的生字；不存在或 generic 时返回 null
 */
function extractTargetCharacter(interestType, foxName) {
  const name = foxName || '';
  const candidates = TARGET_CHARACTER_MAP[interestType];
  if (!candidates) {
    return null;
  }
  for (const ch of candidates) {
    if (name.includes(ch)) {
      return ch;
    }
  }
  return null;
}

/**
 * 获取步骤4费曼触发的主动台词
 * 小狐狸说名字里有个字不太确定怎么念，请孩子教它（以教代学）
 * @param {string} interestType - 兴趣分型
 * @param {string} foxName - 狐狸的名字
 * @returns {{ mainLine: string, followUp: string|null, targetCharacter: string|null, waitBeforeNextMs: number }}
 */
function getStep4TriggerDialog(interestType, foxName) {
  const name = foxName || '';
  const targetCharacter = extractTargetCharacter(interestType, name);

  // 若能提取到目标生字，台词聚焦该字并请孩子教
  if (targetCharacter) {
    return {
      mainLine: `我名字「${name}」里有个字我不太确定怎么念……「${targetCharacter}」字怎么读呀？你能教教我吗？`,
      followUp: null,
      targetCharacter,
      waitBeforeNextMs: 1500
    };
  }

  // 无目标生字时的回退：参考PRD §4.1 步骤4
  // "名字无生字 → 台词转「我还想知道更多字！你能教我认你的名字吗？」"
  return {
    mainLine: '我还想知道更多字！你能教我认你的名字吗？',
    followUp: null,
    targetCharacter: null,
    waitBeforeNextMs: 1500
  };
}

/**
 * 获取步骤4孩子反应的反馈台词
 * 根据孩子反应（念对/不确定/拒绝）输出对应反馈，并记录 teaching_willingness
 * @param {string} childResponse - 孩子反应：'correct' | 'unsure' | 'refuse'
 * @returns {{ mainLine: string, followUp: string|null, teachingWillingness: boolean, waitBeforeNextMs: number }}
 */
function getStep4FeedbackDialog(childResponse) {
  // 孩子念对 → 崇拜反馈 + 记录 teaching_willingness: true
  // 参考PRD §4.1 步骤4：「你太厉害了！你是我的识字搭档！」
  if (childResponse === 'correct') {
    return {
      mainLine: '你太厉害了！你是我的识字搭档！',
      followUp: null,
      teachingWillingness: true,
      waitBeforeNextMs: 1500
    };
  }

  // 孩子不确定 → 共同探索 + 仍记录 teaching_willingness: true
  // 参考PRD §4.1 步骤4：「没关系，我们一起查查！」
  if (childResponse === 'unsure') {
    return {
      mainLine: '没关系，我们一起查查！',
      followUp: null,
      teachingWillingness: true,
      waitBeforeNextMs: 1500
    };
  }

  // 孩子明确拒绝 → 不强制教学 + 记录 teaching_willingness: false
  // 参考PRD §4.1 步骤4：孩子明确拒绝教 → 记录 teaching_willingness: false，不强制进入教学
  // 未知反应按保守处理，同样不记录愿意教学
  return {
    mainLine: '没关系，我们以后再慢慢学！',
    followUp: null,
    teachingWillingness: false,
    waitBeforeNextMs: 1500
  };
}

/**
 * 步骤4 组合访问器
 * 不传 childResponse → 返回费曼触发台词；传 childResponse → 返回对应反馈台词
 * @param {string} interestType - 兴趣分型
 * @param {string} foxName - 狐狸的名字
 * @param {string} [childResponse] - 孩子反应：'correct' | 'unsure' | 'refuse'（可选）
 * @returns {object} 触发台词或反馈台词
 */
function getStep4Dialog(interestType, foxName, childResponse) {
  // 无孩子反应时，返回费曼触发台词
  if (childResponse === undefined || childResponse === null) {
    return getStep4TriggerDialog(interestType, foxName);
  }
  // 有孩子反应时，返回对应反馈台词
  return getStep4FeedbackDialog(childResponse);
}

module.exports = {
  extractTargetCharacter,
  getStep4TriggerDialog,
  getStep4FeedbackDialog,
  getStep4Dialog
};
