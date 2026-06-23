const express = require('express');

const router = express.Router();

/**
 * 情感连接指标查询 API
 * GET /api/profile/:id/metrics
 *
 * 参考技术架构文档：first_meeting_reactions 存储首次见面反应指标
 * emotional_connection_established = proactive_speech_count >= 3
 */

// 获取孩子的情感连接指标
router.get('/:id/metrics', (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;

  // 查询孩子画像记录
  const profile = db.prepare(
    'SELECT first_meeting_reactions FROM child_profiles WHERE id = ?'
  ).get(id);

  // 孩子不存在 → 404
  if (!profile) {
    return res.status(404).json({ error: '孩子画像不存在' });
  }

  // 指标为空 → 200 + metrics=null
  if (!profile.first_meeting_reactions) {
    return res.status(200).json({
      childId: id,
      metrics: null,
      message: '暂无情感连接指标数据'
    });
  }

  // 解析指标 JSON（防御性解析，避免非法 JSON 导致 500）
  let reactions;
  try {
    reactions = JSON.parse(profile.first_meeting_reactions);
  } catch {
    return res.status(200).json({
      childId: id,
      metrics: null,
      message: '情感连接指标数据格式异常'
    });
  }

  // 计算情感连接是否建立并返回
  const metrics = {
    proactive_speech_count: reactions.proactive_speech_count,
    teaching_willingness: reactions.teaching_willingness,
    partner_acceptance: reactions.partner_acceptance,
    retention_intention: reactions.retention_intention,
    emotional_connection_established: reactions.proactive_speech_count >= 3
  };

  res.status(200).json({ childId: id, metrics });
});

module.exports = router;
