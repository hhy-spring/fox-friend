/**
 * 会话管理器 - WebSocket 语音端点的会话状态管理
 *
 * 参考技术架构文档§四「关键API」：
 *   WS `/ws/voice/{child_id}` - 语音双向流（核心）
 *   POST `/api/session/start` - 开始会话
 *   POST `/api/session/end` - 结束会话，输出数据
 *
 * 参考技术架构文档§二「Redis 缓存」：
 *   实时状态管理，TTL=30min（MVP 阶段用内存 Map 替代 Redis）
 */

const { v4: uuidv4 } = require('uuid');
const { createDialogFSM, DIALOG_STATES } = require('../dialog/fsm');
const { detectReaction, getStepDialog, REACTION_TYPES } = require('../dialog/dialog-engine');
const { NAME_HINTS, getNameHints, getNameHintsLine } = require('../dialog/name-hints');
const { processChildInput } = require('../dialog/name-processor');
const { createNamingCeremony } = require('../dialog/naming-ceremony');

/**
 * 根据狐狸名字推导兴趣类型
 * 参考技术架构文档§八「兴趣分型映射」
 *
 * @param {string} foxName - 狐狸名字
 * @returns {string} 兴趣类型
 */
function deriveInterestType(foxName) {
  if (!foxName) return 'generic';
  for (const hint of NAME_HINTS) {
    if (foxName.includes(hint.character)) {
      return hint.interestType;
    }
  }
  return 'generic';
}

/**
 * 创建会话管理器
 * @returns {object} 会话管理器实例
 */
function createSessionManager() {
  // 内存存储（MVP 阶段替代 Redis，架构文档§九技术债务：日活>100 时迁移）
  const sessions = new Map();

  return {
    /**
     * 创建新会话
     * @param {string} childId - 孩子 ID
     * @returns {object} 会话对象
     */
    createSession(childId) {
      const id = uuidv4();
      const fsm = createDialogFSM();
      const session = {
        id,
        childId,
        fsm,
        fsmState: fsm.getState(),
        profile: {},
        proactiveSpeechCount: 0,
        createdAt: Date.now()
      };
      sessions.set(id, session);
      return session;
    },

    /**
     * 获取会话
     * @param {string} sessionId
     * @returns {object|null}
     */
    getSession(sessionId) {
      return sessions.get(sessionId) || null;
    },

    /**
     * 更新会话 FSM 状态
     * @param {string} sessionId
     * @param {string} newState
     */
    updateState(sessionId, newState) {
      const session = sessions.get(sessionId);
      if (session) {
        session.fsm.transition(newState);
        session.fsmState = session.fsm.getState();
      }
    },

    /**
     * 更新会话画像数据
     * @param {string} sessionId
     * @param {object} profileData
     */
    updateProfile(sessionId, profileData) {
      const session = sessions.get(sessionId);
      if (session) {
        session.profile = { ...session.profile, ...profileData };
      }
    },

    /**
     * 递增主动说话次数
     * @param {string} sessionId
     */
    incrementProactiveSpeech(sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        session.proactiveSpeechCount += 1;
      }
    }
  };
}

/**
 * 处理语音消息
 * 参考技术架构文档§三「语音交互管道」：
 *   Child voice → WebAudio → WebSocket → ASR → LLM → TTS → WebSocket → Playback
 *
 * @param {object} sessionManager - 会话管理器
 * @param {string} sessionId - 会话 ID
 * @param {object} message - 语音消息 { type, responseTimeMs, content }
 * @returns {object} 处理结果
 */
