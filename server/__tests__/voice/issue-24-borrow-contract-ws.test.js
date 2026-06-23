/**
 * Issue #24 集成测试 - 借分契约机制接入 WebSocket 语音流
 *
 * 参考 Issue #24 验收标准：
 *   - 独立计数器追踪「不愿推进」次数（跨会话持久化）
 *   - 区分 rebellious（叛逆/无聊）与 tired/difficult（累了/畏难）
 *   - 计数达阈值（3）→ 触发借分契约（第 4 次会议触发）
 *   - 完整流程：借 10 分 → 翻倍 20 分 → 解锁新故事/搞笑任务
 *
 * 参考技术架构§四：WS `/ws/voice/{child_id}` - 语音双向流（核心）
 */

const { createWSServer } = require('../../src/voice/ws-voice-handler');
const { createBorrowContractPersistence } = require('../../src/dialog/borrow-contract-persistence');
const WebSocket = require('ws');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * 创建一个带消息缓冲的 WS 测试客户端，提供 waitFor(type) 方法
 */
function createWSClient(url) {
  const ws = new WebSocket(url);
  const pending = [];
  const waiters = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    const waiter = waiters.find((w) => w.type === msg.type || msg.type === 'error');
    if (waiter) {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(msg);
    } else {
      pending.push(msg);
    }
  });

  function waitFor(type, timeout = 4000) {
    return new Promise((resolve, reject) => {
      const idx = pending.findIndex((m) => m.type === type);
      if (idx >= 0) {
        resolve(pending.splice(idx, 1)[0]);
        return;
      }
      const timer = setTimeout(() => {
        const i = waiters.findIndex((w) => w.type === type);
        if (i >= 0) waiters.splice(i, 1);
        reject(new Error(`等待 ${type} 超时`));
      }, timeout);
      waiters.push({
        type,
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        }
      });
    });
  }

  function send(msg) {
    ws.send(JSON.stringify(msg));
  }

  return { ws, waitFor, send };
}

