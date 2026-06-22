/**
 * 故事阶段管理器 - Issue #7 每日见面开场
 *
 * 参考PRD §4.2 骨架层：命运主线故事
 * 参考技术架构文档§三「对话引擎架构」
 *
 * 命运主线4阶段（自动推进，无需孩子选择）：
 *   1. 字母石（拼音）- 找回字音国的字母石
 *   2. 门牌（识字）- 修复魔法城堡的门牌
 *   3. 灯（数学）- 数清星星花园的灯
 *   4. 小鸟（英语）- 遇见来自远方的小鸟
 *
 * 职责：
 *   1. 管理命运主线4阶段的定义和顺序
 *   2. 提供阶段自动推进机制
 *   3. 生成阶段间的悬念衔接台词
 *   4. 支持状态序列化和恢复
 */

// 故事阶段定义（参考PRD §4.2 骨架层）
const STORY_STAGES = [
  {
    id: 'letter_stone',
    name: '字母石',
    subject: 'pinyin',
    description: '找回字音国的字母石',
    introLine: '字母石碎了，我念不出这个字的音...你能帮我看看怎么拼吗？'
  },
  {
    id: 'door_sign',
    name: '门牌',
    subject: 'literacy',
    description: '修复魔法城堡的门牌',
    introLine: '每扇门上的字都看不清了，我们得把正确的字贴上去！'
  },
  {
    id: 'star_lamp',
    name: '灯',
    subject: 'math',
    description: '数清星星花园的灯',
    introLine: '花园里有七个地方要放灯，我只找到三个，还差几个？'
  },
  {
    id: 'distant_bird',
    name: '小鸟',
    subject: 'english',
    description: '遇见来自远方的小鸟',
    introLine: '我的小鸟朋友只说一种奇怪的话，你怎么跟它打招呼？'
  }
];

// 阶段间悬念衔接台词
const STAGE_TRANSITIONS = [
  {
    fromStageId: 'letter_stone',
    toStageId: 'door_sign',
    suspenseLine: '上次我们走到字母石的第2块，今天该找第3块了...等等，前面那是什么？'
  },
  {
    fromStageId: 'door_sign',
    toStageId: 'star_lamp',
    suspenseLine: '门牌修好了！可是...星星花园的灯怎么全灭了？'
  },
  {
    fromStageId: 'star_lamp',
    toStageId: 'distant_bird',
    suspenseLine: '灯亮了！听...那是什么声音？好像有只小鸟在叫我！'
  }
];

/**
 * 创建故事阶段管理器
 * @param {string} childId - 孩子 ID
 * @param {object} [options] - 选项
 * @param {number} [options.initialStageIndex=0] - 初始阶段索引
 * @returns {object} 故事阶段管理器实例
 */
function createStoryStageManager(childId, options = {}) {
  let currentStageIndex = options.initialStageIndex || 0;

  // 确保索引在有效范围内
  if (currentStageIndex < 0) currentStageIndex = 0;
  if (currentStageIndex >= STORY_STAGES.length) {
    currentStageIndex = STORY_STAGES.length - 1;
  }

  return {
    // ===== 阶段查询 =====

    /**
     * 获取当前阶段对象
     * @returns {object} 当前阶段
     */
    getCurrentStage() {
      return STORY_STAGES[currentStageIndex];
    },

    /**
     * 获取当前阶段索引
     * @returns {number}
     */
    getStageIndex() {
      return currentStageIndex;
    },

    /**
     * 获取所有阶段定义
     * @returns {object[]}
     */
    getAllStages() {
      return [...STORY_STAGES];
    },

    /**
     * 判断是否在最后一个阶段
     * @returns {boolean}
     */
    isLastStage() {
      return currentStageIndex === STORY_STAGES.length - 1;
    },

    // ===== 阶段推进 =====

    /**
     * 推进到下一阶段
     * @returns {{ success: boolean, newStage?: object, isLastStage?: boolean }}
     */
    advanceToNextStage() {
      if (currentStageIndex >= STORY_STAGES.length - 1) {
        return { success: false };
      }
      currentStageIndex += 1;
      return {
        success: true,
        newStage: STORY_STAGES[currentStageIndex],
        isLastStage: currentStageIndex === STORY_STAGES.length - 1
      };
    },

    /**
     * 跳转到指定阶段（用于状态恢复）
     * @param {number} index - 阶段索引
     */
    setStageIndex(index) {
      if (index < 0 || index >= STORY_STAGES.length) {
        throw new Error(`无效阶段索引：${index}`);
      }
      currentStageIndex = index;
    },

    // ===== 悬念衔接 =====

    /**
     * 获取到达当前阶段的悬念衔接信息
     * 返回从前一阶段到当前阶段的过渡台词
     * 第一阶段返回故事开场白
     * @returns {{ fromStage: object, toStage: object, suspenseLine: string }}
     */
    getStageTransition() {
      const currentStage = STORY_STAGES[currentStageIndex];
      // 第一阶段返回故事开场白
      if (currentStageIndex === 0) {
        return {
          fromStage: currentStage,
          toStage: currentStage,
          suspenseLine: '字音国的魔法消失了，字都看不清了...我们需要找到字母石！'
        };
      }
      // 过渡索引 = 当前阶段索引 - 1（即到达当前阶段所经过的过渡）
      const transition = STAGE_TRANSITIONS[currentStageIndex - 1];
      const fromStage = STORY_STAGES[currentStageIndex - 1];
      return {
        fromStage,
        toStage: currentStage,
        suspenseLine: transition ? transition.suspenseLine : ''
      };
    },

    // ===== 序列化 =====

    /**
     * 序列化为JSON
     * @returns {object}
     */
    toJSON() {
      return {
        childId,
        currentStageIndex,
        currentStageId: STORY_STAGES[currentStageIndex].id
      };
    },

    /**
     * 从JSON恢复状态
     * @param {object} json
     */
    fromJSON(json) {
      if (json.currentStageIndex !== undefined) {
        currentStageIndex = json.currentStageIndex;
      }
    }
  };
}

module.exports = {
  STORY_STAGES,
  createStoryStageManager
};
