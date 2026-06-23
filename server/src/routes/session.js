const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// 创建新会话
router.post('/', (req, res) => {
  const db = req.app.get('db');
  const id = uuidv4();
  const { child_id } = req.body;

  // 校验 child_id 是否存在，避免外键约束失败时返回原始 500 错误（Issue #27）
  if (child_id) {
    const profile = db.prepare(
      'SELECT id FROM child_profiles WHERE id = ?'
    ).get(child_id);
    if (!profile) {
      return res.status(400).json({
        error: 'child_id does not exist, please create profile first'
      });
    }
  }

  try {
    db.prepare(
      'INSERT INTO sessions (id, child_id) VALUES (?, ?)'
    ).run(id, child_id || null);
    res.status(201).json({ id, child_id, status: 'active' });
  } catch (err) {
    console.error('创建会话失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取会话信息
router.get('/:id', (req, res) => {
  const db = req.app.get('db');
  const session = db.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).get(req.params.id);

  if (!session) {
    return res.status(404).json({ error: '会话不存在' });
  }
  res.json(session);
});

module.exports = router;
