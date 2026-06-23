/**
 * WebSocket 语音处理器 — 集成语音管道到WebSocket通信
 *
 * 参考Issue #6验收标准：
 *   - 语音输入采集正常（适配 4-7 岁儿童发音特点）
 *   - 打断机制：检测到孩子声音 → 立即停止当前 TTS 播放 → 进入新一轮对话
 *
 * 参考技术架构文档§四：
 *   WS `/ws/voice/{child_id}` - 语音双向流（核心）
 *
 * 参考技术架构文档§三「语音交互管道」：
 *   Child voice → WebAudio → WebSocket → ASR(300ms) → LLM(800ms) → TTS(500ms) → WebSocket → Playback
 */

const { WebSocketServer } = require('ws');
const { createVoicePipeline, PIPELINE_EVENTS } = require('./voice-pipeline');
const { createASREngine } = require('./asr-engine');
const { createTTSEngine, TTS_EMOTIONS } = require('./tts-engine');
const { createVAD } = require('./vad');
const { createSessionManager, handleVoiceMessage } = require('./session-manager');
const { detectReaction, getStepDialog, REACTION_TYPES } = require('../dialog/dialog-engine');
const { getNameHints, getNameHintsLine } = require('../dialog/name-hints');
const { processChildInput } = require('../dialog/name-processor');
const { loadProfile } = require('../dialog/profile-persistence');
const { createSessionStateManager } = require('../dialog/session-state');
const { createDailyMeetingOrchestrator } = require('../dialog/daily-meeting-orchestrator');
// Issue #24：借分契约机制接入 WebSocket 流
const { createBorrowContractPersistence } = require('../dialog/borrow-contract-persistence');
const { createBorrowContractState, BORROW_STATES } = require('../dialog/borrow-contract-state');
const { createBorrowContractOrchestrator } = require('../dialog/borrow-contract-orchestrator');
const { classifyChildState, CHILD_STATES } = require('../dialog/child-state-classifier');
const { findMatchedKeyword } = require('../dialog/keyword-matcher');

// Issue #24：low 状态下进一步区分「累了」与「畏难」，喂给 borrow-contract-state.recordRefusal
const TIRED_KEYWORDS = ['累了', '困了', '不想玩', '难过'];
const DIFFICULT_KEYWORDS = ['太难', '不会', '不懂', '不开心'];

/**
 * 统一发送错误响应（标准化错误处理，消除重复的 ws.send(JSON.stringify({type:'error',...})) ）
 * @param {WebSocket} ws
 * @param {string} message - 错误信息
 */
function sendError(ws, message) {
  ws.send(JSON.stringify({ type: 'error', message }));
}

/**
 * 将孩子的文本反应映射为借分契约的 refusalType
 * @param {string} text - 孩子文本
 * @returns {'rebellious'|'tired'|'difficult'|'neutral'}
 */
function classifyRefusalType(text) {
  const t = (text || '').trim();
  if (!t) return 'neutral';
  const classification = classifyChildState(t);
  if (classification.state === CHILD_STATES.REBELLIOUS) return 'rebellious';
  if (classification.state === CHILD_STATES.LOW) {
    if (findMatchedKeyword(t, TIRED_KEYWORDS)) return 'tired';
    if (findMatchedKeyword(t, DIFFICULT_KEYWORDS)) return 'difficult';
    return 'tired';
  }
  return 'neutral';
}

/**
 * 创建WebSocket语音服务器
 * @param {object} options
 * @param {string} options.asrType - ASR引擎类型
 * @param {string} options.ttsType - TTS引擎类型
 * @param {string} [options.storageDir] - 存储目录，用于读取孩子画像和会话历史
 * @returns {{wss: WebSocketServer, handleVoiceConnection: function, pipelines: Map}}
 */
