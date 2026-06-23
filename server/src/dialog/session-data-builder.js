/**
 * 会话数据构建器 - Issue #8 每日拼音教学
 *
 * 参考PRD §4.2 session_data 结构：
 *   date, story_stage, subject, items_learned, mastery_status,
 *   child_mood, chat_frequency, teaching_method_used,
 *   duration_minutes, child_spontaneous_remarks
 *
 * 职责：
 *   1. 构建符合 PRD §4.2 定义的 session_data JSON 结构
 *   2. 为缺失字段提供合理默认值
 *   3. 增量捕获孩子自发话语（child_spontaneous_remarks）
 *   4. 从上下文对象便捷构建 session_data（buildFromContext）
 *
 * 每次教学结束输出 session_data JSON（结构符合 PRD 定义）
 */

/**
 * 创建会话数据构建器实例
 * @param {object} [options] - 选项（预留扩展）
 * @returns {object} 会话数据构建器实例
 */
function createSessionDataBuilder(options = {}) {
  // 内部追踪的孩子自发话语列表
  let spontaneousRemarks = [];

  return {
    /**
     * 构建 session_data JSON
     * @param {object} params - 会话参数
     * @param {string} [params.storyStage] - 故事阶段
     * @param {string} [params.subject] - 学科
     * @param {string[]} [params.itemsLearned] - 已学项目
     * @param {object} [params.masteryStatus] - 掌握状态
     * @param {string} [params.childMood] - 孩子情绪
     * @param {number} [params.chatFrequency] - 孩子回应次数
     * @param {string} [params.teachingMethod] - 使用的教学法
     * @param {number} [params.durationMinutes] - 会话时长（分钟）
     * @param {string[]} [params.childSpontaneousRemarks] - 孩子自发话语
     * @returns {object} 符合 PRD §4.2 的 session_data 对象
     */
    buildSessionData(params = {}) {
      return {
        date: new Date().toISOString(),
        story_stage: params.storyStage ?? 'letter_stone',
        subject: params.subject ?? 'pinyin',
        items_learned: params.itemsLearned ?? [],
        mastery_status: params.masteryStatus ?? {},
        child_mood: params.childMood ?? 'neutral',
        chat_frequency: params.chatFrequency ?? 0,
        teaching_method_used: params.teachingMethod ?? 'direct',
        duration_minutes: params.durationMinutes ?? 0,
        child_spontaneous_remarks: params.childSpontaneousRemarks ?? []
      };
    },

    /**
     * 增量添加孩子自发话语（非学习相关信息）
     * 用于在教学过程中逐步捕获孩子说出的话语
     * @param {string} remark - 孩子自发话语
     */
    addSpontaneousRemark(remark) {
      spontaneousRemarks.push(remark);
    },

    /**
     * 获取已捕获的孩子自发话语列表
     * @returns {string[]}
     */
    getSpontaneousRemarks() {
      return spontaneousRemarks;
    },

    /**
     * 清空内部状态（自发话语列表）
     * 用于会话结束后重置构建器，准备下一次会话
     */
    reset() {
      spontaneousRemarks = [];
    },

    /**
     * 从上下文对象便捷构建 session_data
     * 上下文中未提供的字段使用默认值
     * 若未提供 childSpontaneousRemarks，则使用内部增量捕获的自发话语
     * @param {object} [context] - 上下文对象（字段同 buildSessionData 的 params）
     * @returns {object} 符合 PRD §4.2 的 session_data 对象
     */
    buildFromContext(context = {}) {
      // 未显式提供 childSpontaneousRemarks 时，使用内部追踪的自发话语
      const params = { ...context };
      if (params.childSpontaneousRemarks === undefined) {
        params.childSpontaneousRemarks = [...spontaneousRemarks];
      }
      return this.buildSessionData(params);
    }
  };
}

module.exports = {
  createSessionDataBuilder
};
