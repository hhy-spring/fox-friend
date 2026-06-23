const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const { initDB } = require('./db/init');
const sessionRouter = require('./routes/session');
const profileRouter = require('./routes/profile');

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());

// CORS 支持（Issue #29：前端 Vue3 SPA 跨域访问 API）
// 参考技术架构文档§二：前端 Vue3 SPA + 后端 Express.js
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

// 静态文件服务（Issue #29：托管前端界面）
app.use(express.static(path.join(__dirname, '..', 'public')));

// 路由
app.use('/api/session', sessionRouter);
app.use('/api/profile', profileRouter);

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

// 初始化数据库
const dbPath = path.join(__dirname, '..', 'data', 'fox-friend.db');
const db = initDB(dbPath);

// 将 db 实例挂载到 app 上，供路由使用
app.set('db', db);

// 创建 HTTP 服务器
const server = http.createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ server });

// WebSocket 连接处理
// 参考技术架构文档§四：WS `/ws/voice/{child_id}`
wss.on('connection', (ws, req) => {
  const { handleConnection } = require('./voice/ws-handler');
  handleConnection(ws, req);
});

// 启动服务器
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`服务器已启动，监听端口 ${PORT}`);
  });
}

module.exports = { app, server };
