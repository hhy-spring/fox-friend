const express = require('express');
const Database = require('better-sqlite3');
const request = require('supertest');
const metricsRouter = require('../../src/routes/metrics');

// 构建测试用 Express 应用，挂载 metrics 路由
function buildApp(db) {
  const app = express();
  app.use(express.json());
  app.set('db', db);
  // 路由设计：GET /api/profile/:id/metrics
  app.use('/api/profile', metricsRouter);
  return app;
}

// 创建内存数据库并建表
function createMemoryDB() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE child_profiles (
      id TEXT PRIMARY KEY,
      nickname TEXT,
      age INTEGER,
      interests TEXT,
      self_claimed_skills TEXT,
      fox_name TEXT,
      fox_name_source TEXT,
      first_meeting_reactions TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);
  return db;
}

describe('情感连接指标查询 API - GET /api/profile/:id/metrics', () => {
  let db;
  let app;

  beforeEach(() => {
    db = createMemoryDB();
    app = buildApp(db);
  });

  afterEach(() => {
    db.close();
  });

  test('孩子存在且有指标时，返回 200 + 完整 metrics', async () => {
    // 准备：插入一条带 first_meeting_reactions 的孩子记录
    const childId = 'child-001';
    const reactions = {
      proactive_speech_count: 3,
      teaching_willingness: null,
      partner_acceptance: null,
      retention_intention: true
    };
    db.prepare(`
      INSERT INTO child_profiles (id, nickname, first_meeting_reactions)
      VALUES (?, ?, ?)
    `).run(childId, '闪电', JSON.stringify(reactions));

    // 执行
    const res = await request(app).get(`/api/profile/${childId}/metrics`);

    // 验证
    expect(res.status).toBe(200);
    expect(res.body.childId).toBe(childId);
    expect(res.body.metrics).toEqual({
      proactive_speech_count: 3,
      teaching_willingness: null,
      partner_acceptance: null,
      retention_intention: true,
      emotional_connection_established: true
    });
  });

  test('孩子存在但 first_meeting_reactions 为 null 时，返回 200 + metrics=null + 提示消息', async () => {
    // 准备：插入一条 first_meeting_reactions 为 null 的孩子记录
    const childId = 'child-002';
    db.prepare(`
      INSERT INTO child_profiles (id, nickname, first_meeting_reactions)
      VALUES (?, ?, ?)
    `).run(childId, '小天', null);

    // 执行
    const res = await request(app).get(`/api/profile/${childId}/metrics`);

    // 验证
    expect(res.status).toBe(200);
    expect(res.body.childId).toBe(childId);
    expect(res.body.metrics).toBeNull();
    expect(res.body.message).toBe('暂无情感连接指标数据');
  });

  test('孩子不存在时，返回 404 + 错误信息', async () => {
    // 执行：查询一个不存在的孩子 id
    const res = await request(app).get('/api/profile/non-existent-child/metrics');

    // 验证
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('孩子画像不存在');
  });

  test('proactive_speech_count >= 3 时，emotional_connection_established=true', async () => {
    // 准备：proactive_speech_count=5（>=3）
    const childId = 'child-003';
    const reactions = {
      proactive_speech_count: 5,
      teaching_willingness: true,
      partner_acceptance: true,
      retention_intention: true
    };
    db.prepare(`
      INSERT INTO child_profiles (id, nickname, first_meeting_reactions)
      VALUES (?, ?, ?)
    `).run(childId, '小明', JSON.stringify(reactions));

    // 执行
    const res = await request(app).get(`/api/profile/${childId}/metrics`);

    // 验证
    expect(res.status).toBe(200);
    expect(res.body.metrics.proactive_speech_count).toBe(5);
    expect(res.body.metrics.emotional_connection_established).toBe(true);
  });

  test('proactive_speech_count < 3 时，emotional_connection_established=false', async () => {
    // 准备：proactive_speech_count=2（<3）
    const childId = 'child-004';
    const reactions = {
      proactive_speech_count: 2,
      teaching_willingness: false,
      partner_acceptance: false,
      retention_intention: false
    };
    db.prepare(`
      INSERT INTO child_profiles (id, nickname, first_meeting_reactions)
      VALUES (?, ?, ?)
    `).run(childId, '小红', JSON.stringify(reactions));

    // 执行
    const res = await request(app).get(`/api/profile/${childId}/metrics`);

    // 验证
    expect(res.status).toBe(200);
    expect(res.body.metrics.proactive_speech_count).toBe(2);
    expect(res.body.metrics.emotional_connection_established).toBe(false);
  });
});
