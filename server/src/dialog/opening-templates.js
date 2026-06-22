/**
 * 开场一句话模板生成器 - Issue #7 每日见面开场
 *
 * 参考PRD §4.5.3 变化一: 开场方式
 *   每日见面开场必须在同一句话中结合三个元素：
 *     1. 点名叫人（call child by name）
 *     2. 回忆锚点（memory anchor referencing last session）
 *     3. 引出新任务（introduce new task）
 *
 * PRD 示例：
 *   - Session 2: 「闪电闪电！上次你教我念的『龙』字，恐龙国的恐龙们高兴坏了！但是今天又有新麻烦了……你快来！」
 *   - Session 5: 「闪电！还记得我们帮三角龙找回的『大』字吗？今天霸王龙也来求助了——它的字母石被人拿走了！」
 *   - Session 10: 「闪电！恐龙国今天给我发了一个奖牌……但是奖牌上有个字我不认识…」
 *
 * 职责：
 *   1. 根据语气阶段生成点名叫人（FAMILIAR 重复两次，TACIT/OLD_PARTNERS 叫一次）
 *   2. 嵌入回忆锚点（hasAnchor 为 true 时嵌入 anchorText）
 *   3. 根据故事阶段引出新任务（使用 introLine，含主题语言）
 *   4. 根据兴趣分型嵌入主题语言（dinosaur/princess/speed/generic）
 *   5. 根据语气修饰符添加玩笑/惊喜元素（canJoke/canSurprise）
 *   6. 将三组件组合为单一连贯的开场文本
 */

const {
  classifyInterest,
  INTEREST_TYPES
} = require('./interest-classifier');
const {
  TONE_PHASES
} = require('./tone-evolution');

// 默认画像值（childProfile 缺失时使用）
const DEFAULT_NICKNAME = '小伙伴';
const DEFAULT_FOX_NAME = '小狐狸';

// 各兴趣分型对应的主题场景
// 用于在新任务中嵌入主题语言
const THEME_SCENES = {
  [INTEREST_TYPES.DINOSAUR]: '恐龙国',
  [INTEREST_TYPES.PRINCESS]: '魔法王国',
  [INTEREST_TYPES.SPEED]: '赛车场',
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
  const interestType = classifyInterest(foxName).type;
  return { nickname, foxName, interestType };
}

/**
 * 判断语气阶段是否允许开玩笑
 * TACIT 和 OLD_PARTNERS 阶段可以开玩笑
 * @param {object|null|undefined} tonePhase
 * @returns {boolean}
 */
function canJokeForPhase(tonePhase) {
  if (!tonePhase || !tonePhase.phase) return false;
  return tonePhase.phase === TONE_PHASES.TACIT
    || tonePhase.phase === TONE_PHASES.OLD_PARTNERS;
}

/**
 * 判断语气阶段是否允许制造惊喜
 * 仅 OLD_PARTNERS 阶段可以制造惊喜
 * @param {object|null|undefined} tonePhase
 * @returns {boolean}
 */
function canSurpriseForPhase(tonePhase) {
  if (!tonePhase || !tonePhase.phase) return false;
  return tonePhase.phase === TONE_PHASES.OLD_PARTNERS;
}

/**
 * 构造点名叫人部分
 * FAMILIAR 阶段（session 2-3）重复两次：「闪电闪电！」
 * TACIT / OLD_PARTNERS 阶段叫一次：「闪电！」
 * @param {string} nickname - 孩子昵称
 * @param {object|null|undefined} tonePhase - 语气阶段对象
 * @returns {string}
 */
function buildNameCall(nickname, tonePhase) {
  const phase = tonePhase ? tonePhase.phase : '';
  if (phase === TONE_PHASES.FAMILIAR) {
    return `${nickname}${nickname}！`;
  }
  return `${nickname}！`;
}

/**
 * 构造回忆锚点部分
 * hasAnchor 为 true 时嵌入 anchorText，否则返回空字符串
 * @param {object|null|undefined} memoryAnchor - 回忆锚点对象
 * @returns {string}
 */