function createWSServer(options = {}) {
  const wss = new WebSocketServer({ noServer: true });
  const pipelines = new Map();
  const sessionManager = createSessionManager();
  const storageDir = options.storageDir;
  const sessionStateManager = storageDir
    ? createSessionStateManager({ storageDir })
    : null;

  // Issue #24：借分契约依赖注入（支持持久化与编排器工厂注入，便于测试）
  const borrowPersistence = options.borrowPersistence || createBorrowContractPersistence(
    options.borrowStorageDir ? { storageDir: options.borrowStorageDir } : {}
  );
  const borrowThreshold = options.borrowThreshold || 3;
  const createBorrowState = options.createBorrowState || createBorrowContractState;
  const createBorrowOrchestrator = options.createBorrowOrchestrator || createBorrowContractOrchestrator;

  /**
   * 为会话获取或创建借分契约编排器（从持久化状态恢复，实现跨会话累积）
   * @param {object} session - 会话对象
   * @returns {{ orchestrator: object, childId: string }}
   */
  function getOrCreateBorrowContract(session) {
    if (session.borrowContract) return session.borrowContract;
    const childId = session.childId;
    const persisted = borrowPersistence.loadState(childId);
    const borrowState = createBorrowState({
      threshold: borrowThreshold,
      initialRefusalCount: persisted ? persisted.refusalCount : 0,
      initialState: persisted ? persisted.currentState : BORROW_STATES.IDLE
    });
    const orchestrator = createBorrowOrchestrator({ threshold: borrowThreshold, borrowState });
    session.borrowContract = { orchestrator, childId };
    return session.borrowContract;
  }

  /**
   * 持久化当前借分契约状态（跨会话累积拒绝计数）
   * @param {object} session - 会话对象
   */
  function persistBorrow(session) {
    if (!session.borrowContract) return;
    const { orchestrator, childId } = session.borrowContract;
    const status = orchestrator.getContractStatus();
    borrowPersistence.saveState(childId, {
      refusalCount: status.refusalCount,
      currentState: status.currentState
    });
  }

  /**
   * 统一获取会话并校验存在性（消除 borrow_* case 中重复的 session 获取与错误响应）
   * @param {WebSocket} ws
   * @param {string} sessionId
   * @returns {object|null} session 对象；若不存在已发送 error 并返回 null
   */
  function getSessionOrError(ws, sessionId) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      sendError(ws, `会话 ${sessionId} 不存在`);
      return null;
    }
    return session;
  }

  /**
   * 为新连接创建语音管道
   * @param {string} childId
   * @returns {object} 语音管道实例
   */
  function createPipelineForChild(childId) {
    const asr = createASREngine({
      type: options.asrType || 'mock',
      childMode: true,
      language: 'zh-CN'
    });

    const tts = createTTSEngine({
      type: options.ttsType || 'mock'
    });

    const vad = createVAD({ silenceThresholdMs: 500 });

    // 对话处理函数：连接到现有对话引擎
    const dialogHandler = async (text) => {
      // 根据文本内容决定回复和语气
      const session = sessionManager.getSession(
        [...pipelines.keys()].find(k => pipelines.get(k) === pipeline) || ''
      );

      // 简单对话逻辑（后续可替换为LLM）
      let replyText = '';
      let emotion = TTS_EMOTIONS.HAPPY;

      if (!text || text.trim().length === 0) {
        replyText = '你还在吗？';
        emotion = TTS_EMOTIONS.CURIOUS;
      } else if (text.includes('你好') || text.includes('嗨')) {
        replyText = '你好你好！我一直在等你呢！';
        emotion = TTS_EMOTIONS.HAPPY;
      } else if (text.includes('害怕') || text.includes('怕')) {
        replyText = '别怕别怕，有我在呢！';
        emotion = TTS_EMOTIONS.NERVOUS;
      } else {
        replyText = `嗯嗯，${text}，我听到了！`;
        emotion = TTS_EMOTIONS.CURIOUS;
      }

      return { replyText, emotion };
    };

    const pipeline = createVoicePipeline({
      asr,
      tts,
      vad,
      dialogHandler,
      timeoutMs: 3000
    });

    return pipeline;
  }

  /**
   * 处理新的WebSocket语音连接
   * @param {WebSocket} ws
   * @param {object} req
   */
  function handleVoiceConnection(ws, req) {
    const urlParts = req?.url?.split('/') || [];
    const childId = urlParts[urlParts.length - 1] || 'unknown';

    console.log(`语音WebSocket连接已建立，child_id: ${childId}`);

    // 创建会话和管道
    const session = sessionManager.createSession(childId);
    const pipeline = createPipelineForChild(childId);
    pipelines.set(session.id, pipeline);

    // Issue #21: 检查孩子是否已完成第一次见面（有已保存画像）
    // 有画像 → 触发每日见面流程；无画像 → 走第一次见面流程
    const profileResult = storageDir
      ? loadProfile(childId, { storageDir })
      : { success: false };

    if (profileResult.success) {
      // 已有画像 → 触发每日见面开场
      handleDailyMeetingConnection(ws, session, childId, profileResult.profile);
    } else {
      // 无画像 → 第一次见面流程
      handleFirstMeetingConnection(ws, session);
    }

    // 监听管道事件
    pipeline.on(PIPELINE_EVENTS.INTERRUPTED, () => {
      ws.send(JSON.stringify({ type: 'interrupt_ack', interrupted: true }));
    });

    pipeline.on(PIPELINE_EVENTS.FALLBACK, (data) => {
      ws.send(JSON.stringify({
        type: 'fallback',
        fallbackLine: data.fallbackLine
      }));
    });

    // 处理消息
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleWSMessage(ws, session.id, pipeline, message);
      } catch (err) {
        sendError(ws, err.message);
      }
    });

    ws.on('close', () => {
      console.log(`语音WebSocket连接已关闭，session: ${session.id}`);
      pipelines.delete(session.id);
    });

    ws.on('error', (err) => {
      console.error('语音WebSocket错误:', err.message);
    });
  }

  /**
   * 处理第一次见面连接（无画像）
   * 发送 session_start + 自动触发步骤1出场台词
   * @param {WebSocket} ws
   * @param {object} session - 会话对象
   */
  function handleFirstMeetingConnection(ws, session) {
    // 发送初始状态
    ws.send(JSON.stringify({
      type: 'session_start',
      sessionId: session.id,
      stepInfo: session.fsm.getStepInfo()
    }));

    // 自动触发步骤1出场台词
    const appearanceDialog = getStepDialog('APPEARANCE', REACTION_TYPES.QUICK);
    ws.send(JSON.stringify({
      type: 'fox_dialog',
      step: 'APPEARANCE',
      dialog: appearanceDialog,
      stepInfo: session.fsm.getStepInfo()
    }));

    // Issue #22 修复：不再在此处提前转换到 HELP_REQUEST
    // 保留 APPEARANCE 状态，等待孩子的第一条反应（HESITANT/SILENT/QUICK），
    // 由 handleVoiceMessage 的 APPEARANCE 分支根据实际反应返回正确的 followUp 台词后再转换
  }

  /**
   * 处理每日见面连接（有画像，Issue #21）
   * 使用 daily-meeting-orchestrator 生成开场，发送 DAILY_MEETING 状态
   * @param {WebSocket} ws
   * @param {object} session - 会话对象
   * @param {string} childId - 孩子 ID
   * @param {object} childProfile - 孩子画像
   */
  async function handleDailyMeetingConnection(ws, session, childId, childProfile) {
    // 标记会话为每日见面模式
    session.isDailyMeeting = true;
    session.childProfile = childProfile;

    // 发送初始状态
    ws.send(JSON.stringify({
      type: 'session_start',
      sessionId: session.id,
      stepInfo: { state: 'DAILY_MEETING', currentStep: 0, description: '每日见面' }
    }));

    try {
      // 使用每日见面编排器生成开场
      const orchestrator = createDailyMeetingOrchestrator({ sessionStateManager });
      const sessionCount = sessionStateManager
        ? sessionStateManager.getSessionCount(childId) + 1
        : 1;

      const result = await orchestrator.generateDailyOpening({
        childId,
        childProfile,
        sessionCount
      });

      if (result.error) {
        // 降级：出错时仍发送开场文本
        ws.send(JSON.stringify({
          type: 'fox_dialog',
          step: 'DAILY_MEETING',
          dialog: { mainLine: `${childProfile.nickname || '小伙伴'}！快过来，我发现了一件事！`, followUp: null },
          stepInfo: { state: 'DAILY_MEETING', currentStep: 0, description: '每日见面' },
          error: result.error
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'fox_dialog',
          step: 'DAILY_MEETING',
          dialog: { mainLine: result.openingText, followUp: null },
          stepInfo: { state: 'DAILY_MEETING', currentStep: 0, description: '每日见面' },
          components: result.components,
          storyStage: result.storyStage,
          tonePhase: result.tonePhase,
          memoryAnchor: result.memoryAnchor
        }));
      }
    } catch (err) {
      // 降级：异常时发送简单开场
      ws.send(JSON.stringify({
        type: 'fox_dialog',
        step: 'DAILY_MEETING',
        dialog: { mainLine: `${childProfile.nickname || '小伙伴'}！快过来，我发现了一件事！`, followUp: null },
        stepInfo: { state: 'DAILY_MEETING', currentStep: 0, description: '每日见面' },
        error: err.message
      }));
    }
  }

  /**
   * 处理WebSocket消息
   * @param {WebSocket} ws
   * @param {string} sessionId
   * @param {object} pipeline
   * @param {object} message
   */
  async function handleWSMessage(ws, sessionId, pipeline, message) {
    const { type, payload } = message;

    switch (type) {
      case 'audio': {
        // 处理音频数据
        const audioBase64 = payload?.audio;
        if (!audioBase64) {
          sendError(ws, '缺少音频数据');
          return;
        }

        const audioBuffer = Buffer.from(audioBase64, 'base64');

        try {
          const result = await pipeline.processAudio(audioBuffer);

          if (result.replyAudio) {
            ws.send(JSON.stringify({
              type: 'voice_reply',
              replyText: result.replyText,
              emotion: result.emotion,
              latencyMs: result.latencyMs,
              latencyBreakdown: result.latencyBreakdown,
              fallback: result.fallback || false,
              audio: result.replyAudio.toString('base64')
            }));
          }
        } catch (err) {
          sendError(ws, err.message);
        }
        break;
      }

      case 'child_response': {
        // 处理文本回复（兼容原有逻辑）
        try {
          const result = handleVoiceMessage(sessionManager, sessionId, {
            type: 'child_response',
            responseTimeMs: payload?.responseTimeMs || 0,
            content: payload?.content || ''
          });

          // Issue #23: 标准化消息构造，确保 hint 字段正确输出
          const message = {
            type: 'fox_dialog',
            step: result.nextState,
            dialog: result.dialog,
            stepInfo: result.stepInfo
          };

          // 当 nameRecorded 已定义时，包含名字相关字段
          if (result.nameRecorded !== undefined) {
            message.nameRecorded = result.nameRecorded;
            if (result.foxName !== undefined) message.foxName = result.foxName;
            if (result.nameSource !== undefined) message.nameSource = result.nameSource;
          }

          // hint 相关字段：当存在时始终包含
          if (result.showHints !== undefined) message.showHints = result.showHints;
          if (result.hints !== undefined) message.hints = result.hints;
          if (result.hintLine !== undefined) message.hintLine = result.hintLine;

          ws.send(JSON.stringify(message));
        } catch (err) {
          sendError(ws, err.message);
        }
        break;
      }

      case 'interrupt': {
        // 打断当前处理
        pipeline.interrupt();
        break;
      }

      case 'latency_stats': {
        // 查询延迟统计
        const stats = pipeline.getLatencyStats();
        ws.send(JSON.stringify({
          type: 'latency_stats',
          stats
        }));
        break;
      }

      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      }

      // ===== Issue #24：借分契约机制接入 WebSocket 流 =====
      case 'borrow_status': {
        try {
          const session = getSessionOrError(ws, sessionId);
          if (!session) return;
          const bc = getOrCreateBorrowContract(session);
          const status = bc.orchestrator.getContractStatus();
          ws.send(JSON.stringify({
            type: 'borrow_status',
            refusalCount: status.refusalCount,
            currentState: status.currentState,
            shouldTriggerBorrow: status.shouldTriggerBorrow,
            borrowPoints: status.borrowPoints,
            winPoints: status.winPoints
          }));
        } catch (err) {
          sendError(ws, err.message);
        }
        break;
      }

      case 'borrow_response': {
        try {
          const session = getSessionOrError(ws, sessionId);
          if (!session) return;
          const bc = getOrCreateBorrowContract(session);
          const status = bc.orchestrator.getContractStatus();

          // 已达阈值（跨会话恢复或本会话累计）→ 直接触发契约提案（第 4 次会议语义）
          if (status.shouldTriggerBorrow) {
            const proposal = bc.orchestrator.triggerContract();
            ws.send(JSON.stringify({
              type: 'borrow_contract_proposal',
              dialogue: proposal.dialogue,
              borrowPoints: proposal.borrowPoints,
              winPoints: proposal.winPoints,
              refusalCount: status.refusalCount
            }));
            return;
          }

          const refusalType = classifyRefusalType(payload?.content);
          if (refusalType === 'neutral') {
            ws.send(JSON.stringify({
              type: 'borrow_state_update',
              refusalCount: status.refusalCount,
              currentState: status.currentState,
              shouldTriggerBorrow: false
            }));
            return;
          }

          const result = await bc.orchestrator.processChildResponse(refusalType);
          persistBorrow(session);

          if (result.shouldTriggerBorrow) {
            const proposal = bc.orchestrator.triggerContract();
            ws.send(JSON.stringify({
              type: 'borrow_contract_proposal',
              dialogue: proposal.dialogue,
              borrowPoints: proposal.borrowPoints,
              winPoints: proposal.winPoints,
              refusalCount: result.refusalCount
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'borrow_state_update',
              refusalCount: result.refusalCount,
              currentState: result.currentState,
              shouldTriggerBorrow: false,
              shouldEndSession: result.shouldEndSession || false,
              shouldReduceDifficulty: result.shouldReduceDifficulty || false
            }));
          }
        } catch (err) {
          sendError(ws, err.message);
        }
        break;
      }

      case 'borrow_accept': {
        try {
          const session = getSessionOrError(ws, sessionId);
          if (!session) return;
          const bc = getOrCreateBorrowContract(session);
          const result = bc.orchestrator.acceptContract();
          persistBorrow(session);
          ws.send(JSON.stringify({ type: 'borrow_contract_accepted', dialogue: result.dialogue }));
        } catch (err) {
          sendError(ws, err.message);
        }
        break;
      }

      case 'borrow_reject': {
        try {
          const session = getSessionOrError(ws, sessionId);
          if (!session) return;
          const bc = getOrCreateBorrowContract(session);
          const result = bc.orchestrator.rejectContract();
          persistBorrow(session);
          ws.send(JSON.stringify({
            type: 'borrow_contract_rejected',
            dialogue: result.dialogue,
            refusalCount: bc.orchestrator.getContractStatus().refusalCount
          }));
        } catch (err) {
          sendError(ws, err.message);
        }
        break;
      }

      case 'borrow_complete': {
        try {
          const session = getSessionOrError(ws, sessionId);
          if (!session) return;
          const bc = getOrCreateBorrowContract(session);
          const result = await bc.orchestrator.completeContract(payload?.outcome);
          // 对赌结束后重置计数器，开启新一轮追踪
          bc.orchestrator.reset();
          persistBorrow(session);
          ws.send(JSON.stringify({
            type: 'borrow_contract_completed',
            outcome: result.outcome,
            dialogue: result.dialogue,
            points: result.points,
            storyUnlocked: result.storyUnlocked || false,
            funnyTask: result.funnyTask || null
          }));
        } catch (err) {
          sendError(ws, err.message);
        }
        break;
      }

      case 'borrow_changed_mind': {
        try {
          const session = getSessionOrError(ws, sessionId);
          if (!session) return;
          const bc = getOrCreateBorrowContract(session);
          const result = bc.orchestrator.handleChangedMind();
          persistBorrow(session);
          ws.send(JSON.stringify({ type: 'borrow_contract_changed_mind', dialogue: result.dialogue }));
        } catch (err) {
          sendError(ws, err.message);
        }
        break;
      }

      default:
        sendError(ws, `未知消息类型: ${type}`);
    }
  }

  return { wss, handleVoiceConnection, pipelines };
}

module.exports = { createWSServer };
