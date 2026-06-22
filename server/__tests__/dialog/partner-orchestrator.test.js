/**
 * 搭档确认流程编排器测试 - Issue #5 搭档确认流程
 *
 * 参考技术架构文档§「搭档确认」
 * 参考PRD §4.1 步骤5 搭档确认
 *
 * 职责：
 *   1. 编排搭档确认完整流程：邀请 → 等待反应 → 确认/拒绝/再邀
 *   2. 串联 step5-templates（台词）和 partner-response-classifier（反应分类）
 *   3. 维护流程状态机与计时预算（2分钟）
 *
 * 流程状态机：
 *   INVITE → AWAIT_RESPONSE → CONFIRMED (accept) / DECLINED (refuse) / RE_INVITE (hesitate → 回到 AWAIT_RESPONSE)
 */
const { createPartnerOrchestrator } = require('../../src/dialog/partner-orchestrator');

describe('搭档确认流程编排器 - Issue #5', () => {
  // ===== 切片1: 创建编排器后初始状态为 INVITE =====
  test('创建编排器后初始状态为 INVITE', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    expect(orchestrator.getState()).toBe('INVITE');
  });

  // ===== 切片2: getInvitationDialog 返回邀请台词并转换到 AWAIT_RESPONSE =====
  test('getInvitationDialog 返回邀请台词并将状态转换为 AWAIT_RESPONSE', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    const invitationDialog = orchestrator.getInvitationDialog();

    // 返回结构包含所有必需字段
    expect(invitationDialog).toHaveProperty('mainLine');
    expect(invitationDialog).toHaveProperty('followUp');
    expect(invitationDialog).toHaveProperty('waitBeforeNextMs');

    // 邀请台词应包含狐狸名字和搭档标签
    expect(invitationDialog.mainLine).toContain('恐龙蛋');
    expect(invitationDialog.mainLine).toContain('搭档');
    expect(typeof invitationDialog.waitBeforeNextMs).toBe('number');

    // 状态从 INVITE → AWAIT_RESPONSE
    expect(orchestrator.getState()).toBe('AWAIT_RESPONSE');
  });

  // ===== 切片3: getPartnerAcceptance 初始为 null =====
  test('getPartnerAcceptance 初始为 null（未确定）', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    expect(orchestrator.getPartnerAcceptance()).toBeNull();
  });

  // ===== 切片4: isComplete 初始为 false =====
  test('isComplete 在流程未完成时返回 false', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    expect(orchestrator.isComplete()).toBe(false);
    orchestrator.getInvitationDialog();
    expect(orchestrator.isComplete()).toBe(false);
  });

  // ===== 切片5: processChildResponse 在 INVITE 状态抛出错误 =====
  test('processChildResponse 在 INVITE 状态调用应抛出错误（必须先调用 getInvitationDialog）', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    // 初始状态为 INVITE，未调用 getInvitationDialog 直接调用 processChildResponse 应抛错
    expect(() => orchestrator.processChildResponse('愿意')).toThrow();
  });

  // ===== 切片6: processChildResponse 分类"愿意"为 accept → CONFIRMED =====
  test('processChildResponse 分类"愿意"为 accept 并转换到 CONFIRMED', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();
    // 孩子说"愿意" → 分类为 accept
    const result = orchestrator.processChildResponse('愿意');

    // 返回结构包含所有必需字段
    expect(result).toHaveProperty('mainLine');
    expect(result).toHaveProperty('followUp');
    expect(result).toHaveProperty('partnerAcceptance');
    expect(result).toHaveProperty('classification');

    // 分类结果为 accept
    expect(result.classification.type).toBe('accept');
    expect(result.classification).toHaveProperty('confidence');
    expect(result.classification).toHaveProperty('matchedKeyword');

    // 接受台词
    expect(result.partnerAcceptance).toBe(true);
    expect(typeof result.mainLine).toBe('string');

    // 状态转换为 CONFIRMED
    expect(orchestrator.getState()).toBe('CONFIRMED');
    expect(orchestrator.isComplete()).toBe(true);
    expect(orchestrator.getPartnerAcceptance()).toBe(true);
  });

  // ===== 切片7: processChildResponse 分类"不要"为 refuse → DECLINED =====
  test('processChildResponse 分类"不要"为 refuse 并转换到 DECLINED', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();
    // 孩子说"不要" → 分类为 refuse
    const result = orchestrator.processChildResponse('不要');

    // 分类结果为 refuse
    expect(result.classification.type).toBe('refuse');
    // 拒绝台词
    expect(result.partnerAcceptance).toBe(false);

    // 状态转换为 DECLINED
    expect(orchestrator.getState()).toBe('DECLINED');
    expect(orchestrator.isComplete()).toBe(true);
    expect(orchestrator.getPartnerAcceptance()).toBe(false);
  });

  // ===== 切片8: processChildResponse 分类"嗯"为 hesitate → 回到 AWAIT_RESPONSE =====
  test('processChildResponse 分类"嗯"为 hesitate 并回到 AWAIT_RESPONSE（RE_INVITE）', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();
    // 孩子说"嗯" → 分类为 hesitate
    const result = orchestrator.processChildResponse('嗯');

    // 分类结果为 hesitate
    expect(result.classification.type).toBe('hesitate');
    // 犹豫时 partnerAcceptance 为 null（未确定）
    expect(result.partnerAcceptance).toBeNull();

    // 状态回到 AWAIT_RESPONSE（RE_INVITE → AWAIT_RESPONSE）
    expect(orchestrator.getState()).toBe('AWAIT_RESPONSE');
    // 流程未完成
    expect(orchestrator.isComplete()).toBe(false);
    // partnerAcceptance 仍为 null
    expect(orchestrator.getPartnerAcceptance()).toBeNull();
  });

  // ===== 切片9: hesitate 后再次 accept → CONFIRMED =====
  test('hesitate 后再次 accept → CONFIRMED（可再次处理反应）', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();
    // 第一次：犹豫
    orchestrator.processChildResponse('嗯');
    expect(orchestrator.getState()).toBe('AWAIT_RESPONSE');
    expect(orchestrator.isComplete()).toBe(false);

    // 第二次：接受
    const result = orchestrator.processChildResponse('愿意');
    expect(result.classification.type).toBe('accept');
    expect(orchestrator.getState()).toBe('CONFIRMED');
    expect(orchestrator.isComplete()).toBe(true);
    expect(orchestrator.getPartnerAcceptance()).toBe(true);
  });

  // ===== 切片10: hesitate 后再次 refuse → DECLINED =====
  test('hesitate 后再次 refuse → DECLINED（可再次处理反应）', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();
    // 第一次：犹豫
    orchestrator.processChildResponse('让我想想');
    expect(orchestrator.getState()).toBe('AWAIT_RESPONSE');

    // 第二次：拒绝
    const result = orchestrator.processChildResponse('不要');
    expect(result.classification.type).toBe('refuse');
    expect(orchestrator.getState()).toBe('DECLINED');
    expect(orchestrator.isComplete()).toBe(true);
    expect(orchestrator.getPartnerAcceptance()).toBe(false);
  });

  // ===== 切片11: 多次 hesitate 后 accept =====
  test('多次 hesitate 后 accept → CONFIRMED（支持多轮再邀）', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();

    // 多次犹豫
    orchestrator.processChildResponse('嗯');
    orchestrator.processChildResponse('让我想想');
    orchestrator.processChildResponse('再想想');
    expect(orchestrator.getState()).toBe('AWAIT_RESPONSE');
    expect(orchestrator.isComplete()).toBe(false);

    // 最终接受
    const result = orchestrator.processChildResponse('好啊');
    expect(result.classification.type).toBe('accept');
    expect(orchestrator.getState()).toBe('CONFIRMED');
    expect(orchestrator.isComplete()).toBe(true);
    expect(orchestrator.getPartnerAcceptance()).toBe(true);
  });

  // ===== 切片12: CONFIRMED 状态调用 processChildResponse 抛出错误 =====
  test('CONFIRMED 状态调用 processChildResponse 应抛出错误（流程已完成）', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();
    orchestrator.processChildResponse('愿意');
    // 流程已完成，再次调用 processChildResponse 应抛错
    expect(() => orchestrator.processChildResponse('愿意')).toThrow();
  });

  // ===== 切片13: DECLINED 状态调用 processChildResponse 抛出错误 =====
  test('DECLINED 状态调用 processChildResponse 应抛出错误（流程已完成）', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();
    orchestrator.processChildResponse('不要');
    // 流程已完成，再次调用 processChildResponse 应抛错
    expect(() => orchestrator.processChildResponse('愿意')).toThrow();
  });

  // ===== 切片14: getTimingInfo 返回正确的预算信息（2分钟预算） =====
  test('getTimingInfo 返回正确的预算信息（2分钟预算）', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    const timing = orchestrator.getTimingInfo();

    // 返回结构包含所有必需字段
    expect(timing).toHaveProperty('elapsed');
    expect(timing).toHaveProperty('budget');
    expect(timing).toHaveProperty('withinBudget');

    // 预算为 2分钟 = 120000ms
    expect(timing.budget).toBe(120000);
    // 已用时间为非负数
    expect(typeof timing.elapsed).toBe('number');
    expect(timing.elapsed).toBeGreaterThanOrEqual(0);
    // 刚创建时应在预算内
    expect(timing.withinBudget).toBe(true);
  });

  // ===== 切片15: reset 重置到 INVITE 状态 =====
  test('reset 重置编排器到初始 INVITE 状态', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    // 走完整个流程
    orchestrator.getInvitationDialog();
    orchestrator.processChildResponse('愿意');
    expect(orchestrator.getState()).toBe('CONFIRMED');
    expect(orchestrator.isComplete()).toBe(true);

    // 重置后回到初始状态
    orchestrator.reset();
    expect(orchestrator.getState()).toBe('INVITE');
    expect(orchestrator.isComplete()).toBe(false);
    // partnerAcceptance 也应被重置
    expect(orchestrator.getPartnerAcceptance()).toBeNull();

    // 重置后可以重新走流程
    orchestrator.getInvitationDialog();
    expect(orchestrator.getState()).toBe('AWAIT_RESPONSE');
    orchestrator.processChildResponse('愿意');
    expect(orchestrator.getState()).toBe('CONFIRMED');
    expect(orchestrator.getPartnerAcceptance()).toBe(true);
  });

  // ===== 切片16: reset 在 DECLINED 状态后也能重置 =====
  test('reset 在 DECLINED 状态后也能重置到 INVITE', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();
    orchestrator.processChildResponse('不要');
    expect(orchestrator.getState()).toBe('DECLINED');
    expect(orchestrator.getPartnerAcceptance()).toBe(false);

    orchestrator.reset();
    expect(orchestrator.getState()).toBe('INVITE');
    expect(orchestrator.getPartnerAcceptance()).toBeNull();
    expect(orchestrator.isComplete()).toBe(false);
  });

  // ===== 切片17: 测试不同兴趣分型（dinosaur/princess/speed/generic） =====
  describe('不同兴趣分型的搭档确认流程', () => {
    test('dinosaur + 恐龙蛋 → 恐龙搭档邀请，accept → CONFIRMED', () => {
      const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
      const invitation = orchestrator.getInvitationDialog();
      expect(invitation.mainLine).toContain('恐龙蛋');
      expect(invitation.mainLine).toContain('恐龙搭档');

      const result = orchestrator.processChildResponse('愿意');
      expect(result.classification.type).toBe('accept');
      expect(result.partnerAcceptance).toBe(true);
      expect(orchestrator.isComplete()).toBe(true);
    });

    test('princess + 艾莎 → 魔法搭档邀请，accept → CONFIRMED', () => {
      const orchestrator = createPartnerOrchestrator('princess', '艾莎');
      const invitation = orchestrator.getInvitationDialog();
      expect(invitation.mainLine).toContain('艾莎');
      expect(invitation.mainLine).toContain('魔法搭档');

      const result = orchestrator.processChildResponse('可以');
      expect(result.classification.type).toBe('accept');
      expect(result.partnerAcceptance).toBe(true);
      expect(orchestrator.isComplete()).toBe(true);
    });

    test('speed + 闪电 → 赛车搭档邀请，refuse → DECLINED', () => {
      const orchestrator = createPartnerOrchestrator('speed', '闪电');
      const invitation = orchestrator.getInvitationDialog();
      expect(invitation.mainLine).toContain('闪电');
      expect(invitation.mainLine).toContain('赛车搭档');

      const result = orchestrator.processChildResponse('不要');
      expect(result.classification.type).toBe('refuse');
      expect(result.partnerAcceptance).toBe(false);
      expect(orchestrator.isComplete()).toBe(true);
    });

    test('generic + 小白 → 小伙伴邀请，hesitate → 回到 AWAIT_RESPONSE', () => {
      const orchestrator = createPartnerOrchestrator('generic', '小白');
      const invitation = orchestrator.getInvitationDialog();
      expect(invitation.mainLine).toContain('小白');
      expect(invitation.mainLine).toContain('小伙伴');

      const result = orchestrator.processChildResponse('让我想想');
      expect(result.classification.type).toBe('hesitate');
      expect(result.partnerAcceptance).toBeNull();
      expect(orchestrator.getState()).toBe('AWAIT_RESPONSE');
      expect(orchestrator.isComplete()).toBe(false);
    });
  });

  // ===== 切片18: hesitate 时返回的台词应包含脆弱分享与再邀 =====
  test('hesitate 时返回的台词应包含脆弱分享与再邀（followUp 非空）', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();
    const result = orchestrator.processChildResponse('嗯');

    expect(result.classification.type).toBe('hesitate');
    // hesitate 时 mainLine 应包含脆弱分享
    expect(result.mainLine).toContain('害怕');
    // followUp 应包含再邀
    expect(result.followUp).not.toBeNull();
    expect(result.followUp).toContain('搭档');
  });

  // ===== 切片19: accept 时返回的台词应包含搭档确立 =====
  test('accept 时返回的台词应包含搭档确立的喜悦', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();
    const result = orchestrator.processChildResponse('愿意');

    expect(result.classification.type).toBe('accept');
    // accept 时 mainLine 应包含搭档确立
    expect(result.mainLine).toContain('搭档');
    expect(result.mainLine).toContain('开心');
  });

  // ===== 切片20: refuse 时返回的台词应温柔收尾 =====
  test('refuse 时返回的台词应温柔收尾', () => {
    const orchestrator = createPartnerOrchestrator('dinosaur', '恐龙蛋');
    orchestrator.getInvitationDialog();
    const result = orchestrator.processChildResponse('不要');

    expect(result.classification.type).toBe('refuse');
    // refuse 时 mainLine 应包含温柔收尾
    expect(result.mainLine).toContain('没关系');
    // followUp 为 null
    expect(result.followUp).toBeNull();
  });
});
