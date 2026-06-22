/**
 * 台词分型引擎集成模块 - Issue #3 核心集成层
 *
 * 参考技术架构文档§三「对话引擎架构」：
 *   FSM Router → LLM Generator → Emotion Adjuster → Interest Brancher
 *
 * 职责：
 *   1. 整合兴趣分型引擎（interest-classifier）与会话上下文（session-context）
 *   2. 提供步骤3-5台词的统一访问入口，按兴趣分型输出对应台词
 *   3. 构建包含 interests_derived_from_fox_name 字段的完整画像
 *   4. 作为 Issue #3 台词分型引擎的对外统一 API
 *
 * 依赖模块：
 *   - interest-classifier.js  兴趣关键词提取与分类
 *   - session-context.js      会话上下文管理
 *   - step3-templates.js       步骤3 命名仪式+画像采集台词
 *   - step4-templates.js       步骤4 费曼触发台词
 *   - step5-templates.js       步骤5 搭档确认台词
 *   - profile-collector.js     画像数据结构构建
 */

const { classifyInterest, INTEREST_TYPES } = require('./interest-classifier');
const { createSessionContext } = require('./session-context');
const { getStep3Dialog } = require('./step3-templates');
const { getStep4Dialog } = require('./step4-templates');
const { getStep5Dialog } = require('./step5-templates');

/**
 * 创建台词分型引擎实例（集成入口）
 * @param {string} foxName - 孩子起的狐狸名字
 * @param {string} childId - 孩子 ID
 * @returns {object} 台词分型引擎实例
 */
function createDialogueBrancher(foxName, childId) {
  // 运行兴趣分型
  const classificationResult = classifyInterest(foxName);
  const interestType = classificationResult.type;

  // 创建会话上下文并存储分型结果
  const sessionContext = createSessionContext(childId);
  sessionContext.setFoxName(foxName);

  return {
    /**
     * 获取当前兴趣分型类型
     * @returns {string} 'dinosaur' | 'princess' | 'speed' | 'generic'
     */
    getInterestType() {
      return interestType;
    },

    /**
     * 获取兴趣分型完整结果
     * @returns {object} 分类结果 { type, keywords, matchedTerms, foxName, isClassified }
     */
    getClassificationResult() {
      return classificationResult;
    },

    /**
     * 获取步骤3台词（命名仪式+画像采集）
     * @param {string} subState - 子状态（WORSHIP/ASK_NICKNAME/ASK_AGE/ASK_INTERESTS/ASK_SKILLS/COMPLETE）
     * @returns {object|null} 台词对象
     */
    getStep3Dialog(subState) {
      return getStep3Dialog(interestType, foxName, subState);
    },

    /**
     * 获取步骤4台词（费曼触发）
     * @param {string} [childResponse] - 孩子反应：'correct' | 'unsure' | 'refuse'（可选）
     * @returns {object} 触发台词或反馈台词
     */
    getStep4Dialog(childResponse) {
      if (childResponse === undefined) {
        return getStep4Dialog(interestType, foxName);
      }
      return getStep4Dialog(interestType, foxName, childResponse);
    },

    /**
     * 获取步骤5台词（搭档确认）
     * @param {string} [childResponse] - 孩子反应：'accept' | 'hesitate' | 'refuse'（可选）
     * @returns {object} 邀请台词或回应台词
     */
    getStep5Dialog(childResponse) {
      if (childResponse === undefined) {
        return getStep5Dialog(interestType, foxName);
      }
      return getStep5Dialog(interestType, foxName, childResponse);
    },

    /**
     * 获取会话上下文实例
     * @returns {object} 会话上下文
     */
    getSessionContext() {
      return sessionContext;
    },

    /**
     * 获取 interests_derived_from_fox_name 字段值
     * @returns {string[]} 兴趣关键词数组（generic 为空数组）
     */
    getInterestsDerivedFromFoxName() {
      return sessionContext.getInterestsDerivedFromFoxName();
    },

    /**
     * 构建包含兴趣分型字段的完整画像
     * 整合 profile-collector 的 buildProfile 与 interests_derived_from_fox_name
     * @param {object} collectedData - 采集器返回的原始数据
     * @param {string} foxName - 狐狸名字
     * @param {string} foxNameSource - 名字来源
     * @param {number} proactiveSpeechCount - 主动发言次数
     * @returns {object} 完整画像数据（含 interests_derived_from_fox_name）
     */
    buildProfileWithInterest(collectedData, foxName, foxNameSource, proactiveSpeechCount) {
      return {
        nickname: collectedData.nickname,
        age: collectedData.age,
        interests: collectedData.interests,
        self_claimed_skills: collectedData.selfClaimedSkills,
        fox_name: foxName,
        fox_name_source: foxNameSource,
        interests_derived_from_fox_name: sessionContext.getInterestsDerivedFromFoxName(),
        first_meeting_reactions: {
          proactive_speech_count: proactiveSpeechCount
        }
      };
    }
  };
}

module.exports = {
  createDialogueBrancher
};