describe('Issue #24: 借分契约接入 WebSocket 语音流', () => {
  let server;
  let wss;
  let wsUrl;
  let port;
  let persistence;
  let storageDir;
  let clients = [];

  beforeAll((done) => {
    storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'issue24-ws-'));
    persistence = createBorrowContractPersistence({ storageDir });

    server = http.createServer();
    port = 9300 + Math.floor(Math.random() * 1000);
    const { wss: wsServer, handleVoiceConnection } = createWSServer({
      asrType: 'mock',
      ttsType: 'mock',
      borrowPersistence: persistence,
      borrowThreshold: 3
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

  afterEach(() => {
    clients.forEach((c) => {
      try { c.ws.close(); } catch (e) { /* ignore */ }
    });
    clients = [];
  });

  afterAll((done) => {
    wss.close(() => {
      server.close(() => {
        if (storageDir && fs.existsSync(storageDir)) {
          fs.rmSync(storageDir, { recursive: true, force: true });
        }
        done();
      });
    });
  });

  // 创建客户端并登记，便于 afterEach 统一清理
  function makeClient(url) {
    const client = createWSClient(url);
    clients.push(client);
    return client;
  }

  function open(client) {
    return new Promise((resolve) => client.ws.on('open', resolve));
  }

  describe('borrow_status - 状态查询', () => {
    test('新孩子初始状态：refusalCount=0, shouldTriggerBorrow=false', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_new`);
      await open(client);

      client.send({ type: 'borrow_status' });
      const status = await client.waitFor('borrow_status');

      expect(status.refusalCount).toBe(0);
      expect(status.currentState).toBe('IDLE');
      expect(status.shouldTriggerBorrow).toBe(false);
      expect(status.borrowPoints).toBe(10);
      expect(status.winPoints).toBe(20);

      client.ws.close();
    });
  });

  describe('borrow_response - 计数与状态区分', () => {
    test('叛逆/无聊反应应递增计数器', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_rebel`);
      await open(client);

      client.send({ type: 'borrow_response', payload: { content: '我不想学' } });
      const update = await client.waitFor('borrow_state_update');

      expect(update.refusalCount).toBe(1);
      expect(update.currentState).toBe('COUNTING');
      expect(update.shouldTriggerBorrow).toBe(false);

      client.ws.close();
    });

    test('累了反应不递增计数器，标记结束会话', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_tired`);
      await open(client);

      client.send({ type: 'borrow_response', payload: { content: '我困了' } });
      const update = await client.waitFor('borrow_state_update');

      expect(update.refusalCount).toBe(0);
      expect(update.shouldEndSession).toBe(true);

      client.ws.close();
    });

    test('畏难反应不递增计数器，标记降低难度', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_diff`);
      await open(client);

      client.send({ type: 'borrow_response', payload: { content: '太难了不会' } });
      const update = await client.waitFor('borrow_state_update');

      expect(update.refusalCount).toBe(0);
      expect(update.shouldReduceDifficulty).toBe(true);

      client.ws.close();
    });
  });

  describe('触发借分契约 - 第 4 次会议语义', () => {
    test('连续 3 次叛逆反应后触发借分契约提案', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_trigger`);
      await open(client);

      client.send({ type: 'borrow_response', payload: { content: '不想学' } });
      await client.waitFor('borrow_state_update');
      client.send({ type: 'borrow_response', payload: { content: '无聊' } });
      await client.waitFor('borrow_state_update');
      client.send({ type: 'borrow_response', payload: { content: '我不要学' } });
      const proposal = await client.waitFor('borrow_contract_proposal');

      expect(proposal.dialogue).toContain('10');
      expect(proposal.dialogue).toContain('20');
      expect(proposal.borrowPoints).toBe(10);
      expect(proposal.winPoints).toBe(20);
      expect(proposal.refusalCount).toBe(3);

      client.ws.close();
    });

    test('跨会话持久化：3 次拒绝后新连接应直接触发契约（第 4 次会议）', async () => {
      // 第一次连接：累积 3 次拒绝
      const c1 = makeClient(`${wsUrl}/ws/voice/issue24_persist`);
      await open(c1);
      c1.send({ type: 'borrow_response', payload: { content: '不想学' } });
      await c1.waitFor('borrow_state_update');
      c1.send({ type: 'borrow_response', payload: { content: '无聊' } });
      await c1.waitFor('borrow_state_update');
      c1.send({ type: 'borrow_response', payload: { content: '我不要学' } });
      await c1.waitFor('borrow_contract_proposal');
      c1.ws.close();
      await new Promise((resolve) => c1.ws.on('close', resolve));

      // 第二次连接（新会话/第 4 次会议）：状态已持久化，应直接触发
      const c2 = makeClient(`${wsUrl}/ws/voice/issue24_persist`);
      await open(c2);

      c2.send({ type: 'borrow_status' });
      const status = await c2.waitFor('borrow_status');
      expect(status.refusalCount).toBe(3);
      expect(status.shouldTriggerBorrow).toBe(true);

      c2.send({ type: 'borrow_response', payload: { content: '又不想学' } });
      const proposal = await c2.waitFor('borrow_contract_proposal');
      expect(proposal.dialogue).toContain('聪明分');

      c2.ws.close();
    });
  });

  describe('接受/拒绝对赌', () => {
    test('borrow_accept 接受对赌并返回台词', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_accept`);
      await open(client);

      for (let i = 0; i < 3; i++) {
        client.send({ type: 'borrow_response', payload: { content: '不想学' } });
        await client.waitFor(i === 2 ? 'borrow_contract_proposal' : 'borrow_state_update');
      }

      client.send({ type: 'borrow_accept' });
      const accepted = await client.waitFor('borrow_contract_accepted');
      expect(accepted.dialogue).toContain('击掌');

      client.ws.close();
    });

    test('borrow_reject 拒绝对赌，计数器归零', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_reject`);
      await open(client);

      for (let i = 0; i < 3; i++) {
        client.send({ type: 'borrow_response', payload: { content: '不想学' } });
        await client.waitFor(i === 2 ? 'borrow_contract_proposal' : 'borrow_state_update');
      }

      client.send({ type: 'borrow_reject' });
      const rejected = await client.waitFor('borrow_contract_rejected');
      expect(rejected.dialogue).toContain('没关系');
      expect(rejected.refusalCount).toBe(0);

      client.ws.close();
    });

    test('未触发时 borrow_accept 应返回错误', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_err`);
      await open(client);

      client.send({ type: 'borrow_accept' });
      const err = await client.waitFor('error');
      expect(err.message).toBeTruthy();

      client.ws.close();
    });
  });

  describe('对赌结果处理', () => {
    test('borrow_complete(win) 赢得对赌，解锁新故事，得 20 分', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_win`);
      await open(client);

      for (let i = 0; i < 3; i++) {
        client.send({ type: 'borrow_response', payload: { content: '不想学' } });
        await client.waitFor(i === 2 ? 'borrow_contract_proposal' : 'borrow_state_update');
      }
      client.send({ type: 'borrow_accept' });
      await client.waitFor('borrow_contract_accepted');

      client.send({ type: 'borrow_complete', payload: { outcome: 'win' } });
      const completed = await client.waitFor('borrow_contract_completed');

      expect(completed.outcome).toBe('win');
      expect(completed.points).toBe(20);
      expect(completed.storyUnlocked).toBe(true);
      expect(completed.dialogue).toBeTruthy();

      // 完成后状态重置
      client.send({ type: 'borrow_status' });
      const status = await client.waitFor('borrow_status');
      expect(status.refusalCount).toBe(0);

      client.ws.close();
    });

    test('borrow_complete(lose) 输了对赌，获得搞笑任务', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_lose`);
      await open(client);

      for (let i = 0; i < 3; i++) {
        client.send({ type: 'borrow_response', payload: { content: '不想学' } });
        await client.waitFor(i === 2 ? 'borrow_contract_proposal' : 'borrow_state_update');
      }
      client.send({ type: 'borrow_accept' });
      await client.waitFor('borrow_contract_accepted');

      client.send({ type: 'borrow_complete', payload: { outcome: 'lose' } });
      const completed = await client.waitFor('borrow_contract_completed');

      expect(completed.outcome).toBe('lose');
      expect(completed.points).toBe(0);
      expect(completed.funnyTask).toBeDefined();
      expect(completed.funnyTask.id).toBeDefined();

      client.ws.close();
    });

    test('borrow_changed_mind 孩子改变主意，退出对赌', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_mind`);
      await open(client);

      for (let i = 0; i < 3; i++) {
        client.send({ type: 'borrow_response', payload: { content: '不想学' } });
        await client.waitFor(i === 2 ? 'borrow_contract_proposal' : 'borrow_state_update');
      }
      client.send({ type: 'borrow_accept' });
      await client.waitFor('borrow_contract_accepted');

      client.send({ type: 'borrow_changed_mind' });
      const changed = await client.waitFor('borrow_contract_changed_mind');
      expect(changed.dialogue).toBeTruthy();

      client.ws.close();
    });
  });

  describe('不影响既有 WebSocket 流程', () => {
    test('既有 child_response 仍正常返回 fox_dialog', async () => {
      const client = makeClient(`${wsUrl}/ws/voice/issue24_compat`);
      await open(client);

      // 等待初始 APPEARANCE 台词
      await client.waitFor('fox_dialog');

      client.send({
        type: 'child_response',
        payload: { responseTimeMs: 500, content: '你好' }
      });
      const dialog = await client.waitFor('fox_dialog');
      expect(dialog.dialog).toBeTruthy();

      client.ws.close();
    });
  });
});
