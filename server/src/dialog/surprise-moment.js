/**
 * 惊喜时刻管理器 - Issue #10 关系保鲜机制
 *
 * 参考Issue #10 验收标准：
 *   - 惊喜时刻：随机概率触发（约每 5-8 次一次），做出乎意料的事
 *     （如画幅画、讲个笑话、给个虚拟贴纸）
 *   - 惊喜时刻至少有 5 种不同事件类型
 *   - 所有保鲜机制不与教学内容冲突，嵌入在对话开场或结尾
 *
 * 职责：
 *   1. 基于概率决定是否触发惊喜时刻
 *   2. 随机选择一种事件类型并生成个性化惊喜台词
 *   3. 通过 options.rng 支持测试可重复性
 */

// 默认昵称（childProfile 缺失时使用）
const DEFAULT_NICKNAME = '小伙伴';

// 默认触发概率（约每 5-8 次一次，1/6 ≈ 0.1667）
const TRIGGER_PROBABILITY = 1 / 6;

// 至少见过 2 次面才可能触发惊喜
const MIN_SESSION_COUNT = 2;

// 惊喜事件类型定义
// 每种事件含 type（类型标识）和 texts（候选台词数组）
// 台词模板支持 {nickname} 占位符替换
const SURPRISE_POOL = [
  {
    type: 'draw_picture',
    texts: [
      '{nickname}！我偷偷画了一幅画送给你，画的是我们俩一起冒险的样子！',
      '当当当！我给{nickname}画了一幅画，画里有好多好多星星！',
      '{nickname}，我用彩笔给你画了一幅画，你喜欢吗？'
    ]
  },
  {
    type: 'tell_joke',
    texts: [
      '{nickname}！你知道恐龙为什么不会讲故事吗？因为它们都灭绝了！哈哈哈！',
      '哈哈！我想到一个笑话：什么动物最容易摔倒？狐狸，因为它老是被自己绊倒！',
      '{nickname}，我讲个笑话给你听：小猪对小狗说，你猜我口袋里有几颗糖？'
    ]
  },
  {
    type: 'give_sticker',
    texts: [
      '{nickname}！我给你准备了一个超级闪亮的贴纸！上面画的是我们两个！',
      '当当！我给{nickname}一个特别的贴纸，是笑脸形状的！',
      '{nickname}，我送你一张彩虹贴纸，今天你表现真棒！'
    ]
  },
  {
    type: 'sing_song',
    texts: [
      '{nickname}！啦啦啦～我给你唱首歌！虽然我唱得不太好听，但是是专门为你唱的！',
      '🎵我给{nickname}唱首歌：小星星亮晶晶，就像{nickname}的眼睛！',
      '{nickname}，我唱一首歌给你听：啦啦啦，今天真开心！'
    ]
  },
  {
    type: 'share_treasure',
    texts: [
      '{nickname}！我发现了一个宝藏！是一颗会发光的石头，送给你！',
      '哇！我给{nickname}找到了一个宝藏盒子，里面装满星星！',
      '{nickname}，我发现了一个小宝藏，是一颗彩虹色的糖果，送给你！'
    ]
  },
  {
    type: 'do_magic',
    texts: [
      '{nickname}！见证奇迹的时刻！我把这朵花变成了一只蝴蝶！',
      '✨我给{nickname}表演个魔术：呼啦一下，变出一颗糖！',
      '{nickname}，看我的魔术：叮咚！变出一只小蝴蝶！'
    ]
  }
];

/**
 * 替换台词模板中的占位符
 * @param {string} template - 台词模板
 * @param {string} nickname - 孩子昵称
 * @returns {string}
 */
function fillTemplate(template, nickname) {
  return template.replace(/\{nickname\}/g, nickname);
}

/**
 * 创建惊喜时刻管理器
 * @param {object} [options={}] - 配置项
 * @param {function} [options.rng=Math.random] - 随机数生成器（用于测试确定性）
 * @returns {object} 惊喜时刻管理器实例
 */
function createSurpriseMomentManager(options = {}) {
  const rng = options.rng || Math.random;

  // 惊喜 ID 自增计数器（保证同一实例内 ID 唯一）
  let surpriseIdCounter = 0;

  return {
    /**
     * 基于概率决定是否触发惊喜时刻
     * @param {number} sessionCount - 当前会话序号
     * @returns {boolean} 是否触发
     */
    shouldTrigger(sessionCount) {
      // 至少见过 2 次面才有惊喜
      if (sessionCount < MIN_SESSION_COUNT) {
        return false;
      }
      return rng() < TRIGGER_PROBABILITY;
    },

    /**
     * 生成惊喜时刻
     * @param {number} sessionCount - 当前会话序号
     * @param {object|null} [childProfile=null] - 孩子画像 { nickname }
     * @returns {{ triggered: boolean, surpriseType: string, surpriseText: string, surpriseId: string }}
     */
    generateSurprise(sessionCount, childProfile) {
      // 未触发时返回空结构
      const notTriggered = {
        triggered: false,
        surpriseType: '',
        surpriseText: '',
        surpriseId: ''
      };

      if (!this.shouldTrigger(sessionCount)) {
        return notTriggered;
      }

      // 触发：随机选择事件类型
      const eventIdx = Math.floor(rng() * SURPRISE_POOL.length);
      const event = SURPRISE_POOL[eventIdx];

      // 解析昵称
      const nickname = (childProfile && childProfile.nickname) || DEFAULT_NICKNAME;

      // 随机选择台词变体
      const lineIdx = Math.floor(rng() * event.texts.length);
      const surpriseText = fillTemplate(event.texts[lineIdx], nickname);

      surpriseIdCounter += 1;

      return {
        triggered: true,
        surpriseType: event.type,
        surpriseText,
        surpriseId: `surprise-${surpriseIdCounter}`
      };
    },

    /**
     * 获取所有可用的事件类型名称
     * @returns {string[]}
     */
    getSurpriseTypes() {
      return SURPRISE_POOL.map(e => e.type);
    },

    /**
     * 获取所有惊喜事件
     * @returns {object[]}
     */
    getSurprisePool() {
      return SURPRISE_POOL;
    }
  };
}

module.exports = {
  createSurpriseMomentManager
};
