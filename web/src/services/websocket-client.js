/**
 * WebSocketClient — WebSocket 客户端服务
 *
 * 职责：
 * - 连接到后端 WebSocket 服务器
 * - 发送/接收消息
 * - 连接状态管理
 * - 事件回调（消息、连接、断开、错误）
 * - 自动重连（指数退避）
 * - 心跳保活（防止代理超时断连）
 *
 * 消息格式：
 * { type: string, payload: any, ... }
 */

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 10000];
const HEARTBEAT_INTERVAL = 25000;

/**
 * 创建 WebSocket 客户端
 * @param {string} url - WebSocket 服务器 URL
 * @returns {object} WebSocket 客户端实例
 */
export function createWebSocketClient(url) {
  let ws = null;
  let connected = false;
  let manualClose = false;
  let reconnectAttempts = 0;
  let heartbeatTimer = null;
  let reconnectTimer = null;
  const messageHandlers = [];
  const connectedHandlers = [];
  const disconnectedHandlers = [];
  const errorHandlers = [];

  function clearTimers() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  }

  function startHeartbeat() {
    clearTimers();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }

  function connect() {
    try {
      ws = new WebSocket(url);
    } catch (e) {
      console.error('WebSocket 创建失败:', e);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      connected = true;
      reconnectAttempts = 0;
      startHeartbeat();
      connectedHandlers.forEach(handler => {
        try { handler(); } catch (e) { console.error('连接回调错误:', e); }
      });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        // 忽略 pong 心跳响应
        if (message.type === 'pong') return;
        messageHandlers.forEach(handler => {
          try { handler(message); } catch (e) { console.error('消息处理错误:', e); }
        });
      } catch (e) {
        console.error('消息解析错误:', e);
      }
    };

    ws.onclose = (event) => {
      connected = false;
      clearTimers();
      disconnectedHandlers.forEach(handler => {
        try { handler(); } catch (e) { console.error('断开回调错误:', e); }
      });
      // 非手动关闭时自动重连
      if (!manualClose) {
        scheduleReconnect();
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket 错误:', error);
      errorHandlers.forEach(handler => {
        try { handler(error); } catch (e) { console.error('错误回调异常:', e); }
      });
    };
  }

  function scheduleReconnect() {
    if (manualClose) return;
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    console.log(`WebSocket 将在 ${delay}ms 后重连（第 ${reconnectAttempts + 1} 次）`);
    reconnectTimer = setTimeout(() => {
      reconnectAttempts++;
      connect();
    }, delay);
  }

  // 自动连接
  connect();

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

  function onError(handler) {
    errorHandlers.push(handler);
  }

  function disconnect() {
    manualClose = true;
    clearTimers();
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
    onError,
    disconnect
  };
}
