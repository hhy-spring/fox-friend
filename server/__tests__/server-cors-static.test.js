const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { app } = require('../src/index');

/**
 * 服务器 CORS 支持与静态文件服务测试
 *
 * 对应 Issue #29：服务器缺少 CORS 支持和静态文件服务
 * 参考技术架构文档§二：前端 Vue3 SPA + 后端 Express.js，需跨域访问 API
 */
describe('服务器 CORS 与静态文件服务 - Issue #29', () => {
  const publicDir = path.join(__dirname, '..', 'public');
  const testFileName = 'test-cors-page.html';
  const testFilePath = path.join(publicDir, testFileName);
  const testFileContent = '<!DOCTYPE html><html><body>fox-friend test page</body></html>';

  beforeAll(() => {
    // 创建测试用静态文件（express.static 在每次请求时读取文件系统，故运行时创建即可）
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.writeFileSync(testFilePath, testFileContent, 'utf-8');
  });

  afterAll(() => {
    // 清理测试文件，保留 public 目录
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe('CORS 支持', () => {
    // 使用白名单内的 Origin（index.js 默认允许 localhost:5173 和 localhost:3000）
    const ALLOWED_ORIGIN = 'http://localhost:5173';

    test('GET /health 带白名单 Origin 时应包含 Access-Control-Allow-Origin 头', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', ALLOWED_ORIGIN);

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    });

    test('带白名单 Origin 的请求应返回对应的 Access-Control-Allow-Origin', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', ALLOWED_ORIGIN);

      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    });

    test('非白名单 Origin 的请求不应返回 Access-Control-Allow-Origin 头', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://evil-site.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('OPTIONS 预检请求应返回 204 并包含完整 CORS 头', async () => {
      const res = await request(app)
        .options('/api/profile')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-methods']).toBeDefined();
      expect(res.headers['access-control-allow-headers']).toBeDefined();
    });

    test('CORS 应允许常见 HTTP 方法（GET、POST、PUT、DELETE）', async () => {
      const res = await request(app)
        .options('/api/profile')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST');

      const methods = res.headers['access-control-allow-methods'] || '';
      expect(methods.toUpperCase()).toContain('GET');
      expect(methods.toUpperCase()).toContain('POST');
      expect(methods.toUpperCase()).toContain('PUT');
      expect(methods.toUpperCase()).toContain('DELETE');
    });

    test('CORS 应允许 Content-Type 请求头', async () => {
      const res = await request(app)
        .options('/api/profile')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Headers', 'Content-Type');

      const allowedHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase();
      expect(allowedHeaders).toContain('content-type');
    });

    test('API 路由响应也应包含 CORS 头（跨域访问核心场景）', async () => {
      const res = await request(app)
        .get('/api/profile/nonexistent')
        .set('Origin', ALLOWED_ORIGIN);

      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    });
  });

  describe('静态文件服务', () => {
    test('GET /test-cors-page.html 应返回静态文件内容', async () => {
      const res = await request(app).get(`/${testFileName}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain('fox-friend test page');
    });

    test('静态 HTML 文件应返回正确的 Content-Type', async () => {
      const res = await request(app).get(`/${testFileName}`);

      expect(res.headers['content-type']).toMatch(/html/i);
    });

    test('请求不存在的静态文件应返回 404', async () => {
      const res = await request(app).get('/this-file-does-not-exist.html');

      expect(res.status).toBe(404);
    });
  });
});
