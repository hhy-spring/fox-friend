/**
 * 画像采集器 - 命名仪式（步骤3）中的4步画像信息采集
 *
 * 参考技术架构文档§三「对话引擎架构」Interest Brancher（名字→兴趣分型）
 * 参考PRD §4.1 步骤3：命名仪式 - 采集孩子画像信息
 *
 * 4个画像字段（按顺序采集）：
 *   1. nickname - 孩子昵称
 *   2. age - 孩子年龄
 *   3. interests - 孩子兴趣
 *   4. selfClaimedSkills - 自认能力
 *
 * 如果孩子跳过（不知道/不想说/没反应），标记为 null，不再追问
 */

// 画像字段定义
const PROFILE_FIELDS = [
  { field: 'nickname', label: '昵称' },
  { field: 'age', label: '年龄' },
  { field: 'interests', label: '兴趣' },
  { field: 'selfClaimedSkills', label: '自认能力' }
];

/**
 * 创建画像采集器实例
 * @returns {object} 采集器对象
 */
function createProfileCollector() {
  // 已采集的数据
  const collected = {};
  // 当前字段索引
  let currentIndex = 0;
  // 已完成的字段数
  let completedCount = 0;

  const total = PROFILE_FIELDS.length;

  return {
    /**
     * 获取当前待采集的字段信息
     * @returns {{ field: string, label: string, index: number, total: number } | null}
     *   返回 null 表示所有字段已采集完毕
     */
    getCurrentField() {
      if (currentIndex >= total) {
        return null;
      }
      const fieldDef = PROFILE_FIELDS[currentIndex];
      return {
        field: fieldDef.field,
        label: fieldDef.label,
        index: currentIndex,
        total
      };
    },

    /**
     * 采集某个字段的答案
     * @param {string} field - 字段名
     * @param {*} value - 采集到的值
     * @returns {{ field: string, value: *, nextField: object|null, isComplete: boolean }}
     */
    collectAnswer(field, value) {
      // 验证字段顺序
      const expectedField = PROFILE_FIELDS[currentIndex]?.field;
      if (field !== expectedField) {
        throw new Error(
          `字段顺序错误：期望采集「${expectedField}」，实际收到「${field}」`
        );
      }

      collected[field] = value;
      currentIndex++;
      completedCount++;

      const nextField = currentIndex < total
        ? { field: PROFILE_FIELDS[currentIndex].field, label: PROFILE_FIELDS[currentIndex].label, index: currentIndex, total }
        : null;

      return {
        field,
        value,
        nextField,
        isComplete: currentIndex >= total
      };
    },

    /**
     * 标记某个字段为跳过（存储 null）
     * @param {string} field - 字段名
     * @returns {{ field: string, value: null, nextField: object|null, isComplete: boolean }}
     */
    markSkipped(field) {
      return this.collectAnswer(field, null);
    },

    /**
     * 判断所有字段是否已采集完毕
     * @returns {boolean}
     */
    isComplete() {
      return currentIndex >= total;
    },

    /**
     * 获取已采集的所有数据
     * @returns {{ nickname: *, age: *, interests: *, selfClaimedSkills: * }}
     */
    getCollectedData() {
      return {
        nickname: collected.nickname ?? null,
        age: collected.age ?? null,
        interests: collected.interests ?? null,
        selfClaimedSkills: collected.selfClaimedSkills ?? null
      };
    },

    /**
     * 获取采集进度
     * @returns {{ current: number, total: number, percentage: number }}
     */
    getProgress() {
      return {
        current: currentIndex,
        total,
        percentage: Math.round((currentIndex / total) * 100)
      };
    },

    /**
     * 获取已完成的字段数（已回答或已跳过）
     * @returns {number}
     */
    getCompletedCount() {
      return completedCount;
    }
  };
}

/**
 * 构建最终的画像数据结构（用于存储）
 * 参考PRD §4.1 步骤3 画像数据结构
 * 参考Issue #3：新增 interests_derived_from_fox_name 字段（兴趣关键词从狐狸名字中提取）
 *
 * @param {object} collectedData - 采集器返回的原始数据
 * @param {string} foxName - 狐狸名字
 * @param {string} foxNameSource - 名字来源（child_choice | fox_suggestion）
 * @param {number} proactiveSpeechCount - 主动发言次数
 * @param {string[]} [interestsDerivedFromFoxName] - 从狐狸名字提取的兴趣关键词（Issue #3）
 * @returns {object} 完整画像数据
 */
function buildProfile(collectedData, foxName, foxNameSource, proactiveSpeechCount, interestsDerivedFromFoxName = []) {
  return {
    nickname: collectedData.nickname,
    age: collectedData.age,
    interests: collectedData.interests,
    self_claimed_skills: collectedData.selfClaimedSkills,
    fox_name: foxName,
    fox_name_source: foxNameSource,
    interests_derived_from_fox_name: interestsDerivedFromFoxName,
    first_meeting_reactions: {
      proactive_speech_count: proactiveSpeechCount
    }
  };
}

module.exports = { PROFILE_FIELDS, createProfileCollector, buildProfile };
