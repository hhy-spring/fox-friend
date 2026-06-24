/**
 * HTTP 语音路由 — WebSocket 的备选方案
 *
 * 当预览环境代理不支持 WebSocket 升级时，前端降级使用 HTTP 轮询。
 * 复用 ws-voice-handler 的对话引擎和语音管道，仅替换传输层。
 *
 * 流程：
 *   1. POST /api/voice/session          → 创建会话，返回初始 fox_dialog
 *   2. POST /api/voice/audio            → 上传音频，返回 voice_reply
 *   3. POST /api/voice/response         → 发送文本回复，返回 fox_dialog
 *   4. GET  /api/voice/session/:id      → 查询会话状态
 */

const express = require('express');
const { createASREngine } = require('../voice/asr-engine');
const { createTTSEngine, TTS_EMOTIONS } = require('../voice/tts-engine');
const { createVAD } = require('../voice/vad');
const { createVoicePipeline } = require('../voice/voice-pipeline');
const { createSessionManager, handleVoiceMessage } = require('../voice/session-manager');
const { detectReaction, getStepDialog, REACTION_TYPES } = require('../dialog/dialog-engine');
const { loadProfile } = require('../dialog/profile-persistence');
const { createSessionStateManager } = require('../dialog/session-state');
const { createDailyMeetingOrchestrator } = require('../dialog/daily-meeting-orchestrator');

const router = express.Router();

// 内存存储会话与管道（与 ws-voice-handler 一致的结构）
const sessions = new Map();
const pipelines = new Map();

/**
 * 创建语音管道（复用 ws-voice-handler 的逻辑）
 */
function createPipelineForSession(sessionId, sessionManager, storageDir) {
  const asr = createASREngine({ type: 'mock', childMode: true, language: 'zh-CN' });
  const tts = createTTSEngine({ type: 'mock' });
  const vad = createVAD({ silenceThresholdMs: 500 });

  const dialogHandler = async (text) => {
    let replyText = '';
    let emotion = TTS_EMOTIONS.HAPPY;

    if (!text || text.trim().length === 0) {
      replyText = '你还在吗？';
      emotion = TTS_EMOTIONS.CURIOUS;
    } else if (text.includes('你好') || text.includes('嗨')) {
      replyText = '你好你好！我一直在等你呢！';
      emotion = TTS_EMOTIONS.HAPPY;
    } else if (text.includes('害怕') || text.includes('怕')) {
      replyText = '别怕别怕，有我在呢！';
      emotion = TTS_EMOTIONS.NERVOUS;
    } else {
      replyText = `嗯嗯，${text}，我听到了！`;
      emotion = TTS_EMOTIONS.CURIOUS;
    }
    return { replyText, emotion };
  };

  return createVoicePipeline({ asr, tts, vad, dialogHandler, timeoutMs: 3000 });
}

/**
 * POST /api/voice/session — 创建会话
 * 触发第一次见面或每日见面流程，返回初始 fox_dialog
 */
