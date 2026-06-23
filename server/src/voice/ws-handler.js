/**
 * WebSocket 连接处理器 - 处理语音相关 WebSocket 通信
 *
 * 参考Issue #6：语音对话引擎
 * 参考技术架构文档§三「语音交互管道」：
 *   Child voice → WebAudio → WebSocket → ASR(300ms) → LLM(800ms) → TTS(500ms) → WebSocket → Playback
 *
 * 参考技术架构文档§四「关键API」：
 *   WS `/ws/voice/{child_id}` - 语音双向流（核心）
 */

const { createSessionManager, handleVoiceMessage } = require('./session-manager');
const { createVoicePipeline, PIPELINE_EVENTS } = require('./voice-pipeline');
const { createASREngine } = require('./asr-engine');
const { createTTSEngine, TTS_EMOTIONS } = require('./tts-engine');
const { createVAD } = require('./vad');
const { getStepDialog, REACTION_TYPES } = require('../dialog/dialog-engine');

// 全局会话管理器实例
const sessionManager = createSessionManager();

// 每个会话的语音管道映射
const sessionPipelines = new Map();

/**
 * 为会话创建语音管道
 * @param {string} sessionId
 * @returns {object} 语音管道实例
 */
function createPipelineForSession(sessionId) {
  const asr = createASREngine({ type: 'mock', childMode: true, language: 'zh-CN' });
  const tts = createTTSEngine({ type: 'mock' });
  const vad = createVAD({ silenceThresholdMs: 500 });

  const dialogHandler = async (text) => {
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
    asr, tts, vad, dialogHandler, timeoutMs: 3000
  });

  sessionPipelines.set(sessionId, pipeline);
  return pipeline;
}

/**
 * 处理新的 WebSocket 连接
 * @param {WebSocket} ws - WebSocket 连接实例
 * @param {object} req - HTTP 请求对象（含 URL 参数）
 * @param {object} [db] - 数据库实例（用于会话结束时持久化指标，Issue #28）
 */
function handleConnection(ws, req, db = null) {
  // 从 URL 中提取 child_id: /ws/voice/{child_id}
  const urlParts = req?.url?.split('/') || [];
  const childId = urlParts[urlParts.length - 1] || 'unknown';

  console.log(`新的 WebSocket 连接已建立，child_id: ${childId}`);

  // 创建会话
  const session = sessionManager.createSession(childId);

  // 创建语音管道
  const pipeline = createPipelineForSession(session.id);

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

  // 转换到 HELP_REQUEST
  sessionManager.updateState(session.id, 'HELP_REQUEST');

  // 监听管道事件
  pipeline.on(PIPELINE_EVENTS.INTERRUPTED, () => {
    ws.send(JSON.stringify({ type: 'interrupt_ack', interrupted: true }));
  });

  pipeline.on(PIPELINE_EVENTS.FALLBACK, (data) => {
    ws.send(JSON.stringify({ type: 'fallback', fallbackLine: data.fallbackLine }));
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, session.id, pipeline, message);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: '消息格式错误' }));
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket 连接已关闭，session: ${session.id}`);
    // 会话结束时持久化情感连接指标到 DB（Issue #28）
    sessionManager.endSession(session.id, db);
    sessionPipelines.delete(session.id);
  });

  ws.on('error', (err) => {
    console.error('WebSocket 错误:', err.message);
  });
}

/**
 * 处理接收到的消息
 * @param {WebSocket} ws - WebSocket 连接实例
 * @param {string} sessionId - 会话 ID
 * @param {object} pipeline - 语音管道实例
 * @param {object} message - 解析后的消息对象
 */
async function handleMessage(ws, sessionId, pipeline, message) {
  const { type, payload } = message;

  switch (type) {
    case 'child_response':
      // 处理孩子文本回复（兼容原有逻辑）
      try {
        const result = handleVoiceMessage(sessionManager, sessionId, {
          type: 'child_response',
          responseTimeMs: payload?.responseTimeMs || 0,
          content: payload?.content || ''
        });

        ws.send(JSON.stringify({
          type: 'fox_dialog',
          step: result.nextState,
          dialog: result.dialog,
          ...result.nameRecorded !== undefined && {
            nameRecorded: result.nameRecorded,
            foxName: result.foxName,
            showHints: result.showHints,
            hints: result.hints,
            hintLine: result.hintLine
          },
          stepInfo: result.stepInfo
        }));
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
      break;

    case 'audio':
      // 处理原始音频数据 — 通过语音管道处理
      try {
        const audioBase64 = payload?.audio;
        if (!audioBase64) {
          ws.send(JSON.stringify({ type: 'error', message: '缺少音频数据' }));
          return;
        }

        const audioBuffer = Buffer.from(audioBase64, 'base64');
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
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
      break;

    case 'interrupt':
      // 打断当前语音处理
      pipeline.interrupt();
      break;

    case 'latency_stats':
      // 查询延迟统计
      ws.send(JSON.stringify({
        type: 'latency_stats',
        stats: pipeline.getLatencyStats()
      }));
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', message: `未知消息类型: ${type}` }));
  }
}

module.exports = { handleConnection, handleMessage, sessionManager };
