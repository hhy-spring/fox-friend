/**
 * 语气渐变弧线管理器 - Issue #7 每日见面开场
 *
 * 参考PRD §4.5.3 变化四: 语气的渐变弧线
 *   第1次见面：紧张试探 → 脆弱 → 被接纳后惊喜
 *   第2-3次：  熟悉 + 依赖 → 「你是我唯一的搭档」
 *   第4-7次：  默契 → 可以开玩笑、打赌
 *   第8次+：   老夫老妻 → 偶尔不示弱直接推进、偶尔惊喜打破惯性
 *
 * 职责：
 *   1. 根据见面次数判定当前语气阶段
 *   2. 提供各阶段的脆弱程度
 *   3. 提供语气修饰符（能否开玩笑/打赌/跳过示弱/制造惊喜）
 *   4. 提供阶段描述文本
 */

// 语气阶段常量
const TONE_PHASES = {
  FIRST_MEETING: 'first_meeting',
  FAMILIAR: 'familiar',
  TACIT: 'tacit',
  OLD_PARTNERS: 'old_partners'
};

// 语气阶段定义表
// - minSession: 该阶段起始见面次数（含）
// - phaseName: 阶段中文名
// - vulnerabilityLevel: 脆弱程度
// - description: 阶段语气描述
// - modifiers: 语气修饰符
const TONE_PHASE_DEFINITIONS = [
  {
    phase: TONE_PHASES.FIRST_MEETING,
    phaseName: '紧张试探',
    minSession: 1,
    vulnerabilityLevel: 'high',
    description: '紧张试探 → 脆弱 → 被接纳后惊喜',
    modifiers: {
      canJoke: false,
      canBet: false,
      canSkipVulnerability: false,
      canSurprise: false
    }
  },
  {
    phase: TONE_PHASES.FAMILIAR,
    phaseName: '熟悉依赖',
    minSession: 2,
    vulnerabilityLevel: 'moderate',
    description: '熟悉 + 依赖 → 「你是我唯一的搭档」',
    modifiers: {
      canJoke: false,
      canBet: false,
      canSkipVulnerability: false,
      canSurprise: false
    }
  },
  {
    phase: TONE_PHASES.TACIT,
    phaseName: '默契',
    minSession: 4,
    vulnerabilityLevel: 'low',
    description: '默契 → 可以开玩笑、打赌',
    modifiers: {
      canJoke: true,
      canBet: true,
      canSkipVulnerability: false,
      canSurprise: false
    }
  },
  {
    phase: TONE_PHASES.OLD_PARTNERS,
    phaseName: '老夫老妻',
    minSession: 8,
    vulnerabilityLevel: 'minimal',
    description: '老夫老妻 → 偶尔不示弱直接推进、偶尔惊喜打破惯性',
    modifiers: {
      canJoke: true,
      canBet: true,
      canSkipVulnerability: true,
      canSurprise: true
    }
  }
];

/**
 * 根据见面次数解析对应的阶段定义
 * @param {number} sessionCount - 见面次数（从1开始）
 * @returns {object} 阶段定义对象
 */
function resolvePhaseDefinition(sessionCount) {
  // 边界处理：不足1次或非法值，按第1次处理
  const count = (!Number.isFinite(sessionCount) || sessionCount < 1) ? 1 : sessionCount;

  // 从后向前匹配：找到第一个 minSession <= count 的阶段
  for (let i = TONE_PHASE_DEFINITIONS.length - 1; i >= 0; i -= 1) {
    if (count >= TONE_PHASE_DEFINITIONS[i].minSession) {
      return TONE_PHASE_DEFINITIONS[i];
    }
  }
  return TONE_PHASE_DEFINITIONS[0];
}

/**
 * 创建语气渐变弧线管理器
 * @returns {object} 语气渐变弧线管理器实例
 */
function createToneEvolutionManager() {
  return {
    /**
     * 根据见面次数返回语气阶段对象
     * @param {number} sessionCount - 见面次数
     * @returns {object} 阶段对象，包含 phase, phaseName, vulnerabilityLevel, description
     */
    getTonePhase(sessionCount) {
      const def = resolvePhaseDefinition(sessionCount);
      return {
        phase: def.phase,
        phaseName: def.phaseName,
        vulnerabilityLevel: def.vulnerabilityLevel,
        description: def.description
      };
    },

    /**
     * 获取脆弱程度
     * @param {number} sessionCount - 见面次数
     * @returns {'high' | 'moderate' | 'low' | 'minimal'} 脆弱程度
     */
    getVulnerabilityLevel(sessionCount) {
      return resolvePhaseDefinition(sessionCount).vulnerabilityLevel;
    },

    /**
     * 获取语气修饰符
     * @param {number} sessionCount - 见面次数
     * @returns {{ canJoke: boolean, canBet: boolean, canSkipVulnerability: boolean, canSurprise: boolean }}
     */
    getToneModifiers(sessionCount) {
      const def = resolvePhaseDefinition(sessionCount);
      return { ...def.modifiers };
    },

    /**
     * 获取语气描述
     * @param {number} sessionCount - 见面次数
     * @returns {string} 描述文本
     */
    getToneDescription(sessionCount) {
      return resolvePhaseDefinition(sessionCount).description;
    }
  };
}

module.exports = {
  TONE_PHASES,
  createToneEvolutionManager
};
