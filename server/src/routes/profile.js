const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/**
 * 画像 API
 * 参考技术架构文档§四：POST `/api/profile` 创建/更新画像
 */

// 创建/更新画像
router.post('/', (req, res) => {
  const db = req.app.get('db');
  const id = uuidv4();
  const {
    nickname, age, interests, self_claimed_skills,
    fox_name, fox_name_source
  } = req.body;

  try {
    db.prepare(`
      INSERT INTO child_profiles (id, nickname, age, interests, self_claimed_skills, fox_name, fox_name_source)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      nickname || null,
      age || null,
      interests ? JSON.stringify(interests) : null,
      self_claimed_skills ? JSON.stringify(self_claimed_skills) : null,
      fox_name || null,
      fox_name_source || null
    );
    res.status(201).json({
      id,
      nickname,
      age,
      interests,
      self_claimed_skills,
      fox_name,
      fox_name_source
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取画像
router.get('/:id', (req, res) => {
  const db = req.app.get('db');
  const profile = db.prepare(
    'SELECT * FROM child_profiles WHERE id = ?'
  ).get(req.params.id);

  if (!profile) {
    return res.status(404).json({ error: '画像不存在' });
  }

  // 解析 JSON 字段
  if (profile.interests) profile.interests = JSON.parse(profile.interests);
  if (profile.self_claimed_skills) profile.self_claimed_skills = JSON.parse(profile.self_claimed_skills);

  res.json(profile);
});

module.exports = router;
