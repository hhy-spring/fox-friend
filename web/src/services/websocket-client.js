/**
 * WebSocketClient — WebSocket 客户端服务
 *
 * 职责：
 * - 连接到后端 WebSocket 服务器
 * - 发送/接收消息
 * - 连接状态管理
 * - 事件回调（消息、连接、断开）
 *
 * 消息格式：
 * { type: string, payload: any, ... }
 */

/**
 * 创建 WebSocket 客户端
 * @param {string} url - WebSocket 服务器 URL
 * @returns {object} WebSocket 客户端实例
 */
export function createWebSocketClient(url) {
  let ws = null;
  let connected = false;
  const messageHandlers = [];
  const connectedHandlers = [];
  const disconnectedHandlers = [];

  // 自动连接
  ws = new WebSocket(url);

  ws.onopen = () => {
    connected = true;
    connectedHandlers.forEach(handler => {
      try { handler(); } catch (e) { console.error('连接回调错误:', e); }
    });
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      messageHandlers.forEach(handler => {
        try { handler(message); } catch (e) { console.error('消息处理错误:', e); }
      });
    } catch (e) {
      console.error('消息解析错误:', e);
    }
  };

  ws.onclose = () => {
    connected = false;
    disconnectedHandlers.forEach(handler => {
      try { handler(); } catch (e) { console.error('断开回调错误:', e); }
    });
  };

  ws.onerror = (error) => {
    console.error('WebSocket 错误:', error);
  };

  function isConnected() {
    return connected;
  }

  function send(message) {
    if (!connected || !ws || ws.readyState !== 1) {
      return false;
    }
    ws.send(JSON.stringify(message));
    return true;
  }

  function sendAudio(audioBase64) {
    return send({ type: 'audio', payload: { audio: audioBase64 } });
  }

  function sendChildResponse(content, responseTimeMs = 0) {
    return send({ type: 'child_response', payload: { content, responseTimeMs } });
  }

  function onMessage(handler) {
    messageHandlers.push(handler);
  }

  function onConnected(handler) {
    connectedHandlers.push(handler);
  }

  function onDisconnected(handler) {
    disconnectedHandlers.push(handler);
  }

  function disconnect() {
    if (ws) {
      ws.close();
    }
  }

  return {
    _ws: ws,
    isConnected,
    send,
    sendAudio,
    sendChildResponse,
    onMessage,
    onConnected,
    onDisconnected,
    disconnect
  };
}
