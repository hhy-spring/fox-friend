const { createDialogFSM, DIALOG_STATES } = require('../../src/dialog/fsm');

describe('对话状态机 - 第一次见面流程', () => {
  describe('5步状态定义', () => {
    test('初始状态为 APPEARANCE（出场）', () => {
      const fsm = createDialogFSM();
      expect(fsm.getState()).toBe('APPEARANCE');
    });

    test('包含 PRD 定义的5个步骤状态', () => {
      expect(DIALOG_STATES.APPEARANCE).toBe('APPEARANCE');
      expect(DIALOG_STATES.HELP_REQUEST).toBe('HELP_REQUEST');
      expect(DIALOG_STATES.NAMING_CEREMONY).toBe('NAMING_CEREMONY');
      expect(DIALOG_STATES.FEYNMAN_TRIGGER).toBe('FEYNMAN_TRIGGER');
      expect(DIALOG_STATES.PARTNER_CONFIRM).toBe('PARTNER_CONFIRM');
    });
  });

  describe('状态转换 - step1→step2', () => {
    test('APPEARANCE 可以转换到 HELP_REQUEST', () => {
      const fsm = createDialogFSM();
      fsm.transition('HELP_REQUEST');
      expect(fsm.getState()).toBe('HELP_REQUEST');
    });

    test('APPEARANCE 不能跳转到 NAMING_CEREMONY', () => {
      const fsm = createDialogFSM();
      expect(() => fsm.transition('NAMING_CEREMONY')).toThrow();
    });

    test('HELP_REQUEST 可以转换到 NAMING_CEREMONY', () => {
      const fsm = createDialogFSM();
      fsm.transition('HELP_REQUEST');
      fsm.transition('NAMING_CEREMONY');
      expect(fsm.getState()).toBe('NAMING_CEREMONY');
    });
  });

  describe('状态机输出当前步骤和下一预期', () => {
    test('APPEARANCE 状态输出步骤1信息和下一预期', () => {
      const fsm = createDialogFSM();
      const info = fsm.getStepInfo();
      expect(info.currentStep).toBe(1);
      expect(info.currentStepName).toBe('APPEARANCE');
      expect(info.nextExpected).toBe('HELP_REQUEST');
      expect(info.description).toContain('出场');
    });

    test('HELP_REQUEST 状态输出步骤2信息和下一预期', () => {
      const fsm = createDialogFSM();
      fsm.transition('HELP_REQUEST');
      const info = fsm.getStepInfo();
      expect(info.currentStep).toBe(2);
      expect(info.currentStepName).toBe('HELP_REQUEST');
      expect(info.nextExpected).toBe('NAMING_CEREMONY');
      expect(info.description).toContain('求助');
    });
  });

  describe('状态机重置', () => {
    test('重置后回到 APPEARANCE', () => {
      const fsm = createDialogFSM();
      fsm.transition('HELP_REQUEST');
      fsm.reset();
      expect(fsm.getState()).toBe('APPEARANCE');
    });
  });
});
