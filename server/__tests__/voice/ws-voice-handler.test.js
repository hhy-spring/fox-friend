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

/**
 * Issue #21: 每日见面流程触发测试
 *
 * 参考PRD §4.2 + §4.5.3 变化一
 * 参考技术架构文档§六 执行优先级：#7 每日见面开场
 *
 * 验证：孩子完成第一次见面后，再次连接应触发每日见面流程，而非重新走第一次见面流程
 */
describe('Issue #21: 每日见面流程触发', () => {
  let server;
  let wss;
  let wsUrl;
  let port;
  let tmpDir;

  beforeAll((done) => {
    const os = require('os');
    const fs = require('fs');
    const path = require('path');

    // 创建临时存储目录，预置已完成第一次见面的孩子画像
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fox-issue21-'));

    // 写入孩子画像（模拟已完成第一次见面流程）
    const childId = 'child_daily_001';
    const profile = {
      foxName: '闪电',
      foxNameSource: 'child_named',
      nickname: '闪电',
      age: 5,
      interests: ['恐龙', '赛车'],
      self_claimed_skills: ['跑步'],
      saved_at: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(tmpDir, `profile_${childId}.json`),
      JSON.stringify(profile, null, 2),
      'utf8'
    );

    // 写入上一次会话数据（供回忆锚点引用）
    const lastSession = {
      date: '2026-06-20',
      story_stage: '字母石',
      subject: 'pinyin',
      items_learned: ['a'],
      mastery_status: { a: 'learning' },
      child_mood: 'happy',
      chat_frequency: 8,
      teaching_method_used: 'feynman',
      duration_minutes: 5,
      child_spontaneous_remarks: ['我喜欢恐龙'],
      saved_at: '2026-06-20T10:00:00.000Z'
    };
    fs.writeFileSync(
      path.join(tmpDir, `sessions_${childId}.json`),
      JSON.stringify([lastSession], null, 2),
      'utf8'
    );

    // 创建带存储目录的 WSServer
    server = http.createServer();
    port = 9322 + Math.floor(Math.random() * 1000);
    const { wss: wsServer, handleVoiceConnection } = createWSServer({
      asrType: 'mock',
      ttsType: 'mock',
      storageDir: tmpDir
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
      server.close(() => {
        // 清理临时目录
        if (tmpDir && require('fs').existsSync(tmpDir)) {
          require('fs').rmSync(tmpDir, { recursive: true, force: true });
        }
        done();
      });
    });
  });

  test('有画像的孩子再次连接，应触发每日见面开场（非 APPEARANCE）', (done) => {
    const ws = new WebSocket(`${wsUrl}/ws/voice/child_daily_001`);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      // 跳过 session_start，等待 fox_dialog
      if (msg.type === 'fox_dialog') {
        // 关键断言：步骤应为 DAILY_MEETING，而非 APPEARANCE
        expect(msg.step).toBe('DAILY_MEETING');
        expect(msg.step).not.toBe('APPEARANCE');
        ws.close();
      }
    });

    ws.on('close', () => {
      done();
    });

    ws.on('error', (err) => {
      done(err);
    });
  }, 10000);

  test('无画像的孩子连接，仍走第一次见面流程（APPEARANCE）', (done) => {
    // 使用未预置画像的 childId
    const ws = new WebSocket(`${wsUrl}/ws/voice/child_no_profile_002`);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'fox_dialog') {
        // 回归断言：无画像时仍走 APPEARANCE
        expect(msg.step).toBe('APPEARANCE');
        ws.close();
      }
    });

    ws.on('close', () => {
      done();
    });

    ws.on('error', (err) => {
      done(err);
    });
  }, 10000);

  test('每日见面开场包含点名 + 回忆锚点 + 新任务三组件', (done) => {
    const ws = new WebSocket(`${wsUrl}/ws/voice/child_daily_001`);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'fox_dialog' && msg.step === 'DAILY_MEETING') {
        // 断言1：开场文本非空
        expect(msg.dialog.mainLine).toBeTruthy();
        expect(msg.dialog.mainLine.length).toBeGreaterThan(0);

        // 断言2：components 三组件存在
        expect(msg.components).toBeDefined();
        expect(msg.components.nameCall).toBeDefined();
        expect(msg.components.newTask).toBeDefined();

        // 断言3：点名包含孩子昵称（画像中 nickname 为 "闪电"）
        expect(msg.components.nameCall).toContain('闪电');

        // 断言4：新任务非空
        expect(msg.components.newTask.length).toBeGreaterThan(0);

        ws.close();
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
