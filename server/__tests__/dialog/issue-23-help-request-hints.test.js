/**
 * Issue #23 TDD 测试 - 步骤2求助台词和暗示选项消息结构修复
 *
 * 参考技术架构执行摘要§三「对话引擎架构」
 * 参考技术架构执行摘要§五「MVP验证指标」
 *
 * 测试策略：垂直切片（tracer bullet）
 *   每个测试验证一个行为，通过公共接口验证
 */

const {
  createSessionManager,
  handleVoiceMessage
} = require('../../src/voice/session-manager');
const {
  isNameProvided,
  extractName,
  processChildInput
} = require('../../src/dialog/name-processor');
const { isGreeting } = require('../../src/dialog/greeting-filter');
const { getNameHints, getNameHintsLine, NAME_HINTS } = require('../../src/dialog/name-hints');

describe('Issue #23 - 步骤2求助台词和暗示选项消息结构修复', () => {
  describe('Slice 1: 名字检测逻辑 - "你好小狐狸" 不应被识别为名字', () => {
    test('"你好小狐狸" 不应被识别为名字', () => {
      // Issue #23: "你好小狐狸" 是问候语+角色称呼，不是名字
      const result = isNameProvided('你好小狐狸');
      expect(result).toBe(false);
    });

    test('"你好小狐狸" 不应提取出名字', () => {
      const result = extractName('你好小狐狸');
      expect(result).toBeNull();
    });

    test('processChildInput 对 "你好小狐狸" 应返回 nameRecorded: false', () => {
      const result = processChildInput({
        childContent: '你好小狐狸',
        currentStep: 'HELP_REQUEST',
        fsm: { getState: () => 'HELP_REQUEST' }
      });
      expect(result.nameRecorded).toBe(false);
      expect(result.showHints).toBe(true);
    });
  });

  describe('Slice 4: handleVoiceMessage 返回完整 hint 结构', () => {
    let sessionManager;

    beforeEach(() => {
      sessionManager = createSessionManager();
    });

    test('HELP_REQUEST 状态收到 "你好小狐狸" → 返回 showHints + hints', () => {
      const session = sessionManager.createSession('child_001');
      sessionManager.updateState(session.id, 'HELP_REQUEST');

      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: '你好小狐狸'
      });

      // 步骤应保持 HELP_REQUEST
      expect(result.nextState).toBe('HELP_REQUEST');
      // 名字不应被记录
      expect(result.nameRecorded).toBe(false);
      // 必须包含 showHints 和 hints
      expect(result.showHints).toBe(true);
      expect(result.hints).toBeDefined();
      expect(Array.isArray(result.hints)).toBe(true);
      expect(result.hints.length).toBeGreaterThanOrEqual(3);
      // 必须包含 hintLine
      expect(result.hintLine).toBeDefined();
      expect(typeof result.hintLine).toBe('string');
    });

    test('HELP_REQUEST 状态收到 "不知道" → 返回 showHints + hints', () => {
      const session = sessionManager.createSession('child_001');
      sessionManager.updateState(session.id, 'HELP_REQUEST');

      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 2000,
        content: '不知道'
      });

      expect(result.nextState).toBe('HELP_REQUEST');
      expect(result.nameRecorded).toBe(false);
      expect(result.showHints).toBe(true);
      expect(result.hints).toBeDefined();
      expect(result.hints.length).toBeGreaterThanOrEqual(3);
    });

    test('hints 包含正确的兴趣类型映射', () => {
      const session = sessionManager.createSession('child_001');
      sessionManager.updateState(session.id, 'HELP_REQUEST');

      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: '你好小狐狸'
      });

      const interestTypes = result.hints.map(h => h.interestType);
      expect(interestTypes).toContain('dinosaur');
      expect(interestTypes).toContain('speed');
      expect(interestTypes).toContain('princess');
    });

    test('hints 每项包含 character 和 example 字段', () => {
      const session = sessionManager.createSession('child_001');
      sessionManager.updateState(session.id, 'HELP_REQUEST');

      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: '你好小狐狸'
      });

      result.hints.forEach(hint => {
        expect(hint.character).toBeDefined();
        expect(typeof hint.character).toBe('string');
        expect(hint.example).toBeDefined();
        expect(typeof hint.example).toBe('string');
      });
    });
  });
});