function buildMemoryAnchorText(memoryAnchor) {
  if (memoryAnchor && memoryAnchor.hasAnchor && memoryAnchor.anchorText) {
    return memoryAnchor.anchorText;
  }
  return '';
}

/**
 * 构造新任务部分
 * 基于故事阶段的 introLine，嵌入兴趣主题语言
 * 根据语气修饰符添加玩笑/惊喜元素
 * @param {object|null|undefined} storyStage - 故事阶段对象
 * @param {string} interestType - 兴趣分型
 * @param {object|null|undefined} tonePhase - 语气阶段对象
 * @returns {string}
 */
function buildNewTask(storyStage, interestType, tonePhase) {
  const stage = storyStage || {};
  const introLine = stage.introLine || '今天我们继续冒险吧！';
  const scene = THEME_SCENES[interestType] || '';

  const parts = [];

  // 惊喜元素（canSurprise 时添加）
  if (canSurpriseForPhase(tonePhase)) {
    parts.push('偷偷告诉你，今天有个大惊喜哦！');
  }

  // 玩笑元素（canJoke 时添加）
  if (canJokeForPhase(tonePhase)) {
    parts.push('哈哈，跟你打个赌——');
  }

  // 主题化过渡 + introLine
  if (scene) {
    parts.push(`${scene}今天又有新麻烦了！${introLine}`);
  } else {
    parts.push(`今天又有新麻烦了！${introLine}`);
  }

  return parts.join('');
}

/**
 * 将三组件组合为单一连贯的开场文本
 * @param {string} nameCall - 点名叫人
 * @param {string} memoryAnchorText - 回忆锚点（可为空）
 * @param {string} newTask - 新任务
 * @returns {string}
 */
function combineOpening(nameCall, memoryAnchorText, newTask) {
  const parts = [nameCall];
  if (memoryAnchorText) {
    parts.push(memoryAnchorText);
  }
  parts.push(newTask);
  return parts.join('');
}

/**
 * 创建开场一句话模板生成器
 * @returns {object} 开场模板生成器实例
 */
function createOpeningTemplateGenerator() {
  return {
    /**
     * 生成完整的开场一句话
     * @param {object} params
     * @param {object} params.childProfile - 孩子画像 { nickname, foxName, interests_derived_from_fox_name }
     * @param {number} params.sessionCount - 当前见面次数（如第2次见面为 2）
     * @param {object|null} params.previousSession - 上一次会话数据（首次见面为 null）
     * @param {object} params.storyStage - 当前故事阶段对象（来自 story-stage-manager）
     * @param {object} params.tonePhase - 当前语气阶段对象（来自 tone-evolution）
     * @param {object} params.memoryAnchor - 回忆锚点对象（来自 memory-anchor）
     * @returns {{
     *   openingText: string,
     *   components: { nameCall: string, memoryAnchor: string, newTask: string },
     *   tonePhase: string,
     *   interestType: string
     * }}
     */
    generateOpening({
      childProfile,
      sessionCount,
      previousSession,
      storyStage,
      tonePhase,
      memoryAnchor
    }) {
      const { nickname, foxName, interestType } = resolveProfile(childProfile);

      const nameCall = buildNameCall(nickname, tonePhase);
      const memoryAnchorText = buildMemoryAnchorText(memoryAnchor);
      const newTask = buildNewTask(storyStage, interestType, tonePhase);
      const openingText = combineOpening(nameCall, memoryAnchorText, newTask);

      return {
        openingText,
        components: {
          nameCall,
          memoryAnchor: memoryAnchorText,
          newTask
        },
        tonePhase: tonePhase ? tonePhase.phase : '',
        interestType
      };
    }
  };
}

module.exports = {
  createOpeningTemplateGenerator,
  THEME_SCENES,
  DEFAULT_NICKNAME,
  DEFAULT_FOX_NAME
};
