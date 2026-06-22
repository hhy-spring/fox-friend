const {
  createSessionManager,
  handleVoiceMessage
} = require('../../src/voice/session-manager');

describe('会话管理器 - WebSocket 语音端点', () => {
  let sessionManager;

  beforeEach(() => {
    sessionManager = createSessionManager();
  });

  describe('会话创建与获取', () => {
    test('创建新会话，初始状态为 APPEARANCE', () => {
      const session = sessionManager.createSession('child_001');
      expect(session.childId).toBe('child_001');
      expect(session.fsmState).toBe('APPEARANCE');
      expect(session.id).toBeDefined();
    });

    test('获取已存在的会话', () => {
      const created = sessionManager.createSession('child_001');
      const retrieved = sessionManager.getSession(created.id);
      expect(retrieved.childId).toBe('child_001');
    });

    test('获取不存在的会话返回 null', () => {
      const result = sessionManager.getSession('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('语音消息处理', () => {
    test('APPEARANCE 状态收到秒回 → 返回出场台词 + 转换到 HELP_REQUEST', () => {
      const session = sessionManager.createSession('child_001');
      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: '你好'
      });

      expect(result.dialog.mainLine).toContain('你好你好');
      expect(result.nextState).toBe('HELP_REQUEST');
    });

    test('HELP_REQUEST 状态收到名字 → 记录名字 + 转换到 NAMING_CEREMONY', () => {
      const session = sessionManager.createSession('child_001');
      // 先转换到 HELP_REQUEST
      sessionManager.updateState(session.id, 'HELP_REQUEST');

      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '闪电'
      });

      expect(result.nameRecorded).toBe(true);
      expect(result.foxName).toBe('闪电');
      expect(result.nextState).toBe('NAMING_CEREMONY');
    });

    test('HELP_REQUEST 状态收到"不知道" → 返回暗示选项', () => {
      const session = sessionManager.createSession('child_001');
      sessionManager.updateState(session.id, 'HELP_REQUEST');

      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 2000,
        content: '不知道'
      });

      expect(result.nameRecorded).toBe(false);
      expect(result.showHints).toBe(true);
      expect(result.hints).toBeDefined();
      expect(result.hints.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('会话状态持久化', () => {
    test('更新会话状态后可获取最新状态', () => {
      const session = sessionManager.createSession('child_001');
      sessionManager.updateState(session.id, 'HELP_REQUEST');
      const updated = sessionManager.getSession(session.id);
      expect(updated.fsmState).toBe('HELP_REQUEST');
    });

    test('记录画像数据到会话', () => {
      const session = sessionManager.createSession('child_001');
      sessionManager.updateProfile(session.id, { foxName: '闪电', foxNameSource: 'child_choice' });
      const updated = sessionManager.getSession(session.id);
      expect(updated.profile.foxName).toBe('闪电');
      expect(updated.profile.foxNameSource).toBe('child_choice');
    });

    test('记录主动说话次数', () => {
      const session = sessionManager.createSession('child_001');
      sessionManager.incrementProactiveSpeech(session.id);
      sessionManager.incrementProactiveSpeech(session.id);
      const updated = sessionManager.getSession(session.id);
      expect(updated.proactiveSpeechCount).toBe(2);
    });
  });
});
