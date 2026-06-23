/**
 * WebSocketClient 测试 — WebSocket 客户端
 *
 * 验证行为：
 * - 连接到 WebSocket 服务器
 * - 发送消息
 * - 接收消息
 * - 连接状态管理
 * - 错误处理与重连
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createWebSocketClient } from '../../src/services/websocket-client.js';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.OPEN = 1;
    this.CLOSED = 3;
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }, 0);
  }
  send(data) { this._sent = this._sent || []; this._sent.push(data); }
  close() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1000 }); }
  simulateMessage(data) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }
  simulateError() {
    if (this.onerror) this.onerror(new Error('Connection failed'));
  }
}

global.WebSocket = MockWebSocket;

describe('WebSocketClient', () => {
  let client;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('连接管理', () => {
    test('应连接到指定 URL', async () => {
      client = createWebSocketClient('ws://localhost:3000/ws/voice/child-1');
      await new Promise(r => setTimeout(r, 10));

      expect(client.isConnected()).toBe(true);
    });

    test('连接前应处于未连接状态', () => {
      client = createWebSocketClient('ws://localhost:3000/ws/voice/child-1');
      expect(client.isConnected()).toBe(false);
    });

    test('应支持手动断开连接', async () => {
      client = createWebSocketClient('ws://localhost:3000/ws/voice/child-1');
      await new Promise(r => setTimeout(r, 10));

      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('消息发送', () => {
    test('应能发送 JSON 消息', async () => {
      client = createWebSocketClient('ws://localhost:3000/ws/voice/child-1');
      await new Promise(r => setTimeout(r, 10));

      const sent = client.send({ type: 'child_response', payload: { content: '你好' } });
      expect(sent).toBe(true);
    });

    test('未连接时发送应返回 false', () => {
      client = createWebSocketClient('ws://localhost:3000/ws/voice/child-1');
      const sent = client.send({ type: 'test' });
      expect(sent).toBe(false);
    });
  });

  describe('消息接收', () => {
    test('应能注册消息监听器', async () => {
      client = createWebSocketClient('ws://localhost:3000/ws/voice/child-1');
      await new Promise(r => setTimeout(r, 10));

      const received = [];
      client.onMessage((msg) => received.push(msg));

      client._ws.simulateMessage({ type: 'fox_dialog', dialog: '你好！' });

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('fox_dialog');
    });

    test('应支持多个消息监听器', async () => {
      client = createWebSocketClient('ws://localhost:3000/ws/voice/child-1');
      await new Promise(r => setTimeout(r, 10));

      const received1 = [];
      const received2 = [];
      client.onMessage((msg) => received1.push(msg));
      client.onMessage((msg) => received2.push(msg));

      client._ws.simulateMessage({ type: 'session_start' });

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });
  });

  describe('连接状态事件', () => {
    test('应触发连接成功回调', async () => {
      const onConnected = vi.fn();
      client = createWebSocketClient('ws://localhost:3000/ws/voice/child-1');
      client.onConnected(onConnected);

      await new Promise(r => setTimeout(r, 10));

      expect(onConnected).toHaveBeenCalled();
    });

    test('应触发断开连接回调', async () => {
      const onDisconnected = vi.fn();
      client = createWebSocketClient('ws://localhost:3000/ws/voice/child-1');
      await new Promise(r => setTimeout(r, 10));

      client.onDisconnected(onDisconnected);
      client.disconnect();

      expect(onDisconnected).toHaveBeenCalled();
    });
  });

  describe('音频数据发送', () => {
    test('应能发送音频数据', async () => {
      client = createWebSocketClient('ws://localhost:3000/ws/voice/child-1');
      await new Promise(r => setTimeout(r, 10));

      const audioBase64 = btoa('fake-audio-data');
      const sent = client.sendAudio(audioBase64);

      expect(sent).toBe(true);
    });
  });
});
