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
const { detectReaction, getStepDialog } = require('../dialog/dialog-engine');
const { getNameHints, getNameHintsLine } = require('../dialog/name-hints');
const { processChildInput } = require('../dialog/name-processor');
const { createNamingCeremony } = require('../dialog/naming-ceremony');
const { classifyInterest } = require('../dialog/interest-classifier');

/**
 * 根据狐狸名字推导兴趣类型
 * 参考技术架构文档§八「兴趣分型映射」
 *
 * Issue #18 修复：使用 classifyInterest（Issue #3 完整关键词库）替代旧 NAME_HINTS 单字匹配
 * 保留函数签名以兼容现有测试，内部委托 classifyInterest
 *
 * @param {string} foxName - 狐狸名字
 * @returns {string} 兴趣类型
 */
function deriveInterestType(foxName) {
  return classifyInterest(foxName).type;
}

/**
 * 为会话创建命名仪式实例（Issue #18 重构：消除重复代码）
 * 统一兴趣分型 + 仪式创建 + 会话状态更新
 *
 * @param {object} session - 会话对象
 * @param {string} foxName - 狐狸名字
 * @param {string} nameSource - 名字来源
 * @returns {object} 命名仪式实例
 */
function createCeremonyForSession(session, foxName, nameSource) {
  const classificationResult = classifyInterest(foxName);
  const interestType = classificationResult.type;
  const ceremony = createNamingCeremony(foxName, nameSource, interestType);

  session.ceremony = ceremony;
  session.interestType = interestType;
  session.classificationResult = classificationResult;

  return ceremony;
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
    // 检查孩子是否提供了名字
    const nameResult = processChildInput({
      childContent: message.content,
      currentStep: currentState,
      fsm: session.fsm
    });

    if (nameResult.nameRecorded) {
      // Issue #18 修复：名字已提供 → 立即创建命名仪式并返回崇拜回应
      // （旧实现返回 HELP_REQUEST 台词，导致兴趣分型台词未在 WebSocket 流中触发）
      const foxName = nameResult.foxName;
      const nameSource = nameResult.nameSource;

      // 创建命名仪式实例（统一兴趣分型入口）
      const ceremony = createCeremonyForSession(session, foxName, nameSource);

      // 记录画像数据到会话
      sessionManager.updateProfile(sessionId, {
        foxName,
        foxNameSource: nameSource
      });

      // 转换到 NAMING_CEREMONY 状态
      sessionManager.updateState(sessionId, DIALOG_STATES.NAMING_CEREMONY);

      // Issue #19 修复：崇拜回应已在此返回，推进仪式从 WORSHIP 到 ASK_NICKNAME
      // 这样孩子的下一条消息会直接作为昵称回答处理，而非被 WORSHIP 转换消费
      const worshipDialog = ceremony.getWorshipResponse();
      ceremony.startCollection();
      const nextQuestion = ceremony.getCurrentQuestion();

      return {
        dialog: worshipDialog,
        nextQuestion,
        reaction,
        nameRecorded: true,
        foxName,
        nameSource,
        skipHints: nameResult.skipHints,
        interestType: session.interestType,
        ceremonySubState: ceremony.getSubState(),
        nextState: DIALOG_STATES.NAMING_CEREMONY,
        stepInfo: session.fsm.getStepInfo()
      };
    }

    // 名字未提供 → 返回求助台词 + 显示暗示
    const dialog = getStepDialog(DIALOG_STATES.HELP_REQUEST, reaction);
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
      // Fallback：仪式未在 HELP_REQUEST 阶段创建（如手动状态转换）
      // Issue #18：使用 createCeremonyForSession 统一兴趣分型入口
      ceremony = createCeremonyForSession(
        session,
        session.profile.foxName,
        session.profile.foxNameSource
      );

      // Issue #19: 推进仪式从 WORSHIP 到 ASK_NICKNAME，与主路径保持一致
      const worshipDialog = ceremony.getWorshipResponse();
      ceremony.startCollection();
      const nextQuestion = ceremony.getCurrentQuestion();

      return {
        dialog: worshipDialog,
        nextQuestion,
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
