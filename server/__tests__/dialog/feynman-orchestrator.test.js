/**
 * 费曼学习法流程编排器 - Issue #4 费曼学习法首次触发
 *
 * 参考技术架构文档§「费曼学习法」
 * 参考PRD §4.1 步骤4 费曼学习法首次触发
 *
 * 职责：
 *   1. 编排费曼学习法的完整流程：触发 → 等待反应 → 反馈 → 完成
 *   2. 串联 step4-templates（台词）和 child-response-classifier（反应分类）
 *   3. 维护流程状态机与计时预算（1分钟）
 *
 * 流程状态机：
 *   TRIGGER → AWAIT_RESPONSE → FEEDBACK → COMPLETE
 */
const { createFeynmanOrchestrator } = require('../../src/dialog/feynman-orchestrator');

describe('费曼学习法流程编排器 - Issue #4', () => {
  // ===== 切片1: 创建编排器后初始状态为 TRIGGER =====
  test('创建编排器后初始状态为 TRIGGER', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    expect(orchestrator.getState()).toBe('TRIGGER');
  });

  // ===== 切片2: getTriggerDialog 返回正确台词并转换到 AWAIT_RESPONSE =====
  test('getTriggerDialog 返回费曼触发台词并将状态转换为 AWAIT_RESPONSE', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    const triggerDialog = orchestrator.getTriggerDialog();

    // 返回结构包含所有必需字段
    expect(triggerDialog).toHaveProperty('mainLine');
    expect(triggerDialog).toHaveProperty('followUp');
    expect(triggerDialog).toHaveProperty('targetCharacter');
    expect(triggerDialog).toHaveProperty('waitBeforeNextMs');

    // dinosaur + 恐龙蛋 → 目标生字为「龙」
    expect(triggerDialog.targetCharacter).toBe('龙');
    // 台词应包含名字和要教的字
    expect(triggerDialog.mainLine).toContain('恐龙蛋');
    expect(triggerDialog.mainLine).toContain('龙');
    // 应体现"以教代学"——请孩子教
    expect(triggerDialog.mainLine).toContain('教');
    expect(typeof triggerDialog.waitBeforeNextMs).toBe('number');

    // 状态从 TRIGGER → AWAIT_RESPONSE
    expect(orchestrator.getState()).toBe('AWAIT_RESPONSE');
  });

  // ===== 切片3: getTargetCharacter 返回目标生字 =====
  test('getTargetCharacter 在调用 getTriggerDialog 后返回目标生字', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    // 触发前为 null
    expect(orchestrator.getTargetCharacter()).toBeNull();
    // 触发后为目标生字
    orchestrator.getTriggerDialog();
    expect(orchestrator.getTargetCharacter()).toBe('龙');
  });

  test('getTargetCharacter 在 generic 类型下返回 null', () => {
    const orchestrator = createFeynmanOrchestrator('generic', '小白');
    orchestrator.getTriggerDialog();
    expect(orchestrator.getTargetCharacter()).toBeNull();
  });

  // ===== 切片4: processChildResponse 在 TRIGGER 状态抛出错误 =====
  test('processChildResponse 在 TRIGGER 状态调用应抛出错误（必须先调用 getTriggerDialog）', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    // 初始状态为 TRIGGER，未调用 getTriggerDialog 直接调用 processChildResponse 应抛错
    expect(() => orchestrator.processChildResponse('龙')).toThrow();
  });

  // ===== 切片5: processChildResponse 分类"龙"为 correct 并返回崇拜反馈 =====
  test('processChildResponse 分类"龙"为 correct 并返回崇拜反馈', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getTriggerDialog();
    // 孩子说出目标生字「龙」→ 分类为 correct
    const result = orchestrator.processChildResponse('龙');

    // 返回结构包含所有必需字段
    expect(result).toHaveProperty('mainLine');
    expect(result).toHaveProperty('followUp');
    expect(result).toHaveProperty('teachingWillingness');
    expect(result).toHaveProperty('classification');
    expect(result).toHaveProperty('waitBeforeNextMs');

    // 分类结果为 correct
    expect(result.classification.type).toBe('correct');
    expect(result.classification).toHaveProperty('confidence');
    expect(result.classification).toHaveProperty('matchedKeyword');

    // 崇拜反馈台词
    expect(result.mainLine).toContain('你太厉害了');
    expect(result.mainLine).toContain('识字搭档');
    // teaching_willingness 为 true
    expect(result.teachingWillingness).toBe(true);
    expect(typeof result.waitBeforeNextMs).toBe('number');
  });

  // ===== 切片6: processChildResponse 分类"不知道"为 unsure 并返回共同探索反馈 =====
  test('processChildResponse 分类"不知道"为 unsure 并返回共同探索反馈', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getTriggerDialog();
    // 孩子说"不知道" → 分类为 unsure
    const result = orchestrator.processChildResponse('不知道');

    // 分类结果为 unsure
    expect(result.classification.type).toBe('unsure');
    // 共同探索反馈台词
    expect(result.mainLine).toContain('没关系');
    expect(result.mainLine).toContain('我们一起查查');
    // teaching_willingness 仍为 true
    expect(result.teachingWillingness).toBe(true);
  });

  // ===== 切片7: processChildResponse 分类"不要"为 refuse 并返回不强制教学反馈 =====
  test('processChildResponse 分类"不要"为 refuse 并返回不强制教学反馈', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getTriggerDialog();
    // 孩子说"不要" → 分类为 refuse
    const result = orchestrator.processChildResponse('不要');

    // 分类结果为 refuse
    expect(result.classification.type).toBe('refuse');
    // 不强制教学反馈台词
    expect(result.mainLine).toContain('没关系');
    // teaching_willingness 为 false
    expect(result.teachingWillingness).toBe(false);
  });

  // ===== 切片8: processChildResponse 后状态变为 COMPLETE =====
  test('processChildResponse 后状态变为 COMPLETE', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getTriggerDialog();
    expect(orchestrator.getState()).toBe('AWAIT_RESPONSE');
    orchestrator.processChildResponse('龙');
    // 流程完成后状态为 COMPLETE
    expect(orchestrator.getState()).toBe('COMPLETE');
  });

  // ===== 切片9: isComplete 在流程完成后返回 true =====
  test('isComplete 在流程完成后返回 true，流程未完成时返回 false', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    // 初始状态未完成
    expect(orchestrator.isComplete()).toBe(false);
    orchestrator.getTriggerDialog();
    expect(orchestrator.isComplete()).toBe(false);
    orchestrator.processChildResponse('龙');
    // 流程完成后 isComplete 返回 true
    expect(orchestrator.isComplete()).toBe(true);
  });

  // ===== 切片10: COMPLETE 状态调用 processChildResponse 抛出错误 =====
  test('COMPLETE 状态调用 processChildResponse 应抛出错误（流程已完成）', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getTriggerDialog();
    orchestrator.processChildResponse('龙');
    // 流程已完成，再次调用 processChildResponse 应抛错
    expect(() => orchestrator.processChildResponse('龙')).toThrow();
  });

  // ===== 切片11: getTimingInfo 返回正确的预算信息 =====
  test('getTimingInfo 返回正确的预算信息（1分钟预算）', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    const timing = orchestrator.getTimingInfo();

    // 返回结构包含所有必需字段
    expect(timing).toHaveProperty('elapsed');
    expect(timing).toHaveProperty('budget');
    expect(timing).toHaveProperty('withinBudget');

    // 预算为 1分钟 = 60000ms
    expect(timing.budget).toBe(60000);
    // 已用时间为非负数
    expect(typeof timing.elapsed).toBe('number');
    expect(timing.elapsed).toBeGreaterThanOrEqual(0);
    // 刚创建时应在预算内
    expect(timing.withinBudget).toBe(true);
  });

  // ===== 切片12: reset 重置到 TRIGGER 状态 =====
  test('reset 重置编排器到初始 TRIGGER 状态', () => {
    const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
    // 走完整个流程
    orchestrator.getTriggerDialog();
    orchestrator.processChildResponse('龙');
    expect(orchestrator.getState()).toBe('COMPLETE');
    expect(orchestrator.isComplete()).toBe(true);

    // 重置后回到初始状态
    orchestrator.reset();
    expect(orchestrator.getState()).toBe('TRIGGER');
    expect(orchestrator.isComplete()).toBe(false);
    // 目标生字也应被重置
    expect(orchestrator.getTargetCharacter()).toBeNull();

    // 重置后可以重新走流程
    orchestrator.getTriggerDialog();
    expect(orchestrator.getState()).toBe('AWAIT_RESPONSE');
    expect(orchestrator.getTargetCharacter()).toBe('龙');
    orchestrator.processChildResponse('龙');
    expect(orchestrator.getState()).toBe('COMPLETE');
  });

  // ===== 切片13: 测试不同兴趣分型（dinosaur/princess/speed/generic） =====
  describe('不同兴趣分型的费曼流程', () => {
    test('dinosaur + 恐龙蛋 → 目标生字「龙」，孩子念对返回崇拜反馈', () => {
      const orchestrator = createFeynmanOrchestrator('dinosaur', '恐龙蛋');
      const trigger = orchestrator.getTriggerDialog();
      expect(trigger.targetCharacter).toBe('龙');
      expect(trigger.mainLine).toContain('恐龙蛋');
      expect(trigger.mainLine).toContain('龙');

      const result = orchestrator.processChildResponse('龙');
      expect(result.classification.type).toBe('correct');
      expect(result.teachingWillingness).toBe(true);
      expect(orchestrator.isComplete()).toBe(true);
    });

    test('princess + 艾莎 → 目标生字「莎」，孩子念对返回崇拜反馈', () => {
      const orchestrator = createFeynmanOrchestrator('princess', '艾莎');
      const trigger = orchestrator.getTriggerDialog();
      expect(trigger.targetCharacter).toBe('莎');
      expect(trigger.mainLine).toContain('艾莎');
      expect(trigger.mainLine).toContain('莎');

      const result = orchestrator.processChildResponse('莎');
      expect(result.classification.type).toBe('correct');
      expect(result.teachingWillingness).toBe(true);
      expect(orchestrator.isComplete()).toBe(true);
    });

    test('speed + 闪电 → 目标生字「闪」，孩子念对返回崇拜反馈', () => {
      const orchestrator = createFeynmanOrchestrator('speed', '闪电');
      const trigger = orchestrator.getTriggerDialog();
      expect(trigger.targetCharacter).toBe('闪');
      expect(trigger.mainLine).toContain('闪电');
      expect(trigger.mainLine).toContain('闪');

      const result = orchestrator.processChildResponse('闪');
      expect(result.classification.type).toBe('correct');
      expect(result.teachingWillingness).toBe(true);
      expect(orchestrator.isComplete()).toBe(true);
    });

    test('generic + 小白 → 无目标生字，回退通用台词，流程仍可完成', () => {
      const orchestrator = createFeynmanOrchestrator('generic', '小白');
      const trigger = orchestrator.getTriggerDialog();
      expect(trigger.targetCharacter).toBeNull();
      expect(trigger.mainLine).toContain('我还想知道更多字');
      expect(trigger.mainLine).toContain('你能教我认你的名字吗');

      // generic 无目标生字，孩子说"不知道" → unsure
      const result = orchestrator.processChildResponse('不知道');
      expect(result.classification.type).toBe('unsure');
      expect(result.teachingWillingness).toBe(true);
      expect(orchestrator.isComplete()).toBe(true);
    });
  });
});
