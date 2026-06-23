const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { initDB } = require('../../src/db/init');
const sessionRouter = require('../../src/routes/session');

/**
 * 会话 API 路由测试
 *
 * 对应 Issue #27：会话 API 外键约束缺乏友好错误处理
 * 参考技术架构文档§四：POST `/api/session` 开始会话
 */
describe('会话 API - session 路由', () => {
  let app;
  let db;
  let tmpDir;

  beforeEach(() => {
    // 每个测试使用独立的临时数据库，避免相互污染
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fox-friend-session-'));
    const dbPath = path.join(tmpDir, 'test.db');
    db = initDB(dbPath);

    app = express();
    app.use(express.json());
    app.set('db', db);
    app.use('/api/session', sessionRouter);
  });

  afterEach(() => {
    if (db) db.close();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('POST /api/session - 创建会话', () => {
    test('使用不存在的 child_id 时，返回 400 和友好错误信息（Issue #27）', async () => {
      const res = await request(app)
        .post('/api/session')
        .send({ child_id: 'nonexistent' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'child_id does not exist, please create profile first'
      });
    });

    test('使用有效的 child_id 时，返回 201 创建成功', async () => {
      // 先创建一个 child_profile 以满足外键约束
      const profileId = 'child-valid-001';
      db.prepare(
        'INSERT INTO child_profiles (id, nickname) VALUES (?, ?)'
      ).run(profileId, '闪电');

      const res = await request(app)
        .post('/api/session')
        .send({ child_id: profileId });

      expect(res.status).toBe(201);
      expect(res.body.child_id).toBe(profileId);
      expect(res.body.status).toBe('active');
    });
  });

  describe('GET /api/session/:id - 获取会话信息', () => {
    test('会话存在时返回会话数据', async () => {
      // 先创建画像和会话
      const profileId = 'child-get-001';
      const sessionId = 'session-get-001';
      db.prepare(
        'INSERT INTO child_profiles (id, nickname) VALUES (?, ?)'
      ).run(profileId, '小天');
      db.prepare(
        'INSERT INTO sessions (id, child_id) VALUES (?, ?)'
      ).run(sessionId, profileId);

      const res = await request(app).get(`/api/session/${sessionId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(sessionId);
      expect(res.body.child_id).toBe(profileId);
    });

    test('会话不存在时返回 404', async () => {
      const res = await request(app).get('/api/session/nonexistent-session');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('会话不存在');
    });
  });
});
