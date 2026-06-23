/**
 * 互惠暴露管理器 - Issue #10 关系保鲜机制
 *
 * 参考Issue #10 验收标准：
 *   - 互惠暴露：session_count % 5 == 0 → 小狐狸主动分享秘密或脆弱
 *   - 互惠暴露台词不重复，至少 10 个候选池随机选
 *   - 所有保鲜机制不与教学内容冲突，嵌入在对话开场或结尾
 *
 * 职责：
 *   1. 判定当前会话是否应触发互惠暴露（sessionCount % 5 === 0 且 > 0）
 *   2. 从候选池随机选取一条台词，已使用台词不再选用，池子用完才重置
 *   3. 提供候选池查询与未使用台词过滤
 */

// 互惠暴露候选台词池（至少 10 条，小狐狸主动分享秘密或脆弱）
// id 格式：exposure_{序号}，text 为台词文本
const EXPOSURE_POOL = [
  { id: 'exposure_0',  text: '其实...我有时候晚上会害怕黑漆漆的，但是有你在我就不怕了！' },
  { id: 'exposure_1',  text: '告诉你一个秘密，我偷偷藏了一颗最亮的星星，就是给你准备的！' },
  { id: 'exposure_2',  text: '我有时候会想...如果有一天你不来了怎么办？但是你来了！' },
  { id: 'exposure_3',  text: '其实我不太会唱歌，但是为了你我想学！' },
  { id: 'exposure_4',  text: '我有一个小盒子，里面装的全是我们一起冒险的回忆！' },
  { id: 'exposure_5',  text: '你知道吗？每次你教我认字的时候，我心里都特别开心！' },
  { id: 'exposure_6',  text: '有时候我会假装很勇敢，其实心里也有点紧张...' },
  { id: 'exposure_7',  text: '我偷偷告诉你，我最喜欢听你说话了！' },
  { id: 'exposure_8',  text: '其实我有时候会做噩梦，但是想到明天还能见到你就不怕了！' },
  { id: 'exposure_9',  text: '我藏了一个小秘密——每次你夸我的时候，我的尾巴都会摇得特别快！' },
  { id: 'exposure_10', text: '其实我有时候也会想家，但是有你在就是我的家！' },
  { id: 'exposure_11', text: '告诉你个秘密，我偷偷练习了好久怎么做一个好搭档！' }
];

/**
 * 创建互惠暴露管理器
 * @param {object} [options={}] - 配置选项
 * @returns {object} 互惠暴露管理器实例
 */
function createReciprocalExposureManager(options = {}) {
  return {
    /**
     * 判定当前会话是否应触发互惠暴露
     * @param {number} sessionCount - 当前会话序号
     * @returns {boolean} sessionCount % 5 === 0 且 sessionCount > 0 时返回 true
     */
    shouldTrigger(sessionCount) {
      return sessionCount > 0 && sessionCount % 5 === 0;
    },

    /**
     * 生成互惠暴露内容
     * @param {number} sessionCount - 当前会话序号
     * @param {string[]} usedExposures - 已使用的暴露 id 列表
     * @returns {{ triggered: boolean, exposureText: string, exposureId: string, poolSize: number }}
     */
    generateExposure(sessionCount, usedExposures) {
      const poolSize = EXPOSURE_POOL.length;

      // 非触发会话：返回 triggered: false
      if (!this.shouldTrigger(sessionCount)) {
        return {
          triggered: false,
          exposureText: '',
          exposureId: '',
          poolSize
        };
      }

      // 计算未使用的候选
      const usedSet = new Set(usedExposures || []);
      const available = EXPOSURE_POOL.filter(item => !usedSet.has(item.id));

      // 池子用完则回绕重置，允许重新选取
      const candidates = available.length > 0 ? available : EXPOSURE_POOL;

      // 随机选取一条
      const idx = Math.floor(Math.random() * candidates.length);
      const selected = candidates[idx];

      return {
        triggered: true,
        exposureText: selected.text,
        exposureId: selected.id,
        poolSize
      };
    },

    /**
     * 获取全部候选暴露台词
     * @returns {string[]} 候选台词文本数组
     */
    getExposurePool() {
      return EXPOSURE_POOL.map(item => item.text);
    },

    /**
     * 获取未使用的候选暴露台词
     * @param {string[]} usedExposures - 已使用的暴露 id 列表
     * @returns {string[]} 未使用的候选台词文本数组
     */
    getUnusedExposures(usedExposures) {
      const usedSet = new Set(usedExposures || []);
      return EXPOSURE_POOL
        .filter(item => !usedSet.has(item.id))
        .map(item => item.text);
    }
  };
}

module.exports = {
  createReciprocalExposureManager
};