function handleVoiceMessage(sessionManager, sessionId, message) {
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`会话 ${sessionId} 不存在`);
  }

  const currentState = session.fsmState;

  // 检测孩子反应类型
  const reaction = detectReaction({
    responseTimeMs: message.responseTimeMs || 0,
    content: message.content || ''
  });

  // 有实质内容 → 递增主动说话次数
  if (message.content && message.content.trim().length > 0) {
    sessionManager.incrementProactiveSpeech(sessionId);
  }

  // 步骤1：出场
  if (currentState === DIALOG_STATES.APPEARANCE) {
    const dialog = getStepDialog(DIALOG_STATES.APPEARANCE, reaction);
    sessionManager.updateState(sessionId, DIALOG_STATES.HELP_REQUEST);

    return {
      dialog,
      reaction,
      nextState: DIALOG_STATES.HELP_REQUEST,
      stepInfo: session.fsm.getStepInfo()
    };
  }

  // 步骤2：求助
  if (currentState === DIALOG_STATES.HELP_REQUEST) {
    const dialog = getStepDialog(DIALOG_STATES.HELP_REQUEST, reaction);

    // 检查孩子是否提供了名字
    const nameResult = processChildInput({
      childContent: message.content,
      currentStep: currentState,
      fsm: session.fsm
    });

    if (nameResult.nameRecorded) {
      // 名字已提供 → 记录并转换状态
      sessionManager.updateProfile(sessionId, {
        foxName: nameResult.foxName,
        foxNameSource: nameResult.nameSource
      });
      sessionManager.updateState(sessionId, DIALOG_STATES.NAMING_CEREMONY);

      return {
        dialog,
        reaction,
        nameRecorded: true,
        foxName: nameResult.foxName,
        nameSource: nameResult.nameSource,
        skipHints: nameResult.skipHints,
        nextState: DIALOG_STATES.NAMING_CEREMONY,
        stepInfo: session.fsm.getStepInfo()
      };
    }

    // 名字未提供 → 显示暗示
    const hints = getNameHints();
    const hintLine = getNameHintsLine(hints);

    return {
      dialog,
      reaction,
      nameRecorded: false,
      showHints: true,
      hints,
      hintLine,
      nextState: currentState,
      stepInfo: session.fsm.getStepInfo()
    };
  }

  // 步骤3：命名仪式
  // 参考PRD §4.1 步骤3：命名仪式 - 崇拜式回应 + 4步画像采集
  if (currentState === DIALOG_STATES.NAMING_CEREMONY) {
    // 获取或创建仪式实例
    let ceremony = session.ceremony;

    if (!ceremony) {
      // 首次进入 NAMING_CEREMONY - 创建仪式实例
      const foxName = session.profile.foxName;
      const nameSource = session.profile.foxNameSource;
      const interestType = deriveInterestType(foxName);
      ceremony = createNamingCeremony(foxName, nameSource, interestType);
      session.ceremony = ceremony;

      // 返回崇拜式回应
      const worshipDialog = ceremony.getWorshipResponse();
      return {
        dialog: worshipDialog,
        reaction,
        ceremonySubState: ceremony.getSubState(),
        nextState: DIALOG_STATES.NAMING_CEREMONY,
        stepInfo: session.fsm.getStepInfo()
      };
    }

    // 仪式已存在 - 处理孩子的回答
    if (message.content && message.content.trim().length > 0) {
      ceremony.incrementProactiveSpeech();
    }

    const result = ceremony.processAnswer(message.content || '');

    // 检查仪式是否完成
    if (result.isComplete) {
      // 更新会话画像数据
      const ceremonyProfile = ceremony.getProfile();
      sessionManager.updateProfile(sessionId, {
        nickname: ceremonyProfile.nickname,
        age: ceremonyProfile.age,
        interests: ceremonyProfile.interests,
        selfClaimedSkills: ceremonyProfile.selfClaimedSkills,
        proactiveSpeechCountInCeremony: ceremony.getProactiveSpeechCount()
      });

      // 转换到 FEYNMAN_TRIGGER
      sessionManager.updateState(sessionId, DIALOG_STATES.FEYNMAN_TRIGGER);

      return {
        dialog: null,
        reaction,
        ceremonyComplete: true,
        profile: ceremonyProfile,
        proactiveSpeechCount: ceremony.getProactiveSpeechCount(),
        nextState: DIALOG_STATES.FEYNMAN_TRIGGER,
        stepInfo: session.fsm.getStepInfo()
      };
    }

    // 返回下一个问题
    const nextQuestion = ceremony.getCurrentQuestion();
    return {
      dialog: nextQuestion,
      reaction,
      ceremonySubState: result.nextSubState,
      collectedField: result.field,
      collectedValue: result.value,
      wasSkipped: result.skipped,
      nextState: DIALOG_STATES.NAMING_CEREMONY,
      stepInfo: session.fsm.getStepInfo()
    };
  }

  // 其他步骤（Issue #2-#5 范围，暂返回当前状态信息）
  return {
    dialog: null,
    reaction,
    nextState: currentState,
    stepInfo: session.fsm.getStepInfo()
  };
}

module.exports = { createSessionManager, handleVoiceMessage, deriveInterestType };
