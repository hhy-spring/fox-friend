/**
 * 借分契约台词生成 - Issue #9 借分契约机制
 *
 * 参考PRD §4.3 借分契约机制
 *
 * 当孩子连续3次不愿推进(叛逆/无聊状态),第4次触发借分对赌。
 * 本模块负责生成借分契约各阶段台词,语气活泼可爱,适合4-7岁儿童。
 * 输了时强调"陪伴"而非"惩罚",不涉及任何惩罚性语言。
 */

// 借分点数常量
const DEFAULT_BORROW_POINTS = 10; // 借分固定 10 分
const DEFAULT_WIN_POINTS = 20;    // 赢了翻倍 20 分

// 借分契约台词类型常量
const CONTRACT_DIALOGUE_TYPES = {
  PROPOSAL: 'PROPOSAL',         // 借分提案
  ACCEPT: 'ACCEPT',             // 接受对赌
  REJECT: 'REJECT',             // 拒绝对赌
  CHANGED_MIND: 'CHANGED_MIND', // 孩子改变主意
  WIN: 'WIN',                   // 赢了对赌
  LOSE: 'LOSE'                  // 输了对赌
};

/**
 * 创建借分契约台词生成器
 * @param {object} [options]
 * @param {number} [options.borrowPoints=10] - 借分点数
 * @param {number} [options.winPoints=20] - 赢了后的点数
 * @returns {object} 台词生成器实例
 */
function createContractDialogue(options = {}) {
  const borrowPoints = options.borrowPoints || DEFAULT_BORROW_POINTS;
  const winPoints = options.winPoints || DEFAULT_WIN_POINTS;

  return {
    /**
     * 生成借分契约提案台词
     * @returns {string}
     */
    getProposalLine() {
      return `我想跟你借${borrowPoints}个聪明分...如果你做到了,翻倍变成${winPoints}分,还能解锁新故事!如果我输了,我陪你做一件搞笑的事!你敢不敢跟我打这个赌?`;
    },

    /**
     * 生成接受对赌后的台词
     * @returns {string}
     */
    getAcceptLine() {
      return '太好了!那我们击掌!🤚 准备好了吗?';
    },

    /**
     * 生成拒绝对赌的台词(温柔收尾,强调陪伴)
     * @returns {string}
     */
    getRejectLine() {
      return '没关系,我们下次再玩!你想做什么我都陪你!';
    },

    /**
     * 生成孩子改变主意(愿意学了)的退出台词
     * @returns {string}
     */
    getChangedMindLine() {
      return '太好了!那我们继续学吧!你真棒!';
    },

    /**
     * 生成赢了对赌的台词
     * @returns {string}
     */
    getWinLine() {
      return `哇!你做到了!${winPoints}个聪明分归你啦!我还给你解锁了一个新故事!🎉`;
    },

    /**
     * 生成输了对赌的台词(引入搞笑任务,强调陪伴而非惩罚)
     * @returns {string}
     */
    getLoseLine() {
      return '哎呀,我输啦!那我陪你做一件搞笑的事吧!';
    },

    /**
     * 获取借分点数台词
     * @returns {string}
     */
    getBorrowPointsLine() {
      return `${borrowPoints}个聪明分`;
    },

    /**
     * 获取赢分点数台词
     * @returns {string}
     */
    getWinPointsLine() {
      return `${winPoints}个聪明分`;
    }
  };
}

module.exports = {
  createContractDialogue,
  CONTRACT_DIALOGUE_TYPES
};