router.post('/session', async (req, res) => {
  try {
    const childId = req.body?.child_id || 'default-child';
    const storageDir = req.app.get('storageDir') || null;
    const db = req.app.get('db');

    const sessionManager = createSessionManager(db);
    const session = sessionManager.createSession(childId);
    const pipeline = createPipelineForSession(session.id, sessionManager, storageDir);

    sessions.set(session.id, { session, sessionManager, storageDir });
    pipelines.set(session.id, pipeline);

    // 检查是否有画像
    const profileResult = storageDir
      ? loadProfile(childId, { storageDir })
      : { success: false };

    let response = {
      sessionId: session.id,
      stepInfo: session.fsm.getStepInfo()
    };

    if (profileResult.success) {
      // 每日见面
      const sessionStateManager = storageDir
        ? createSessionStateManager({ storageDir })
        : null;
      const orchestrator = createDailyMeetingOrchestrator({ sessionStateManager });
      const sessionCount = sessionStateManager
        ? sessionStateManager.getSessionCount(childId) + 1
        : 1;

      try {
        const result = await orchestrator.generateDailyOpening({
          childId,
          childProfile: profileResult.profile,
          sessionCount
        });
        response.type = 'fox_dialog';
        response.step = 'DAILY_MEETING';
        response.dialog = result.error
          ? { mainLine: `${profileResult.profile.nickname || '小伙伴'}！快过来，我发现了一件事！`, followUp: null }
          : { mainLine: result.openingText, followUp: null };
        response.stepInfo = { state: 'DAILY_MEETING', currentStep: 0, description: '每日见面' };
      } catch (err) {
        response.type = 'fox_dialog';
        response.step = 'DAILY_MEETING';
        response.dialog = { mainLine: `${profileResult.profile.nickname || '小伙伴'}！快过来，我发现了一件事！`, followUp: null };
        response.stepInfo = { state: 'DAILY_MEETING', currentStep: 0, description: '每日见面' };
        response.error = err.message;
      }
    } else {
      // 第一次见面
      const appearanceDialog = getStepDialog('APPEARANCE', REACTION_TYPES.QUICK);
      response.type = 'fox_dialog';
      response.step = 'APPEARANCE';
      response.dialog = appearanceDialog;
      response.stepInfo = session.fsm.getStepInfo();
    }

    res.json(response);
  } catch (err) {
    console.error('创建语音会话失败:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/voice/audio — 上传音频，返回语音回复
 */
router.post('/audio', async (req, res) => {
  try {
    const sessionId = req.body?.sessionId;
    const audioBase64 = req.body?.audio;

    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(404).json({ error: '会话不存在，请先创建会话' });
    }
    if (!audioBase64) {
      return res.status(400).json({ error: '缺少音频数据' });
    }

    const pipeline = pipelines.get(sessionId);
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const result = await pipeline.processAudio(audioBuffer);

    res.json({
      type: 'voice_reply',
      replyText: result.replyText,
      emotion: result.emotion,
      latencyMs: result.latencyMs,
      latencyBreakdown: result.latencyBreakdown,
      fallback: result.fallback || false,
      audio: result.replyAudio ? result.replyAudio.toString('base64') : null
    });
  } catch (err) {
    console.error('处理音频失败:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/voice/response — 发送文本回复，返回 fox_dialog
 */
router.post('/response', (req, res) => {
  try {
    const sessionId = req.body?.sessionId;
    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(404).json({ error: '会话不存在，请先创建会话' });
    }

    const { session, sessionManager } = sessions.get(sessionId);
    const result = handleVoiceMessage(sessionManager, sessionId, {
      type: 'child_response',
      responseTimeMs: req.body?.responseTimeMs || 0,
      content: req.body?.content || ''
    });

    const message = {
      type: 'fox_dialog',
      step: result.nextState,
      dialog: result.dialog,
      stepInfo: result.stepInfo
    };

    if (result.nameRecorded !== undefined) {
      message.nameRecorded = result.nameRecorded;
      if (result.foxName !== undefined) message.foxName = result.foxName;
      if (result.nameSource !== undefined) message.nameSource = result.nameSource;
    }
    if (result.showHints !== undefined) message.showHints = result.showHints;
    if (result.hints !== undefined) message.hints = result.hints;
    if (result.hintLine !== undefined) message.hintLine = result.hintLine;

    res.json(message);
  } catch (err) {
    console.error('处理文本回复失败:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/voice/session/:id — 查询会话状态
 */
router.get('/session/:id', (req, res) => {
  const sessionId = req.params.id;
  if (!sessions.has(sessionId)) {
    return res.status(404).json({ error: '会话不存在' });
  }
  const { session } = sessions.get(sessionId);
  res.json({
    sessionId,
    stepInfo: session.fsm.getStepInfo()
  });
});

module.exports = router;
