/**
 * 回忆锚点生成器 - Issue #7 每日见面开场
 *
 * 参考PRD §4.5.3 变化一: 开场方式
 *   开场包含回忆锚点，引用上一次会话的关键事件：
 *   - Session 2: 「闪电闪电！上次你教我念的『龙』字，恐龙国的恐龙们高兴坏了！...」
 *   - Session 5: 「闪电！还记得我们帮三角龙找回的『大』字吗？...」
 *   - Session 10: 「闪电！恐龙国今天给我发了一个奖牌...」
 *
 * 职责：
 *   1. 根据上一次会话数据生成回忆锚点
 *   2. 优先引用 items_learned（最近学习项），其次 child_spontaneous_remarks
 *   3. 根据兴趣分型嵌入主题语言（dinosaur/princess/speed/generic）
 *   4. 使用 childProfile.nickname 和 childProfile.foxName 个性化锚点文本
 */

const {
  classifyInterest,
  INTEREST_TYPES
} = require('./interest-classifier');

// 锚点类型常量
const ANCHOR_TYPES = {
  ITEMS_LEARNED: 'items_learned',
  KEY_EVENT: 'key_event',
  MILESTONE: 'milestone',
  NONE: 'none'
};

// 默认画像值（childProfile 缺失时使用）
const DEFAULT_NICKNAME = '小伙伴';
const DEFAULT_FOX_NAME = '小狐狸';

// 各兴趣分型对应的主题场景描述
// 用于在锚点文本中嵌入主题语言
const THEME_SCENES = {
  [INTEREST_TYPES.DINOSAUR]: '恐龙国',
  [INTEREST_TYPES.PRINCESS]: '魔法王国',
  [INTEREST_TYPES.SPEED]: '赛车场',
  [INTEREST_TYPES.GENERIC]: ''
};

// 各兴趣分型对应的主题角色群体
const THEME_CHARACTERS = {
  [INTEREST_TYPES.DINOSAUR]: '恐龙们',
  [INTEREST_TYPES.PRINCESS]: '精灵们',
  [INTEREST_TYPES.SPEED]: '小伙伴们',
  [INTEREST_TYPES.GENERIC]: ''
};

/**
 * 从 childProfile 中解析个性化字段与兴趣分型
 * @param {object|null|undefined} childProfile
 * @returns {{ nickname: string, foxName: string, interestType: string }}
 */
function resolveProfile(childProfile) {
  const profile = childProfile || {};
  const nickname = profile.nickname || DEFAULT_NICKNAME;
  const foxName = profile.foxName || DEFAULT_FOX_NAME;
  // 兴趣分型从狐狸名字中推导（与项目既有架构一致）
  const interestType = classifyInterest(foxName).type;
  return { nickname, foxName, interestType };
}

/**
 * 构造 items_learned 锚点文本
 * @param {string} item - 被引用的学习项
 * @param {{ nickname: string, foxName: string, interestType: string }} profile
 * @returns {string}
 */
function buildItemsLearnedText(item, profile) {
  const { nickname, foxName, interestType } = profile;
  const scene = THEME_SCENES[interestType];
  const characters = THEME_CHARACTERS[interestType];

  // 主题分型：带回主题场景，角色群体高兴
  if (scene && characters) {
    return `${nickname}！还记得上次你教我念的『${item}』字吗？${foxName}带回${scene}，${characters}都高兴坏了！`;
  }
  // 中性语言（generic）
  return `${nickname}！还记得上次你教我念的『${item}』字吗？${foxName}一直记着呢！`;
}

/**
 * 构造 key_event 锚点文本（引用孩子自发话语）
 * @param {string} remark - 被引用的自发话语
 * @param {{ nickname: string, foxName: string, interestType: string }} profile
 * @returns {string}
 */
function buildKeyEventText(remark, profile) {
  const { nickname, foxName, interestType } = profile;
  const scene = THEME_SCENES[interestType];
  const characters = THEME_CHARACTERS[interestType];

  // 主题分型：回去告诉主题场景的角色群体
  if (scene && characters) {
    return `${nickname}！上次你说的「${remark}」，${foxName}回去告诉${scene}的${characters}了！`;
  }
  // 中性语言（generic）
  return `${nickname}！上次你说的「${remark}」，${foxName}一直记着呢！`;
}

/**
 * 创建回忆锚点生成器
 * @returns {object} 回忆锚点生成器实例
 */
function createMemoryAnchorGenerator() {
  return {
    /**
     * 根据上一次会话数据生成回忆锚点
     * @param {object|null|undefined} previousSession - 上一次会话的 session_data（首次见面时为 null）
     * @param {object|null|undefined} childProfile - 孩子画像 { nickname, foxName, ... }
     * @returns {{ hasAnchor: boolean, anchorText: string, referencedItems: string[], anchorType: string }}
     */
    generateAnchor(previousSession, childProfile) {
      // 无前次会话 → 无锚点
      if (!previousSession) {
        return {
          hasAnchor: false,
          anchorText: '',
          referencedItems: [],
          anchorType: ANCHOR_TYPES.NONE
        };
      }

      const profile = resolveProfile(childProfile);

      // 优先级1：items_learned（引用最近学习项，即数组最后一个）
      const itemsLearned = previousSession.items_learned;
      if (Array.isArray(itemsLearned) && itemsLearned.length > 0) {
        const referencedItem = itemsLearned[itemsLearned.length - 1];
        return {
          hasAnchor: true,
          anchorText: buildItemsLearnedText(referencedItem, profile),
          referencedItems: [referencedItem],
          anchorType: ANCHOR_TYPES.ITEMS_LEARNED
        };
      }

      // 优先级2：child_spontaneous_remarks（引用关键事件）
      const remarks = previousSession.child_spontaneous_remarks;
      if (Array.isArray(remarks) && remarks.length > 0) {
        const referencedRemark = remarks[remarks.length - 1];
        return {
          hasAnchor: true,
          anchorText: buildKeyEventText(referencedRemark, profile),
          referencedItems: [referencedRemark],
          anchorType: ANCHOR_TYPES.KEY_EVENT
        };
      }

      // 无可引用内容 → 无锚点
      return {
        hasAnchor: false,
        anchorText: '',
        referencedItems: [],
        anchorType: ANCHOR_TYPES.NONE
      };
    }
  };
}

module.exports = {
  ANCHOR_TYPES,
  createMemoryAnchorGenerator
};
