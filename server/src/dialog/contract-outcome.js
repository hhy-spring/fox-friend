/**
 * 借分契约结果处理 - Issue #9 借分契约机制
 *
 * 参考PRD §4.3 借分契约
 *   处理借分契约对赌的三种结果: 赢 / 输 / 改变主意
 *   - 赢了: 解锁新故事(正面强化),返回 20 分
 *   - 输了: 执行搞笑任务(不涉及惩罚),从搞笑任务池随机选一个
 *   - 改变主意: 立即退出对赌
 *
 * 核心设计约束: 搞笑任务不涉及惩罚,保持在关系内的游戏化互动
 */

const { createFunnyTaskPool } = require('./funny-task-pool');

// 对赌结果类型常量
const OUTCOME_TYPES = {
  WIN: 'win',
  LOSE: 'lose',
  CHANGED_MIND: 'changed_mind'
};

// 赢了对赌可解锁的新故事列表(参考技术架构命运主线4阶段)
const UNLOCKABLE_STORIES = [
  '字母石冒险',
  '门牌的秘密',
  '灯塔之光',
  '小鸟的旅程'
];

/**
 * 创建借分契约结果处理实例
 * @param {object} [options]
 * @param {object} [options.funnyTaskPool] - 搞笑任务池实例(支持依赖注入用于测试)
 * @returns {object} 结果处理实例
 */
function createContractOutcome(options = {}) {
  // 搞笑任务池: 优先使用注入的实例,否则创建默认实例
  const funnyTaskPool = options.funnyTaskPool || createFunnyTaskPool();

  return {
    /**
     * 处理赢了对赌
     * 解锁新故事(正面强化),返回 20 分
     * @returns {{ outcome: string, storyUnlocked: boolean, dialogue: string, points: number }}
     */
    handleWin() {
      return {
        outcome: OUTCOME_TYPES.WIN,
        storyUnlocked: true,
        dialogue: '哇!你做到了!小狐狸开心地为你解锁了一个新故事!',
        points: 20
      };
    },

    /**
     * 处理输了对赌
     * 从搞笑任务池随机选一个任务(不涉及惩罚),返回 0 分
     * @returns {{ outcome: string, funnyTask: object|null, dialogue: string, points: number }}
     */
    handleLose() {
      // 输了对赌: 执行搞笑任务,保持在关系内的游戏化互动
      const funnyTask = funnyTaskPool.getRandomTask();
      return {
        outcome: OUTCOME_TYPES.LOSE,
        funnyTask,
        dialogue: '哎呀,这次没赢~没关系,陪小狐狸做一个搞笑任务吧!',
        points: 0
      };
    },

    /**
     * 处理孩子改变主意
     * 立即退出对赌,不产生点数变化
     * @returns {{ outcome: string, dialogue: string, exited: boolean }}
     */
    handleChangeMind() {
      return {
        outcome: OUTCOME_TYPES.CHANGED_MIND,
        dialogue: '太好了!那我们继续学吧!',
        exited: true
      };
    },

    /**
     * 验证结果类型是否合法
     * @param {string} outcome - 结果类型字符串
     * @returns {boolean}
     */
    isValidOutcome(outcome) {
      const validValues = Object.values(OUTCOME_TYPES);
      return validValues.includes(outcome);
    },

    /**
     * 获取赢了对赌可解锁的新故事列表
     * 参考技术架构命运主线4阶段
     * @returns {string[]}
     */
    getUnlockableStories() {
      return UNLOCKABLE_STORIES.slice();
    }
  };
}

module.exports = {
  createContractOutcome,
  OUTCOME_TYPES
};
