/**
 * Issue #20 修复测试 - FSM 状态机推进到费曼触发和搭档确认阶段
 *
 * Bug 描述：
 *   - stepInfo.state 总是 undefined（fsm.getStepInfo() 返回 currentStepName 而非 state）
 *   - FSM 无法从 NAMING_CEREMONY 推进到 FEYNMAN_TRIGGER 和 PARTNER_CONFIRM
 *
 * 多智能体分工：
 *   Agent 1: FSM State Field - 修复 getStepInfo() 返回 state 字段
 *   Agent 2: Feynman Integration - 集成费曼编排器到 FEYNMAN_TRIGGER 状态
 *   Agent 3: Partner Integration - 集成搭档编排器到 PARTNER_CONFIRM 状态
 *   Agent 4: Flow Coordinator - 端到端流程协调
 */

const { createDialogFSM, DIALOG_STATES } = require('../../src/dialog/fsm');
const {
  createSessionManager,
  handleVoiceMessage
} = require('../../src/voice/session-manager');

describe('Issue #20 - FSM 状态机推进修复', () => {
  // ============================================================
  // Agent 1: FSM State Field - 修复 getStepInfo() 返回 state 字段
  // ============================================================
  describe('Agent 1: FSM getStepInfo 返回 state 字段', () => {
    test('getStepInfo() 应包含 state 字段，值等于当前状态名', () => {
      const fsm = createDialogFSM();
      const info = fsm.getStepInfo();
      expect(info.state).toBe('APPEARANCE');
    });

    test('转换到 HELP_REQUEST 后，getStepInfo().state 为 HELP_REQUEST', () => {
      const fsm = createDialogFSM();
      fsm.transition('HELP_REQUEST');
      const info = fsm.getStepInfo();
      expect(info.state).toBe('HELP_REQUEST');
    });

    test('转换到 FEYNMAN_TRIGGER 后，getStepInfo().state 为 FEYNMAN_TRIGGER', () => {
      const fsm = createDialogFSM();
      fsm.transition('HELP_REQUEST');
      fsm.transition('NAMING_CEREMONY');
      fsm.transition('FEYNMAN_TRIGGER');
      const info = fsm.getStepInfo();
      expect(info.state).toBe('FEYNMAN_TRIGGER');
    });

    test('转换到 PARTNER_CONFIRM 后，getStepInfo().state 为 PARTNER_CONFIRM', () => {
      const fsm = createDialogFSM();
      fsm.transition('HELP_REQUEST');
      fsm.transition('NAMING_CEREMONY');
      fsm.transition('FEYNMAN_TRIGGER');
      fsm.transition('PARTNER_CONFIRM');
      const info = fsm.getStepInfo();
      expect(info.state).toBe('PARTNER_CONFIRM');
    });
  });

  // ============================================================
  // Agent 2: Feynman Integration - FEYNMAN_TRIGGER 状态处理
  // ============================================================
  describe('Agent 2: FEYNMAN_TRIGGER 状态触发费曼台词', () => {
    let sessionManager;

    beforeEach(() => {
      sessionManager = createSessionManager();
    });

    function setupSessionToFeynman(foxName = '闪电') {
      const session = sessionManager.createSession('child_001');
      // 推进到 HELP_REQUEST
      sessionManager.updateState(session.id, 'HELP_REQUEST');
      // 提供名字，推进到 NAMING_CEREMONY
      handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 800,
        content: foxName
      });
      // 完成命名仪式的4个画像问题，推进到 FEYNMAN_TRIGGER
      const ceremony = session.ceremony;
      if (ceremony) {
        ceremony.startCollection();
        ceremony.processAnswer('小明'); // nickname
        ceremony.processAnswer('5'); // age
        ceremony.processAnswer('恐龙'); // interests
        ceremony.processAnswer('跑步'); // skills
      }
      // 手动触发仪式完成后的状态转换
      handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: '好了'
      });
      return session;
    }

    test('FEYNMAN_TRIGGER 状态收到消息 → 返回费曼触发台词', () => {
      const session = setupSessionToFeynman('闪电');
      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: ''
      });

      expect(result.dialog).toBeDefined();
      expect(result.dialog.mainLine).toBeDefined();
      expect(result.nextState).toBe('FEYNMAN_TRIGGER');
      expect(result.stepInfo.state).toBe('FEYNMAN_TRIGGER');
    });

    test('费曼触发台词应包含目标生字（闪电 → 闪）', () => {
      const session = setupSessionToFeynman('闪电');
      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: ''
      });

      expect(result.targetCharacter).toBe('闪');
    });

    test('费曼触发后孩子回应 → 处理反应并推进到 PARTNER_CONFIRM', () => {
      const session = setupSessionToFeynman('闪电');
      // 第一次消息触发费曼台词
      handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: ''
      });
      // 第二次消息是孩子教认字的反应
      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 1000,
        content: '闪'
      });

      expect(result.nextState).toBe('PARTNER_CONFIRM');
      expect(result.stepInfo.state).toBe('PARTNER_CONFIRM');
      expect(result.teachingWillingness).toBe(true);
    });
  });

  // ============================================================
  // Agent 3: Partner Integration - PARTNER_CONFIRM 状态处理
  // ============================================================
  describe('Agent 3: PARTNER_CONFIRM 状态触发搭档邀请', () => {
    let sessionManager;

    beforeEach(() => {
      sessionManager = createSessionManager();
    });

    function setupSessionToPartner(foxName = '闪电') {
      const session = sessionManager.createSession('child_001');
      sessionManager.updateState(session.id, 'HELP_REQUEST');
      handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 800,
        content: foxName
      });
      const ceremony = session.ceremony;
      if (ceremony) {
        ceremony.startCollection();
        ceremony.processAnswer('小明');
        ceremony.processAnswer('5');
        ceremony.processAnswer('恐龙');
        ceremony.processAnswer('跑步');
      }
      handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: '好了'
      });
      // 触发费曼
      handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: ''
      });
      // 孩子教认字，推进到 PARTNER_CONFIRM
      handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 1000,
        content: '闪'
      });
      return session;
    }

    test('PARTNER_CONFIRM 状态收到消息 → 返回搭档邀请台词', () => {
      const session = setupSessionToPartner('闪电');
      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: ''
      });

      expect(result.dialog).toBeDefined();
      expect(result.dialog.mainLine).toContain('搭档');
      expect(result.nextState).toBe('PARTNER_CONFIRM');
      expect(result.stepInfo.state).toBe('PARTNER_CONFIRM');
    });

    test('孩子接受搭档 → partnerAcceptance 为 true，流程完成', () => {
      const session = setupSessionToPartner('闪电');
      // 触发邀请
      handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: ''
      });
      // 孩子接受
      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '愿意'
      });

      expect(result.partnerAcceptance).toBe(true);
      expect(result.flowComplete).toBe(true);
    });

    test('孩子犹豫搭档 → partnerAcceptance 为 null，可再次邀请', () => {
      const session = setupSessionToPartner('闪电');
      handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: ''
      });
      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 3000,
        content: '嗯'
      });

      expect(result.partnerAcceptance).toBeNull();
      expect(result.flowComplete).toBe(false);
    });

    test('孩子拒绝搭档 → partnerAcceptance 为 false，流程完成', () => {
      const session = setupSessionToPartner('闪电');
      handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: ''
      });
      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '不要'
      });

      expect(result.partnerAcceptance).toBe(false);
      expect(result.flowComplete).toBe(true);
    });

    test('搭档邀请台词应包含兴趣分型标签（闪电 → 赛车搭档）', () => {
      const session = setupSessionToPartner('闪电');
      const result = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: ''
      });

      expect(result.dialog.mainLine).toContain('赛车搭档');
    });
  });

  // ============================================================
  // Agent 4: Flow Coordinator - 端到端流程验证
  // ============================================================
  describe('Agent 4: 端到端流程 NAMING_CEREMONY → FEYNMAN → PARTNER', () => {
    test('完整流程：命名仪式完成 → 费曼触发 → 搭档确认 → 流程完成', () => {
      const sessionManager = createSessionManager();
      const session = sessionManager.createSession('child_001');

      // 步骤1: APPEARANCE → HELP_REQUEST
      sessionManager.updateState(session.id, 'HELP_REQUEST');

      // 步骤2: 提供名字 → NAMING_CEREMONY
      handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '闪电'
      });

      // 步骤3: 完成命名仪式画像采集
      const ceremony = session.ceremony;
      ceremony.startCollection();
      ceremony.processAnswer('小明');
      ceremony.processAnswer('5');
      ceremony.processAnswer('恐龙');
      ceremony.processAnswer('跑步');

      // 仪式完成 → FEYNMAN_TRIGGER
      const feynmanEnter = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: '好了'
      });
      expect(feynmanEnter.stepInfo.state).toBe('FEYNMAN_TRIGGER');

      // 费曼触发台词
      const feynmanTrigger = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: ''
      });
      expect(feynmanTrigger.dialog).toBeDefined();
      expect(feynmanTrigger.targetCharacter).toBe('闪');

      // 孩子教认字 → PARTNER_CONFIRM
      const partnerEnter = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 1000,
        content: '闪'
      });
      expect(partnerEnter.stepInfo.state).toBe('PARTNER_CONFIRM');

      // 搭档邀请
      const partnerInvite = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 500,
        content: ''
      });
      expect(partnerInvite.dialog.mainLine).toContain('搭档');

      // 孩子接受 → 流程完成
      const accept = handleVoiceMessage(sessionManager, session.id, {
        type: 'child_response',
        responseTimeMs: 800,
        content: '愿意'
      });
      expect(accept.partnerAcceptance).toBe(true);
      expect(accept.flowComplete).toBe(true);
    });
  });
});
