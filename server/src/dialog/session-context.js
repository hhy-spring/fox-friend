/**
 * 会话上下文管理器 - Issue #3 台词分型引擎
 *
 * 参考技术架构文档§三「对话引擎架构」
 * 参考技术架构文档§八「兴趣分型映射」
 *
 * 职责：
 *   1. 管理会话上下文，存储兴趣分型结果
 *   2. 提供画像字段集成（interests_derived_from_fox_name）
 *   3. 确保分型结果在后续所有教学会话中可用
 *   4. 与已有画像数据结构合并
 */

const {
  classifyInterest,
  INTEREST_TYPES
} = require('./interest-classifier');

/**
 * 创建会话上下文实例
 * @param {string} childId - 孩子 ID
 * @returns {object} 会话上下文实例
 */
function createSessionContext(childId) {
  // 孩子起的狐狸名字
  let foxName = null;
  // 兴趣分型结果
  let classificationResult = null;

  return {
    /**
     * 设置狐狸名字并自动运行兴趣分型
     * @param {string} name - 孩子起的狐狸名字
     */
    setFoxName(name) {
      foxName = name;
      classificationResult = classifyInterest(name);
    },

    /**
     * 获取当前兴趣分型类型
     * @returns {string} 兴趣类型（dinosaur | princess | speed | generic）
     */
    getInterestType() {
      if (!classificationResult) {
        return INTEREST_TYPES.GENERIC;
      }
      return classificationResult.type;
    },

    /**
     * 获取匹配到的兴趣关键词
     * @returns {string[]} 匹配关键词数组
     */
    getInterestKeywords() {
      if (!classificationResult) {
        return [];
      }
      return classificationResult.keywords;
    },

    /**
     * 判断是否已成功分类（非 generic 类型）
     * @returns {boolean}
     */
    isClassified() {
      if (!classificationResult) {
        return false;
      }
      return classificationResult.isClassified;
    },

    /**
     * 生成 child_profile.interests_derived_from_fox_name 字段值
     * 返回从狐狸名字中提取的兴趣关键词数组
     * generic 类型返回空数组
     * @returns {string[]}
     */
    getInterestsDerivedFromFoxName() {
      if (!classificationResult) {
        return [];
      }
      return classificationResult.keywords;
    },

    /**
     * 获取完整的兴趣分型结果
     * @returns {object|null} 分型结果对象（未分类时返回 null）
     */
    getClassificationResult() {
      return classificationResult;
    },

    /**
     * 返回可合并到 child_profile 的字段对象
     * 用于存储 interests_derived_from_fox_name 字段
     * @returns {{ interests_derived_from_fox_name: string[] }}
     */
    toProfileField() {
      return {
        interests_derived_from_fox_name: this.getInterestsDerivedFromFoxName()
      };
    },

    /**
     * 返回可序列化的会话上下文对象
     * 包含 childId、狐狸名字和分型数据，便于持久化存储
     * @returns {object}
     */
    toJSON() {
      return {
        childId,
        foxName,
        interestType: this.getInterestType(),
        isClassified: this.isClassified(),
        keywords: this.getInterestKeywords()
      };
    }
  };
}

module.exports = {
  createSessionContext
};
