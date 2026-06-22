/**
 * WebSocket 连接处理器 - 处理语音相关 WebSocket 通信
 *
 * 参考技术架构文档§三「语音交互管道」：
 *   Child voice → WebAudio → WebSocket → ASR(300ms) → LLM(800ms) → TTS(500ms) → WebSocket → Playback
 *
 * 参考技术架构文档§四「关键API」：
 *   WS `/ws/voice/{child_id}` - 语音双向流（核心）
 */

const { createSessionManager, handleVoiceMessage } = require('./session-manager');

// 全局会话管理器实例
const sessionManager = createSessionManager();

/**
 * 处理新的 WebSocket 连接
 * @param {WebSocket} ws - WebSocket 连接实例
 * @param {object} req - HTTP 请求对象（含 URL 参数）
 */
function handleConnection(ws, req) {
  // 从 URL 中提取 child_id: /ws/voice/{child_id}
  const urlParts = req?.url?.split('/') || [];
  const childId = urlParts[urlParts.length - 1] || 'unknown';

  console.log(`新的 WebSocket 连接已建立，child_id: ${childId}`);

  // 创建会话
  const session = sessionManager.createSession(childId);

  // 发送初始状态
  ws.send(JSON.stringify({
    type: 'session_start',
    sessionId: session.id,
    stepInfo: session.fsm.getStepInfo()
  }));

  // 自动触发步骤1出场台词
  const { getStepDialog, REACTION_TYPES } = require('../dialog/dialog-engine');
  const appearanceDialog = getStepDialog('APPEARANCE', REACTION_TYPES.QUICK);
  ws.send(JSON.stringify({
    type: 'fox_dialog',
    step: 'APPEARANCE',
    dialog: appearanceDialog,
    stepInfo: session.fsm.getStepInfo()
  }));

  // 转换到 HELP_REQUEST
  sessionManager.updateState(session.id, 'HELP_REQUEST');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, session.id, message);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: '消息格式错误' }));
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket 连接已关闭，session: ${session.id}`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket 错误:', err.message);
  });
}

/**
 * 处理接收到的消息
 * @param {WebSocket} ws - WebSocket 连接实例
 * @param {string} sessionId - 会话 ID
 * @param {object} message - 解析后的消息对象
 */
function handleMessage(ws, sessionId, message) {
  const { type, payload } = message;

  switch (type) {
    case 'child_response':
      // 处理孩子语音回复
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
      // 处理原始音频数据（ASR 前端上传）
      ws.send(JSON.stringify({ type: 'ack', message: '音频数据已接收' }));
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', message: `未知消息类型: ${type}` }));
  }
}

module.exports = { handleConnection, handleMessage, sessionManager };
