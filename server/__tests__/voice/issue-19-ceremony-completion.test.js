/**
 * Issue #19 复现测试：命名仪式流程无法完成，画像采集失效
 *
 * 复现步骤（来自 GitHub Issue #19）：
 *   1. "你好" → Step 1
 *   2. "恐龙蛋" → Step 2 naming
 *   3. "我叫闪电" → nickname collection
 *   4. "6岁" → age collection
 *   5. "霸王龙" → interest collection
 *   6. "跑步快" → skill collection
 *
 * 期望：ceremonyComplete = true，profile 数据完整
 * 实际（bug）：ceremonyComplete = undefined，profile = undefined
 */

const {
  createSessionManager,
  handleVoiceMessage
} = require('../../src/voice/session-manager');

describe('Issue #19: 命名仪式流程无法完成，画像采集失效', () => {
  let sessionManager;
  let sessionId;

  beforeEach(() => {
    sessionManager = createSessionManager();
    const session = sessionManager.createSession('child_001');
    sessionId = session.id;
  });

  /**
   * 辅助函数：发送语音消息
   */
  function sendMessage(content, responseTimeMs = 1000) {
    return handleVoiceMessage(sessionManager, sessionId, {
      type: 'child_response',
      responseTimeMs,
      content
    });
  }

  /**
   * 辅助函数：按 Issue #19 复现步骤推进到命名仪式
   * 步骤1: "你好" → APPEARANCE → HELP_REQUEST
   * 步骤2: "恐龙蛋" → HELP_REQUEST → NAMING_CEREMONY（返回崇拜回应）
   */
  function advanceToNamingCeremony() {
    sendMessage('你好', 500);        // Step 1
    sendMessage('恐龙蛋', 800);      // Step 2 - 提供名字
  }

  describe('完整流程复现（Issue #19 核心场景）', () => {
    test('4条画像回答后 ceremonyComplete 应为 true', () => {
      advanceToNamingCeremony();
      // 此时崇拜回应已返回，孩子直接回答4个画像问题
      sendMessage('我叫闪电', 1200);  // nickname
      sendMessage('6岁', 1000);       // age
      sendMessage('霸王龙', 1500);    // interests
      const result = sendMessage('跑步快', 1200); // skills

      expect(result.ceremonyComplete).toBe(true);
    });

    test('4条画像回答后 profile 应包含完整画像数据', () => {
      advanceToNamingCeremony();
      sendMessage('我叫闪电', 1200);
      sendMessage('6岁', 1000);
      sendMessage('霸王龙', 1500);
      const result = sendMessage('跑步快', 1200);

      expect(result.profile).toBeDefined();
      expect(result.profile.nickname).toBe('闪电');
      expect(result.profile.age).toBe(6);
      expect(result.profile.interests).toEqual(['霸王龙']);
    });

    test('selfClaimedSkills 应为数组格式', () => {
      advanceToNamingCeremony();
      sendMessage('我叫闪电', 1200);
      sendMessage('6岁', 1000);
      sendMessage('霸王龙', 1500);
      const result = sendMessage('跑步快', 1200);

      expect(result.profile.selfClaimedSkills).toEqual(['跑步快']);
    });

    test('完成后应转换到 FEYNMAN_TRIGGER 状态', () => {
      advanceToNamingCeremony();
      sendMessage('我叫闪电', 1200);
      sendMessage('6岁', 1000);
      sendMessage('霸王龙', 1500);
      const result = sendMessage('跑步快', 1200);

      expect(result.nextState).toBe('FEYNMAN_TRIGGER');
      const session = sessionManager.getSession(sessionId);
      expect(session.fsmState).toBe('FEYNMAN_TRIGGER');
    });
  });

  describe('昵称提取 - "我叫X" 模式', () => {
    test('"我叫闪电" 应提取昵称 "闪电"', () => {
      advanceToNamingCeremony();
      const result = sendMessage('我叫闪电', 1200);

      expect(result.collectedField).toBe('nickname');
      expect(result.collectedValue).toBe('闪电');
    });

    test('"我叫小明" 应提取昵称 "小明"', () => {
      advanceToNamingCeremony();
      const result = sendMessage('我叫小明', 1200);

      expect(result.collectedField).toBe('nickname');
      expect(result.collectedValue).toBe('小明');
    });

    test('直接说名字 "豆豆" 应保留原值', () => {
      advanceToNamingCeremony();
      const result = sendMessage('豆豆', 1200);

      expect(result.collectedField).toBe('nickname');
      expect(result.collectedValue).toBe('豆豆');
    });
  });

  describe('HELP_REQUEST 返回崇拜回应时应同时返回第一个问题', () => {
    test('提供名字后返回崇拜回应 + 昵称问题', () => {
      sendMessage('你好', 500); // APPEARANCE → HELP_REQUEST
      const result = sendMessage('恐龙蛋', 800); // HELP_REQUEST → NAMING_CEREMONY

      // 崇拜回应
      expect(result.dialog).toBeDefined();
      expect(result.dialog.mainLine).toContain('恐龙蛋');

      // 应同时返回昵称问题，让孩子知道要回答什么
      expect(result.nextQuestion).toBeDefined();
      expect(result.nextQuestion.field).toBe('nickname');
      expect(result.nextQuestion.mainLine).toContain('你叫什么');
    });
  });
});
