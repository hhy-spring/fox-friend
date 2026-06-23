/**
 * Issue #18 修复测试：兴趣分型台词在 WebSocket 流中正确触发
 *
 * Bug 描述：在 WebSocket 流中，孩子说出名字后，系统始终返回通用求助台词
 *          而非对应的命名仪式崇拜回应。兴趣分型（dinosaur/princess/speed/generic）
 *          未在 WebSocket 流程中触发。
 *
 * 根因：
 *   1. handleVoiceMessage 在 HELP_REQUEST 状态记录名字后，返回的是 HELP_REQUEST 对话
 *      而非立即创建命名仪式并返回崇拜回应
 *   2. deriveInterestType 使用旧的 NAME_HINTS（仅4个单字），而非 Issue #3 构建的
 *      classifyInterest（完整关键词库）
 *
 * 修复方案：
 *   - 名字记录后立即创建命名仪式实例并返回崇拜回应
 *   - 使用 classifyInterest 替代 deriveInterestType
 *   - 集成 dialogue-brancher 统一兴趣分型入口
 */

const {
  createSessionManager,
  handleVoiceMessage
} = require('../../src/voice/session-manager');
const { classifyInterest } = require('../../src/dialog/interest-classifier');

describe('Issue #18: 兴趣分型台词在 WebSocket 流中正确触发', () => {
  let sessionManager;

  beforeEach(() => {
    sessionManager = createSessionManager();
  });

  /**
   * 辅助函数：将会话从 APPEARANCE 推进到 HELP_REQUEST
   */
  function advanceToHelpRequest() {
    const session = sessionManager.createSession('child_001');
    const sid = session.id;
    // APPEARANCE → HELP_REQUEST
    handleVoiceMessage(sessionManager, sid, {
      type: 'child_response',
      responseTimeMs: 500,
      content: '你好'
    });
    return sid;
  }

  describe('Slice 1: 名字记录后立即返回崇拜回应（非求助台词）', () => {
    test('HELP_REQUEST 收到"恐龙蛋" → 返回恐龙崇拜回应，非求助台词', () => {
      const sid = advanceToHelpRequest();
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '恐龙蛋'
      });

      // 名字应被记录
      expect(result.nameRecorded).toBe(true);
      expect(result.foxName).toBe('恐龙蛋');
      expect(result.nextState).toBe('NAMING_CEREMONY');

      // 关键断言：返回的对话应是崇拜回应，而非求助台词
      expect(result.dialog).toBeDefined();
      expect(result.dialog.mainLine).toContain('恐龙蛋');
      // 崇拜回应应包含恐龙相关内容
      expect(result.dialog.mainLine).toContain('恐龙');
      // 不应包含求助台词的关键句
      expect(result.dialog.mainLine).not.toContain('我还没有名字');
    });

    test('HELP_REQUEST 收到"艾莎" → 返回公主/魔法崇拜回应', () => {
      const sid = advanceToHelpRequest();
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '艾莎'
      });

      expect(result.nameRecorded).toBe(true);
      expect(result.foxName).toBe('艾莎');
      expect(result.dialog.mainLine).toContain('艾莎');
      // 公主/魔法崇拜回应应包含魔法相关内容
      expect(result.dialog.mainLine).toContain('魔法');
      expect(result.dialog.mainLine).not.toContain('我还没有名字');
    });

    test('HELP_REQUEST 收到"闪电" → 返回速度崇拜回应', () => {
      const sid = advanceToHelpRequest();
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '闪电'
      });

      expect(result.nameRecorded).toBe(true);
      expect(result.foxName).toBe('闪电');
      expect(result.dialog.mainLine).toContain('闪电');
      // 速度崇拜回应应包含速度相关内容
      expect(result.dialog.mainLine).toMatch(/嗖|快/);
      expect(result.dialog.mainLine).not.toContain('我还没有名字');
    });

    test('HELP_REQUEST 收到"豆豆" → 返回通用崇拜回应', () => {
      const sid = advanceToHelpRequest();
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '豆豆'
      });

      expect(result.nameRecorded).toBe(true);
      expect(result.foxName).toBe('豆豆');
      expect(result.dialog.mainLine).toContain('豆豆');
      // 通用崇拜回应
      expect(result.dialog.mainLine).toContain('好酷的名字');
      expect(result.dialog.mainLine).not.toContain('我还没有名字');
    });
  });

  describe('Slice 2: 崇拜回应包含兴趣特定的语气词/动作音效', () => {
    test('dinosaur 崇拜回应包含"嗷呜"', () => {
      const sid = advanceToHelpRequest();
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '恐龙蛋'
      });

      expect(result.dialog.mainLine).toContain('嗷呜');
    });

    test('princess 崇拜回应包含"叮"', () => {
      const sid = advanceToHelpRequest();
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '艾莎'
      });

      expect(result.dialog.mainLine).toContain('叮');
    });

    test('speed 崇拜回应包含"嗖"', () => {
      const sid = advanceToHelpRequest();
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '闪电'
      });

      expect(result.dialog.mainLine).toContain('嗖');
    });
  });

  describe('Slice 3: 名字记录后命名仪式实例已创建', () => {
    test('名字记录后 session.ceremony 已初始化', () => {
      const sid = advanceToHelpRequest();
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '恐龙蛋'
      });

      const session = sessionManager.getSession(sid);
      expect(session.ceremony).toBeDefined();
      // Issue #19: 仪式已推进到 ASK_NICKNAME（崇拜回应在 HELP_REQUEST 阶段返回时自动推进）
      expect(session.ceremony.getSubState()).toBe('ASK_NICKNAME');
    });

    test('名字记录后 interestType 已存入 session', () => {
      const sid = advanceToHelpRequest();
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '恐龙蛋'
      });

      const session = sessionManager.getSession(sid);
      expect(session.interestType).toBe('dinosaur');
    });
  });

  describe('Slice 4: 使用 classifyInterest 而非旧 deriveInterestType', () => {
    test('classifyInterest 正确分类"恐龙蛋"为 dinosaur', () => {
      const result = classifyInterest('恐龙蛋');
      expect(result.type).toBe('dinosaur');
      expect(result.isClassified).toBe(true);
    });

    test('classifyInterest 正确分类"霸王龙"为 dinosaur（旧 deriveInterestType 无法识别）', () => {
      // 旧的 deriveInterestType 基于 NAME_HINTS，只有 '龙' 字符
      // 但 classifyInterest 有完整关键词库包括 '霸王龙'
      const result = classifyInterest('霸王龙');
      expect(result.type).toBe('dinosaur');
    });

    test('classifyInterest 正确分类"赛车手"为 speed（旧 deriveInterestType 无法识别）', () => {
      const result = classifyInterest('赛车手');
      expect(result.type).toBe('speed');
    });

    test('classifyInterest 正确分类"魔法仙子"为 princess（旧 deriveInterestType 无法识别）', () => {
      const result = classifyInterest('魔法仙子');
      expect(result.type).toBe('princess');
    });
  });

  describe('Slice 5: 后续 NAMING_CEREMONY 流程不受影响', () => {
    test('名字记录后返回崇拜回应 + 昵称问题（Issue #19: 同一响应中返回）', () => {
      const sid = advanceToHelpRequest();
      // 记录名字 + 返回崇拜回应 + 昵称问题
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '闪电'
      });

      // 崇拜回应
      expect(result.dialog).toBeDefined();
      expect(result.dialog.mainLine).toContain('闪电');

      // Issue #19: 同时返回昵称问题
      expect(result.nextQuestion).toBeDefined();
      expect(result.nextQuestion.field).toBe('nickname');
      expect(result.nextQuestion.mainLine).toContain('你叫什么');
      expect(result.ceremonySubState).toBe('ASK_NICKNAME');
    });

    test('完整命名仪式流程仍可正常完成', () => {
      const sid = advanceToHelpRequest();
      // 记录名字 + 返回崇拜回应 + 推进到 ASK_NICKNAME
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 800, content: '闪电'
      });
      // Issue #19: 不再需要"好酷"消息，直接回答昵称
      // 回答昵称
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1200, content: '小明'
      });
      // 回答年龄
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1000, content: '6岁'
      });
      // 回答兴趣
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1500, content: '画画'
      });
      // 回答技能
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1200, content: '跑步很快'
      });

      expect(result.ceremonyComplete).toBe(true);
      expect(result.profile.nickname).toBe('小明');
      expect(result.profile.age).toBe(6);
      expect(result.nextState).toBe('FEYNMAN_TRIGGER');
    });
  });

  describe('Slice 6: 兴趣分型结果写入 session 上下文', () => {
    test('session 包含 classificationResult（分类完整结果）', () => {
      const sid = advanceToHelpRequest();
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '恐龙蛋'
      });

      const session = sessionManager.getSession(sid);
      expect(session.classificationResult).toBeDefined();
      expect(session.classificationResult.type).toBe('dinosaur');
      expect(session.classificationResult.foxName).toBe('恐龙蛋');
      expect(session.classificationResult.isClassified).toBe(true);
    });

    test('generic 类型也记录 classificationResult', () => {
      const sid = advanceToHelpRequest();
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '豆豆'
      });

      const session = sessionManager.getSession(sid);
      expect(session.classificationResult).toBeDefined();
      expect(session.classificationResult.type).toBe('generic');
      expect(session.classificationResult.isClassified).toBe(false);
    });
  });

  describe('Slice 7: NAMING_CEREMONY fallback 路径（手动状态转换）', () => {
    test('手动转换到 NAMING_CEREMONY（ceremony 未创建）→ fallback 创建仪式并返回崇拜回应', () => {
      const session = sessionManager.createSession('child_001');
      const sid = session.id;
      // 按有效路径转换到 HELP_REQUEST，但不通过 handleVoiceMessage（不创建 ceremony）
      sessionManager.updateState(sid, 'HELP_REQUEST');
      // 手动设置画像
      sessionManager.updateProfile(sid, { foxName: '闪电', foxNameSource: 'child_choice' });
      // 直接修改 fsm 内部状态以到达 NAMING_CEREMONY（模拟未创建 ceremony 的情况）
      session.fsm.currentState = 'NAMING_CEREMONY';
      session.fsmState = 'NAMING_CEREMONY';

      // 发送消息 → 应触发 fallback 创建仪式
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 1000,
        content: '嗯'
      });

      // fallback 应创建仪式并返回崇拜回应
      expect(result.dialog).toBeDefined();
      expect(result.dialog.mainLine).toContain('闪电');
      // Issue #19: fallback 也推进到 ASK_NICKNAME，与主路径一致
      expect(result.ceremonySubState).toBe('ASK_NICKNAME');
      expect(result.nextQuestion).toBeDefined();
      expect(result.nextQuestion.field).toBe('nickname');

      // session 应有 ceremony、interestType、classificationResult
      const updatedSession = sessionManager.getSession(sid);
      expect(updatedSession.ceremony).toBeDefined();
      expect(updatedSession.interestType).toBe('speed');
      expect(updatedSession.classificationResult).toBeDefined();
    });
  });
});
