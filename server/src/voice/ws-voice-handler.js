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

/**
 * 创建WebSocket语音服务器
 * @param {object} options
 * @param {string} options.asrType - ASR引擎类型
 * @param {string} options.ttsType - TTS引擎类型
 * @returns {{wss: WebSocketServer, handleVoiceConnection: function, pipelines: Map}}
 */
function createWSServer(options = {}) {
  const wss = new WebSocketServer({ noServer: true });
  const pipelines = new Map();
  const sessionManager = createSessionManager();

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
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
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
          ws.send(JSON.stringify({ type: 'error', message: '缺少音频数据' }));
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
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
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

      default:
        ws.send(JSON.stringify({ type: 'error', message: `未知消息类型: ${type}` }));
    }
  }

  return { wss, handleVoiceConnection, pipelines };
}

module.exports = { createWSServer };
