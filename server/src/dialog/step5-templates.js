/**
 * 步骤5 搭档确认台词 - Issue #3 台词分型引擎
 *
 * 参考技术架构文档§三「对话引擎架构」：
 *   Interest Brancher（名字→兴趣分型）→ 搭档确认台词分型
 *
 * 参考技术架构文档§八「兴趣分型映射」：
 *   根据兴趣类型返回不同的搭档邀请与回应
 *
 * PRD §4.1 步骤5 搭档确认：
 *   - 小狐狸发出正式搭档邀请（含兴趣分型搭档标签）
 *   - 孩子接受 → 搭档关系确立，记录 partner_acceptance: true
 *   - 孩子犹豫 → 小狐狸分享脆弱再邀
 *   - 孩子拒绝 → 记录 partner_acceptance: false，温柔收尾
 *
 * 兴趣分型搭档标签（与 interest-classifier 的基础标签不同：
 *   基础标签为「恐龙/魔法/赛车/小伙伴」，搭档标签前三者追加「搭档」后缀，
 *   generic 保持「小伙伴」作为纯搭档邀请）
 */

// 兴趣类型对应的搭档标签
// 参考技术架构文档§八「兴趣分型映射」
const PARTNER_LABELS = {
  dinosaur: '恐龙搭档',
  princess: '魔法搭档',
  speed: '赛车搭档',
  generic: '小伙伴'
};

/**
 * 获取搭档邀请台词
 * @param {string} interestType - 兴趣类型
 * @param {string} foxName - 狐狸的名字
 * @returns {{ mainLine: string, followUp: string|null, waitBeforeNextMs: number }}
 */
function getStep5InvitationDialog(interestType, foxName) {
  const name = foxName || '小狐狸';
  const label = PARTNER_LABELS[interestType] || PARTNER_LABELS.generic;

  const mainLine = `${name}想正式问你：你愿意做我的${label}吗？`;
  return {
    mainLine,
    followUp: null,
    waitBeforeNextMs: 1500
  };
}

/**
 * 获取搭档确认回应台词
 * @param {string} interestType - 兴趣类型
 * @param {string} foxName - 狐狸的名字
 * @param {string} childResponse - 孩子反应：'accept' | 'hesitate' | 'refuse'
 * @returns {{ mainLine: string, followUp: string|null, partnerAcceptance: boolean|null, waitBeforeNextMs: number }}
 */
function getStep5ResponseDialog(interestType, foxName, childResponse) {
  const name = foxName || '小狐狸';
  const label = PARTNER_LABELS[interestType] || PARTNER_LABELS.generic;

  if (childResponse === 'accept') {
    // 孩子接受 → 搭档关系确立
    return {
      mainLine: `太好了！从今天起，我们就是${label}啦！${name}好开心！`,
      followUp: null,
      partnerAcceptance: true,
      waitBeforeNextMs: 1500
    };
  }

  if (childResponse === 'hesitate') {
    // 孩子犹豫 → 小狐狸分享脆弱，再邀
    return {
      mainLine: '我有点害怕没有人愿意做我的搭档...',
      followUp: `你愿意再想想吗？做我的${label}好不好？`,
      partnerAcceptance: null,
      waitBeforeNextMs: 2000
    };
  }

  if (childResponse === 'refuse') {
    // 孩子明确拒绝 → 记录 partner_acceptance: false，温柔收尾
    return {
      mainLine: '没关系，我一直在，你随时可以来找我',
      followUp: null,
      partnerAcceptance: false,
      waitBeforeNextMs: 1500
    };
  }

  // 未知回应类型 → 默认返回邀请
  return getStep5InvitationDialog(interestType, foxName);
}

/**
 * 搭档确认台词组合访问器
 * @param {string} interestType - 兴趣类型
 * @param {string} foxName - 狐狸的名字
 * @param {string} [childResponse] - 孩子反应（可选）：'accept' | 'hesitate' | 'refuse'
 * @returns {object} 未传 childResponse 返回邀请台词；传入则返回对应回应台词
 */
function getStep5Dialog(interestType, foxName, childResponse) {
  if (childResponse) {
    return getStep5ResponseDialog(interestType, foxName, childResponse);
  }
  return getStep5InvitationDialog(interestType, foxName);
}

module.exports = {
  PARTNER_LABELS,
  getStep5InvitationDialog,
  getStep5ResponseDialog,
  getStep5Dialog
};
