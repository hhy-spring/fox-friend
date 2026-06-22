const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// 创建新会话
router.post('/', (req, res) => {
  const db = req.app.get('db');
  const id = uuidv4();
  const { child_id } = req.body;

  try {
    db.prepare(
      'INSERT INTO sessions (id, child_id) VALUES (?, ?)'
    ).run(id, child_id || null);
    res.status(201).json({ id, child_id, status: 'active' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
