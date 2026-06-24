/**
 * HttpVoiceClient — HTTP 轮询语音客户端
 *
 * 当 WebSocket 不可用（如预览代理不支持 wss://）时使用。
 * 提供与 WebSocketClient 相同的接口，便于无缝替换。
 *
 * 流程：
 *   1. connect() → POST /api/voice/session 创建会话，触发初始对话
 *   2. sendAudio() → POST /api/voice/audio 上传音频，返回回复
 *   3. sendChildResponse() → POST /api/voice/response 发送文本
 */

const API_BASE = '/api/voice';

/**
 * 创建 HTTP 语音客户端
 * @returns {object} 与 WebSocketClient 接口兼容的客户端
 */
export function createHttpVoiceClient() {
  let connected = false;
  let sessionId = null;
  const messageHandlers = [];
  const connectedHandlers = [];
  const disconnectedHandlers = [];
  const errorHandlers = [];

  function emit(message) {
    messageHandlers.forEach(handler => {
      try { handler(message); } catch (e) { console.error('消息处理错误:', e); }
    });
  }

  async function connect() {
    try {
      const resp = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: 'default-child' })
      });

      if (!resp.ok) {
        throw new Error(`创建会话失败: HTTP ${resp.status}`);
      }

      const data = await resp.json();
      sessionId = data.sessionId;
      connected = true;

      // 通知连接成功
      connectedHandlers.forEach(handler => {
        try { handler(); } catch (e) { console.error('连接回调错误:', e); }
      });

      // 发送初始消息（fox_dialog）
      emit({
        type: 'fox_dialog',
        step: data.step,
        dialog: data.dialog,
        stepInfo: data.stepInfo
      });
    } catch (err) {
      console.error('HTTP 语音客户端连接失败:', err);
      errorHandlers.forEach(handler => {
        try { handler(err); } catch (e) { console.error('错误回调异常:', e); }
      });
    }
  }

  function isConnected() {
    return connected;
  }

  async function sendAudio(audioBase64) {
    if (!connected || !sessionId) return false;

    try {
      const resp = await fetch(`${API_BASE}/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, audio: audioBase64 })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        emit({ type: 'error', message: errData.error || `HTTP ${resp.status}` });
        return false;
      }

      const data = await resp.json();
      emit(data);
      return true;
    } catch (err) {
      emit({ type: 'error', message: err.message });
      return false;
    }
  }

  async function sendChildResponse(content, responseTimeMs = 0) {
    if (!connected || !sessionId) return false;

    try {
      const resp = await fetch(`${API_BASE}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, content, responseTimeMs })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        emit({ type: 'error', message: errData.error || `HTTP ${resp.status}` });
        return false;
      }

      const data = await resp.json();
      emit(data);
      return true;
    } catch (err) {
      emit({ type: 'error', message: err.message });
      return false;
    }
  }

  function onMessage(handler) { messageHandlers.push(handler); }
  function onConnected(handler) { connectedHandlers.push(handler); }
  function onDisconnected(handler) { disconnectedHandlers.push(handler); }
  function onError(handler) { errorHandlers.push(handler); }

  function disconnect() {
    connected = false;
    sessionId = null;
    disconnectedHandlers.forEach(handler => {
      try { handler(); } catch (e) { console.error('断开回调错误:', e); }
    });
  }

  // 自动连接
  connect();

  return {
    _ws: null,
    isConnected,
    send: () => false,
    sendAudio,
    sendChildResponse,
    onMessage,
    onConnected,
    onDisconnected,
    onError,
    disconnect
  };
}
