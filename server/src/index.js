const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { initDB } = require('./db/init');
const sessionRouter = require('./routes/session');
const profileRouter = require('./routes/profile');
const metricsRouter = require('./routes/metrics');

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());

// CORS 支持（Issue #29：前端 Vue3 SPA 跨域访问 API）
// 使用白名单替代通配符 *，防止任意网站读取孩子画像隐私数据
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(s => s.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

// 静态文件服务（Issue #29：托管前端界面）
app.use(express.static(path.join(__dirname, '..', 'public')));

// 初始化数据库（在路由注册之前完成，确保路由 handler 可访问 db）
const dbPath = path.join(__dirname, '..', 'data', 'fox-friend.db');
const db = initDB(dbPath);
app.set('db', db);

// 路由
app.use('/api/session', sessionRouter);
app.use('/api/profile', profileRouter);
app.use('/api/profile', metricsRouter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// SPA 回退路由：所有非 API 请求返回 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 创建 HTTP/HTTPS 服务器（当证书存在时启用 HTTPS，麦克风需要安全上下文）
// 证书路径可通过环境变量覆盖；默认使用项目根目录的 certs/
const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '..', '..', 'certs', 'cert.pem');
const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '..', '..', 'certs', 'key.pem');
const useHttps = process.env.USE_HTTPS !== 'false' && fs.existsSync(certPath) && fs.existsSync(keyPath);

let server;
if (useHttps) {
  const sslOptions = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath)
  };
  server = https.createServer(sslOptions, app);
  console.log('启用 HTTPS（麦克风需要安全上下文）');
} else {
  server = http.createServer(app);
}

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ server });

// WebSocket 连接处理（使用功能完整的 ws-voice-handler，支持每日见面 + 借分契约）
// 参考技术架构文档§四：WS `/ws/voice/{child_id}`
const { createWSServer } = require('./voice/ws-voice-handler');
const wsServer = createWSServer({
  db,
  storageDir: path.join(__dirname, '..', 'data')
});

wss.on('connection', (ws, req) => {
  wsServer.handleVoiceConnection(ws, req);
});

// 启动服务器
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`服务器已启动，监听端口 ${PORT}`);
  });
}

module.exports = { app, server };
