const {
  createSessionManager,
  handleVoiceMessage,
  deriveInterestType
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

    test('HELP_REQUEST 状态收到名字 → 记录名字 + 返回崇拜回应 + 转换到 NAMING_CEREMONY', () => {
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
      // Issue #18: 应返回崇拜回应而非求助台词
      expect(result.dialog.mainLine).toContain('闪电');
      expect(result.dialog.mainLine).not.toContain('我还没有名字');
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

  describe('NAMING_CEREMONY 状态处理', () => {
    let sessionManager;

    // 辅助函数：将会话推进到 NAMING_CEREMONY 的 ASK_NICKNAME 子状态
    // Issue #19 修复：崇拜回应在 HELP_REQUEST 阶段返回时，仪式已自动推进到 ASK_NICKNAME
    // 不再需要额外发送"好酷"消息来触发 WORSHIP→ASK_NICKNAME 转换
    function advanceToNamingCeremony(foxName = '闪电') {
      const session = sessionManager.createSession('child_001');
      const sid = session.id;
      // APPEARANCE → HELP_REQUEST
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 500,
        content: '你好'
      });
      // HELP_REQUEST → NAMING_CEREMONY（提供名字，返回崇拜回应 + 推进到 ASK_NICKNAME）
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response',
        responseTimeMs: 800,
        content: foxName
      });
      return sid;
    }

    // 辅助函数：在 NAMING_CEREMONY 中发送指定条消息
    function sendCeremonyMessages(sid, messages) {
      const results = [];
      for (const msg of messages) {
        results.push(handleVoiceMessage(sessionManager, sid, {
          type: 'child_response',
          responseTimeMs: 1000,
          content: msg
        }));
      }
      return results;
    }

    beforeEach(() => {
      sessionManager = createSessionManager();
    });

    // Slice 1: Issue #18 - 名字记录后立即返回崇拜回应（在 HELP_REQUEST 阶段）
    // Issue #19: 仪式同时推进到 ASK_NICKNAME，返回昵称问题
    test('HELP_REQUEST 提供名字 → 立即返回崇拜式回应 + 创建仪式实例 + 推进到 ASK_NICKNAME', () => {
      const session = sessionManager.createSession('child_001');
      const sid = session.id;
      // APPEARANCE → HELP_REQUEST
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 500, content: '你好'
      });
      // HELP_REQUEST → 提供名字
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 800, content: '闪电'
      });

      // 仪式实例应已创建
      const updatedSession = sessionManager.getSession(sid);
      expect(updatedSession.ceremony).toBeDefined();
      // Issue #19: 仪式已推进到 ASK_NICKNAME（崇拜回应已返回，等待昵称回答）
      expect(updatedSession.ceremony.getSubState()).toBe('ASK_NICKNAME');

      // 返回崇拜式回应（非求助台词）
      expect(result.dialog).toBeDefined();
      expect(result.dialog.mainLine).toContain('闪电');
      // Issue #19: 同时返回昵称问题
      expect(result.nextQuestion).toBeDefined();
      expect(result.nextQuestion.field).toBe('nickname');
      expect(result.ceremonySubState).toBe('ASK_NICKNAME');
      expect(result.nextState).toBe('NAMING_CEREMONY');
    });

    // Slice 2: ASK_NICKNAME 处理昵称回答 → 返回年龄问题
    test('ASK_NICKNAME 子状态处理回答 → 返回昵称问题', () => {
      // Issue #19: advanceToNamingCeremony 后仪式已在 ASK_NICKNAME
      const sid = advanceToNamingCeremony('闪电');
      // 发送昵称回答
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1200, content: '小明'
      });

      expect(result.collectedField).toBe('nickname');
      expect(result.collectedValue).toBe('小明');
      expect(result.dialog.field).toBe('age');
      expect(result.ceremonySubState).toBe('ASK_AGE');
    });

    // Slice 3: 回答年龄问题
    test('回答年龄问题 → 记录年龄，返回兴趣问题', () => {
      const sid = advanceToNamingCeremony('闪电');
      // 回答昵称
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1200, content: '小明'
      });
      // 回答年龄
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1000, content: '6岁'
      });

      expect(result.collectedField).toBe('age');
      expect(result.collectedValue).toBe(6);
      expect(result.dialog.field).toBe('interests');
      expect(result.ceremonySubState).toBe('ASK_INTERESTS');
    });

    // Slice 4: 跳过处理
    test('跳过昵称问题 → 记录为 null，继续下一个问题', () => {
      const sid = advanceToNamingCeremony('闪电');
      // 跳过昵称
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 2000, content: '不知道'
      });

      expect(result.collectedField).toBe('nickname');
      expect(result.collectedValue).toBeNull();
      expect(result.wasSkipped).toBe(true);
      expect(result.ceremonySubState).toBe('ASK_AGE');
    });

    // Slice 5: 完整流程（所有4个问题）
    test('完整流程：回答所有4个问题 → 仪式完成', () => {
      const sid = advanceToNamingCeremony('闪电');
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
      expect(result.profile).toBeDefined();
      expect(result.profile.nickname).toBe('小明');
      expect(result.profile.age).toBe(6);
    });

    // Slice 6: 完成后转换到 FEYNMAN_TRIGGER
    test('仪式完成 → FSM 转换到 FEYNMAN_TRIGGER', () => {
      const sid = advanceToNamingCeremony('闪电');
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1200, content: '小明'
      });
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1000, content: '6岁'
      });
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1500, content: '画画'
      });
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1200, content: '跑步很快'
      });

      expect(result.nextState).toBe('FEYNMAN_TRIGGER');
      const session = sessionManager.getSession(sid);
      expect(session.fsmState).toBe('FEYNMAN_TRIGGER');
    });

    // Slice 7: profile 数据保存到 session
    test('仪式完成 → profile 数据保存到会话', () => {
      const sid = advanceToNamingCeremony('闪电');
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1200, content: '小明'
      });
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1000, content: '6岁'
      });
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1500, content: '画画'
      });
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1200, content: '跑步很快'
      });

      const session = sessionManager.getSession(sid);
      expect(session.profile.nickname).toBe('小明');
      expect(session.profile.age).toBe(6);
      expect(session.profile.interests).toEqual(['画画']);
      // Issue #19: selfClaimedSkills 改为数组格式
      expect(session.profile.selfClaimedSkills).toEqual(['跑步很快']);
      expect(session.profile.proactiveSpeechCountInCeremony).toBeDefined();
    });

    // Slice 8: 主动发言计数
    test('仪式中主动发言计数', () => {
      const sid = advanceToNamingCeremony('闪电');
      // Issue #19: WORSHIP 不再需要单独的消息，仪式已推进到 ASK_NICKNAME
      // 后续4个回答各计1次
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1200, content: '小明'
      });
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1000, content: '6岁'
      });
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1500, content: '画画'
      });
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 1200, content: '跑步很快'
      });

      // 4个回答(4) = 4 (WORSHIP 不再需要单独的消息)
      expect(result.proactiveSpeechCount).toBe(4);
    });

    // Slice 9: deriveInterestType 辅助函数（委托 classifyInterest）
    test('deriveInterestType - 闪电 → speed', () => {
      expect(deriveInterestType('闪电')).toBe('speed');
    });

    test('deriveInterestType - 恐龙蛋 → dinosaur', () => {
      expect(deriveInterestType('恐龙蛋')).toBe('dinosaur');
    });

    test('deriveInterestType - 艾莎 → princess', () => {
      expect(deriveInterestType('艾莎')).toBe('princess');
    });

    test('deriveInterestType - 星星 → generic', () => {
      expect(deriveInterestType('星星')).toBe('generic');
    });

    test('deriveInterestType - null → generic', () => {
      expect(deriveInterestType(null)).toBe('generic');
    });

    test('deriveInterestType - 空字符串 → generic', () => {
      expect(deriveInterestType('')).toBe('generic');
    });

    test('deriveInterestType - 无匹配的名字 → generic', () => {
      expect(deriveInterestType('豆豆')).toBe('generic');
    });

    // Issue #18: 兴趣类型影响崇拜响应内容（在 HELP_REQUEST 阶段返回）
    test('speed 兴趣类型的崇拜响应包含速度相关内容', () => {
      const session = sessionManager.createSession('child_001');
      const sid = session.id;
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 500, content: '你好'
      });
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 800, content: '闪电'
      });
      expect(result.dialog.mainLine).toContain('嗖');
    });

    test('dinosaur 兴趣类型的崇拜响应包含恐龙相关内容', () => {
      const session = sessionManager.createSession('child_001');
      const sid = session.id;
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 500, content: '你好'
      });
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 800, content: '恐龙蛋'
      });
      expect(result.dialog.mainLine).toContain('恐龙');
    });

    test('generic 兴趣类型的崇拜响应包含通用内容', () => {
      const session = sessionManager.createSession('child_001');
      const sid = session.id;
      handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 500, content: '你好'
      });
      const result = handleVoiceMessage(sessionManager, sid, {
        type: 'child_response', responseTimeMs: 800, content: '豆豆'
      });
      expect(result.dialog.mainLine).toContain('好酷的名字');
    });
  });
});
