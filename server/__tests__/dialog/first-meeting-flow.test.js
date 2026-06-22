const { createFirstMeetingFlow } = require('../../src/dialog/first-meeting-flow');

describe('第一次见面全流程管理器 - first-meeting-flow', () => {
  // ===== 切片1: 创建流程后初始状态 =====
  describe('初始状态', () => {
    test('创建流程后 currentStep 为 1', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      expect(flow.getCurrentStep()).toBe(1);
    });

    test('创建流程后 state 为 IN_PROGRESS', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      expect(flow.getState()).toBe('IN_PROGRESS');
    });

    test('创建流程后 isComplete 为 false', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      expect(flow.isComplete()).toBe(false);
    });
  });

  // ===== 切片2: advanceToNext 从步骤1推进到步骤2 =====
  describe('advanceToNext - 步骤1→步骤2', () => {
    test('从步骤1推进到步骤2，返回 success 和正确的 currentStep', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      const result = flow.advanceToNext();
      expect(result.success).toBe(true);
      expect(result.currentStep).toBe(2);
      expect(result.isComplete).toBe(false);
      expect(flow.getCurrentStep()).toBe(2);
    });
  });

  // ===== 切片3: 连续推进到步骤3、4、5 =====
  describe('advanceToNext - 连续推进', () => {
    test('可以从步骤1连续推进到步骤5', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.advanceToNext(); // →2
      flow.advanceToNext(); // →3
      flow.advanceToNext(); // →4
      const result = flow.advanceToNext(); // →5
      expect(result.success).toBe(true);
      expect(result.currentStep).toBe(5);
      expect(flow.getCurrentStep()).toBe(5);
    });
  });

  // ===== 切片4: 步骤5时调用 advanceToNext → isComplete=true, state='COMPLETED' =====
  describe('advanceToNext - 步骤5完成', () => {
    test('步骤5时调用 advanceToNext → isComplete=true, state=COMPLETED', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.advanceToNext(); // →2
      flow.advanceToNext(); // →3
      flow.advanceToNext(); // →4
      flow.advanceToNext(); // →5
      const result = flow.advanceToNext(); // 完成流程
      expect(result.success).toBe(true);
      expect(result.isComplete).toBe(true);
      expect(flow.isComplete()).toBe(true);
      expect(flow.getState()).toBe('COMPLETED');
    });
  });

  // ===== 切片5: advanceToStep 跳转到指定步骤 =====
  describe('advanceToStep - 跳转到指定步骤', () => {
    test('从步骤1跳转到步骤3，返回 success、currentStep 和 previousStep', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      const result = flow.advanceToStep(3);
      expect(result.success).toBe(true);
      expect(result.currentStep).toBe(3);
      expect(result.previousStep).toBe(1);
      expect(flow.getCurrentStep()).toBe(3);
    });

    test('可以从步骤3跳转到步骤5', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.advanceToStep(3);
      const result = flow.advanceToStep(5);
      expect(result.success).toBe(true);
      expect(result.currentStep).toBe(5);
      expect(result.previousStep).toBe(3);
    });
  });

  // ===== 切片6: advanceToStep 无效步骤号抛出错误 =====
  describe('advanceToStep - 无效步骤号', () => {
    test('步骤号小于1时抛出错误', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      expect(() => flow.advanceToStep(0)).toThrow();
    });

    test('步骤号大于5时抛出错误', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      expect(() => flow.advanceToStep(6)).toThrow();
    });

    test('负数步骤号抛出错误', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      expect(() => flow.advanceToStep(-1)).toThrow();
    });
  });

  // ===== 切片7: 流程完成后再调用 advanceToNext 抛出错误 =====
  describe('advanceToNext - 流程已完成', () => {
    test('流程完成后再调用 advanceToNext 抛出错误', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.advanceToNext(); // →2
      flow.advanceToNext(); // →3
      flow.advanceToNext(); // →4
      flow.advanceToNext(); // →5
      flow.advanceToNext(); // 完成
      expect(() => flow.advanceToNext()).toThrow();
    });
  });

  // ===== 切片8: start + getTimingInfo 计时信息正确 =====
  describe('计时管理 - start + getTimingInfo', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-23T10:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('start 后 getTimingInfo 返回正确的预算信息', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.start();
      const timing = flow.getTimingInfo();
      expect(timing.budgetMin).toBe(300000);
      expect(timing.budgetMax).toBe(480000);
      expect(timing.elapsed).toBe(0);
      expect(timing.withinBudget).toBe(true);
    });

    test('经过一段时间后 elapsed 正确增加', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.start();
      jest.advanceTimersByTime(60000); // 1分钟
      const timing = flow.getTimingInfo();
      expect(timing.elapsed).toBe(60000);
      expect(timing.withinBudget).toBe(true);
    });

    test('progress 反映当前步骤进度', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.start();
      flow.advanceToNext(); // →2
      const timing = flow.getTimingInfo();
      expect(timing.progress).toBe(2);
    });
  });

  // ===== 切片9: 超过最大预算 withinBudget=false =====
  describe('计时管理 - 超过最大预算', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-23T10:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('超过最大预算时 withinBudget=false', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.start();
      jest.advanceTimersByTime(481000); // 8分钟+1秒
      const timing = flow.getTimingInfo();
      expect(timing.elapsed).toBe(481000);
      expect(timing.withinBudget).toBe(false);
    });

    test('刚好等于最大预算时 withinBudget=true', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.start();
      jest.advanceTimersByTime(480000); // 8分钟
      const timing = flow.getTimingInfo();
      expect(timing.elapsed).toBe(480000);
      expect(timing.withinBudget).toBe(true);
    });
  });

  // ===== 切片10: setNextDayReminder 设置次日提醒 =====
  describe('setNextDayReminder - 设置次日提醒', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-23T10:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('设置次日提醒后 enabled=true 且 date 为次日 ISO 日期', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.setNextDayReminder();
      const reminder = flow.getNextDayReminder();
      expect(reminder.enabled).toBe(true);
      expect(reminder.date).toBe('2026-06-24');
    });
  });

  // ===== 切片11: getNextDayReminder 默认 enabled=false =====
  describe('getNextDayReminder - 默认状态', () => {
    test('默认 enabled=false, date=null', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      const reminder = flow.getNextDayReminder();
      expect(reminder.enabled).toBe(false);
      expect(reminder.date).toBeNull();
    });
  });

  // ===== 切片12: complete 自动设置次日提醒 =====
  describe('complete - 自动设置次日提醒', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-23T10:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('complete 后流程状态为 COMPLETED', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.complete();
      expect(flow.getState()).toBe('COMPLETED');
      expect(flow.isComplete()).toBe(true);
    });

    test('complete 后自动设置次日提醒', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.complete();
      const reminder = flow.getNextDayReminder();
      expect(reminder.enabled).toBe(true);
      expect(reminder.date).toBe('2026-06-24');
    });
  });

  // ===== 切片13: getSummary 返回完整摘要 =====
  describe('getSummary - 返回完整摘要', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-23T10:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('返回包含所有字段的完整摘要', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.start();
      flow.advanceToNext(); // →2
      const summary = flow.getSummary();
      expect(summary.childId).toBe('child-001');
      expect(summary.foxName).toBe('闪电');
      expect(summary.currentStep).toBe(2);
      expect(summary.isComplete).toBe(false);
      expect(summary.timingInfo).toBeDefined();
      expect(summary.timingInfo.budgetMin).toBe(300000);
      expect(summary.timingInfo.budgetMax).toBe(480000);
      expect(summary.nextDayReminder).toBeDefined();
      expect(summary.nextDayReminder.enabled).toBe(false);
    });

    test('流程完成后摘要反映完成状态', () => {
      const flow = createFirstMeetingFlow('child-001', '闪电');
      flow.start();
      flow.complete();
      const summary = flow.getSummary();
      expect(summary.isComplete).toBe(true);
      expect(summary.currentStep).toBe(5);
      expect(summary.nextDayReminder.enabled).toBe(true);
      expect(summary.nextDayReminder.date).toBe('2026-06-24');
    });
  });
});
