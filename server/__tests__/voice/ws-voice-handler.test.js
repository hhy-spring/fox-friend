/**
 * WebSocket语音处理器集成测试
 *
 * 参考Issue #6验收标准：
 *   - 语音输入采集正常（适配 4-7 岁儿童发音特点）
 *   - 打断机制：检测到孩子声音 → 立即停止当前 TTS 播放 → 进入新一轮对话
 *
 * 参考技术架构文档§四：
 *   WS `/ws/voice/{child_id}` - 语音双向流（核心）
 */

const { createWSServer } = require('../../src/voice/ws-voice-handler');
const WebSocket = require('ws');
const http = require('http');

describe('WebSocket语音处理器集成', () => {
  let server;
  let wss;
  let wsUrl;
  let port;

  beforeAll((done) => {
    // 创建测试用WebSocket服务器
    server = http.createServer();
    port = 9222 + Math.floor(Math.random() * 1000);
    const { wss: wsServer, handleVoiceConnection } = createWSServer({
      asrType: 'mock',
      ttsType: 'mock'
    });
    wss = wsServer;

    wss.on('connection', handleVoiceConnection);
    server.on('upgrade', (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    });

    server.listen(port, () => {
      wsUrl = `ws://localhost:${port}`;
      done();
    });
  });

  afterAll((done) => {
    wss.close(() => {
      server.close(done);
    });
  });

  describe('WebSocket连接', () => {
    test('连接到 /ws/voice/{child_id} 成功建立', (done) => {
      const ws = new WebSocket(`${wsUrl}/ws/voice/child_001`);

      ws.on('open', () => {
        ws.close();
      });

      ws.on('close', () => {
        done();
      });
    });

    test('连接后收到 session_start 消息', (done) => {
      const ws = new WebSocket(`${wsUrl}/ws/voice/child_001`);

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'session_start') {
          expect(msg.sessionId).toBeDefined();
          ws.close();
        }
      });

      ws.on('close', () => {
        done();
      });
    });
  });

  describe('语音消息处理', () => {
    test('发送 audio 消息，收到语音管道处理结果', (done) => {
      const ws = new WebSocket(`${wsUrl}/ws/voice/child_001`);

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'voice_reply') {
          expect(msg).toHaveProperty('replyText');
          expect(msg).toHaveProperty('emotion');
          expect(msg).toHaveProperty('latencyMs');
          ws.close();
        }
      });

      ws.on('open', () => {
        // 发送音频数据
        ws.send(JSON.stringify({
          type: 'audio',
          payload: {
            audio: Buffer.from([100, 50, 80]).toString('base64')
          }
        }));
      });

      ws.on('close', () => {
        done();
      });
    }, 10000);
  });

  describe('打断机制', () => {
    test('发送 interrupt 消息，收到打断确认', (done) => {
      const ws = new WebSocket(`${wsUrl}/ws/voice/child_001`);

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'interrupt_ack') {
          expect(msg.interrupted).toBe(true);
          ws.close();
        }
      });

      ws.on('open', () => {
        // 先发送音频
        ws.send(JSON.stringify({
          type: 'audio',
          payload: {
            audio: Buffer.from([100, 50, 80]).toString('base64')
          }
        }));

        // 立即发送打断
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'interrupt' }));
        }, 50);
      });

      ws.on('close', () => {
        done();
      });
    }, 10000);
  });

  describe('延迟统计查询', () => {
    test('发送 latency_stats 消息，收到延迟统计', (done) => {
      const ws = new WebSocket(`${wsUrl}/ws/voice/child_001`);

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'latency_stats') {
          expect(msg.stats).toHaveProperty('p50');
          expect(msg.stats).toHaveProperty('p95');
          expect(msg.stats).toHaveProperty('count');
          ws.close();
        }
      });

      ws.on('open', () => {
        // 查询延迟统计
        ws.send(JSON.stringify({ type: 'latency_stats' }));
      });

      ws.on('close', () => {
        done();
      });
    }, 10000);
  });

  describe('Issue #22: HESITANT/SILENT 反应的 followUp 台词', () => {
    test('HESITANT 反应 → followUp 返回「你听见我说话了吗？」', (done) => {
      const ws = new WebSocket(`${wsUrl}/ws/voice/child_issue22_hesitant`);
      let foxDialogCount = 0;

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'fox_dialog') {
          foxDialogCount++;
          if (foxDialogCount === 1) {
            // 初始 APPEARANCE 台词，发送 HESITANT 反应
            ws.send(JSON.stringify({
              type: 'child_response',
              payload: {
                responseTimeMs: 2000,
                content: ''
              }
            }));
            return;
          }
          // 对 child_response 的响应
          try {
            expect(msg.dialog).toBeTruthy();
            expect(msg.dialog.followUp).toBe('你听见我说话了吗？');
            ws.close();
          } catch (err) {
            ws.close();
            done(err);
          }
        }
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    }, 10000);

    test('SILENT 反应 → followUp 返回害羞台词', (done) => {
      const ws = new WebSocket(`${wsUrl}/ws/voice/child_issue22_silent`);
      let foxDialogCount = 0;

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'fox_dialog') {
          foxDialogCount++;
          if (foxDialogCount === 1) {
            // 初始 APPEARANCE 台词，发送 SILENT 反应
            ws.send(JSON.stringify({
              type: 'child_response',
              payload: {
                responseTimeMs: 4000,
                content: ''
              }
            }));
            return;
          }
          // 对 child_response 的响应
          try {
            expect(msg.dialog).toBeTruthy();
            expect(msg.dialog.followUp).toContain('害羞');
            ws.close();
          } catch (err) {
            ws.close();
            done(err);
          }
        }
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    }, 10000);
  });
});
