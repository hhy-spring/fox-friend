const {
  getStep5InvitationDialog,
  getStep5ResponseDialog,
  getStep5Dialog
} = require('../../src/dialog/step5-templates');

describe('步骤5 搭档确认台词 - Issue #3 台词分型', () => {
  // ===== 切片1: getStep5InvitationDialog 通用类型邀请 =====
  describe('getStep5InvitationDialog - 通用邀请', () => {
    test('generic 类型返回小伙伴邀请，包含 foxName', () => {
      const dialog = getStep5InvitationDialog('generic', '豆豆');
      expect(dialog.mainLine).toContain('豆豆');
      expect(dialog.mainLine).toContain('小伙伴');
      expect(dialog).toHaveProperty('followUp');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
    });
  });

  // ===== 切片2: getStep5InvitationDialog 恐龙类型邀请 =====
  describe('getStep5InvitationDialog - 恐龙搭档邀请', () => {
    test('dinosaur 类型返回恐龙搭档邀请，包含 foxName', () => {
      const dialog = getStep5InvitationDialog('dinosaur', '恐龙蛋');
      expect(dialog.mainLine).toContain('恐龙蛋');
      expect(dialog.mainLine).toContain('恐龙搭档');
      expect(dialog).toHaveProperty('followUp');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
    });
  });

  // ===== 切片3: getStep5InvitationDialog 公主/魔法类型邀请 =====
  describe('getStep5InvitationDialog - 魔法搭档邀请', () => {
    test('princess 类型返回魔法搭档邀请，包含 foxName', () => {
      const dialog = getStep5InvitationDialog('princess', '艾莎');
      expect(dialog.mainLine).toContain('艾莎');
      expect(dialog.mainLine).toContain('魔法搭档');
      expect(dialog).toHaveProperty('followUp');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
    });
  });

  // ===== 切片4: getStep5InvitationDialog 速度类型邀请 =====
  describe('getStep5InvitationDialog - 赛车搭档邀请', () => {
    test('speed 类型返回赛车搭档邀请，包含 foxName', () => {
      const dialog = getStep5InvitationDialog('speed', '闪电');
      expect(dialog.mainLine).toContain('闪电');
      expect(dialog.mainLine).toContain('赛车搭档');
      expect(dialog).toHaveProperty('followUp');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
    });
  });

  // ===== 切片5: getStep5ResponseDialog 接受回应 =====
  describe('getStep5ResponseDialog - 孩子接受', () => {
    test('accept 回应 → partnerAcceptance 为 true，搭档关系确立', () => {
      const dialog = getStep5ResponseDialog('dinosaur', '恐龙蛋', 'accept');
      expect(dialog.partnerAcceptance).toBe(true);
      expect(dialog.mainLine).toContain('恐龙蛋');
      expect(dialog.mainLine.length).toBeGreaterThan(0);
      expect(dialog).toHaveProperty('followUp');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
    });
  });

  // ===== 切片6: getStep5ResponseDialog 犹豫回应 =====
  describe('getStep5ResponseDialog - 孩子犹豫', () => {
    test('hesitate 回应 → 分享脆弱「我有点害怕没有人愿意做我的搭档...」并再邀', () => {
      const dialog = getStep5ResponseDialog('generic', '豆豆', 'hesitate');
      expect(dialog.partnerAcceptance).toBeNull();
      expect(dialog.mainLine).toContain('我有点害怕没有人愿意做我的搭档');
      // followUp 包含再次邀请
      expect(dialog.followUp).not.toBeNull();
      expect(dialog.followUp.length).toBeGreaterThan(0);
      expect(dialog).toHaveProperty('waitBeforeNextMs');
    });
  });

  // ===== 切片7: getStep5ResponseDialog 拒绝回应 =====
  describe('getStep5ResponseDialog - 孩子拒绝', () => {
    test('refuse 回应 → partnerAcceptance 为 false，温柔收尾', () => {
      const dialog = getStep5ResponseDialog('generic', '豆豆', 'refuse');
      expect(dialog.partnerAcceptance).toBe(false);
      expect(dialog.mainLine).toContain('没关系，我一直在，你随时可以来找我');
      expect(dialog).toHaveProperty('followUp');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
    });
  });

  // ===== 切片8: getStep5ResponseDialog 所有兴趣类型的 accept 回应 =====
  describe('getStep5ResponseDialog - 所有兴趣类型 accept', () => {
    test('dinosaur accept 包含「恐龙搭档」', () => {
      const dialog = getStep5ResponseDialog('dinosaur', '恐龙蛋', 'accept');
      expect(dialog.partnerAcceptance).toBe(true);
      expect(dialog.mainLine).toContain('恐龙搭档');
    });

    test('princess accept 包含「魔法搭档」', () => {
      const dialog = getStep5ResponseDialog('princess', '艾莎', 'accept');
      expect(dialog.partnerAcceptance).toBe(true);
      expect(dialog.mainLine).toContain('魔法搭档');
    });

    test('speed accept 包含「赛车搭档」', () => {
      const dialog = getStep5ResponseDialog('speed', '闪电', 'accept');
      expect(dialog.partnerAcceptance).toBe(true);
      expect(dialog.mainLine).toContain('赛车搭档');
    });

    test('generic accept 包含「小伙伴」', () => {
      const dialog = getStep5ResponseDialog('generic', '豆豆', 'accept');
      expect(dialog.partnerAcceptance).toBe(true);
      expect(dialog.mainLine).toContain('小伙伴');
    });
  });

  // ===== 切片8b: getStep5ResponseDialog 所有兴趣类型的 hesitate 回应 =====
  describe('getStep5ResponseDialog - 所有兴趣类型 hesitate', () => {
    test('dinosaur hesitate followUp 包含「恐龙搭档」', () => {
      const dialog = getStep5ResponseDialog('dinosaur', '恐龙蛋', 'hesitate');
      expect(dialog.partnerAcceptance).toBeNull();
      expect(dialog.followUp).toContain('恐龙搭档');
    });

    test('princess hesitate followUp 包含「魔法搭档」', () => {
      const dialog = getStep5ResponseDialog('princess', '艾莎', 'hesitate');
      expect(dialog.partnerAcceptance).toBeNull();
      expect(dialog.followUp).toContain('魔法搭档');
    });

    test('speed hesitate followUp 包含「赛车搭档」', () => {
      const dialog = getStep5ResponseDialog('speed', '闪电', 'hesitate');
      expect(dialog.partnerAcceptance).toBeNull();
      expect(dialog.followUp).toContain('赛车搭档');
    });

    test('generic hesitate followUp 包含「小伙伴」', () => {
      const dialog = getStep5ResponseDialog('generic', '豆豆', 'hesitate');
      expect(dialog.partnerAcceptance).toBeNull();
      expect(dialog.followUp).toContain('小伙伴');
    });
  });

  // ===== 切片9: getStep5Dialog 组合访问器 =====
  describe('getStep5Dialog - 组合访问器', () => {
    test('不传 childResponse → 返回邀请台词', () => {
      const dialog = getStep5Dialog('dinosaur', '恐龙蛋');
      expect(dialog.mainLine).toContain('恐龙蛋');
      expect(dialog.mainLine).toContain('恐龙搭档');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
    });

    test('传 accept → 返回接受回应台词，含 partnerAcceptance', () => {
      const dialog = getStep5Dialog('dinosaur', '恐龙蛋', 'accept');
      expect(dialog.partnerAcceptance).toBe(true);
      expect(dialog.mainLine).toContain('恐龙搭档');
    });

    test('传 hesitate → 返回犹豫回应台词，含 partnerAcceptance', () => {
      const dialog = getStep5Dialog('generic', '豆豆', 'hesitate');
      expect(dialog.partnerAcceptance).toBeNull();
      expect(dialog.mainLine).toContain('我有点害怕没有人愿意做我的搭档');
    });

    test('传 refuse → 返回拒绝回应台词，含 partnerAcceptance', () => {
      const dialog = getStep5Dialog('generic', '豆豆', 'refuse');
      expect(dialog.partnerAcceptance).toBe(false);
      expect(dialog.mainLine).toContain('没关系，我一直在，你随时可以来找我');
    });
  });

  // ===== 切片10: 边界情况 =====
  describe('边界情况', () => {
    test('未知兴趣类型 → 邀请回退到「小伙伴」', () => {
      const dialog = getStep5InvitationDialog('unknown', '小白');
      expect(dialog.mainLine).toContain('小白');
      expect(dialog.mainLine).toContain('小伙伴');
    });

    test('未知兴趣类型 → accept 回应回退到「小伙伴」', () => {
      const dialog = getStep5ResponseDialog('unknown', '小白', 'accept');
      expect(dialog.partnerAcceptance).toBe(true);
      expect(dialog.mainLine).toContain('小伙伴');
    });

    test('空 foxName → 邀请使用默认名字', () => {
      const dialog = getStep5InvitationDialog('generic', '');
      expect(dialog.mainLine.length).toBeGreaterThan(0);
      expect(dialog.mainLine).toContain('小伙伴');
    });

    test('null foxName → 邀请使用默认名字', () => {
      const dialog = getStep5InvitationDialog('generic', null);
      expect(dialog.mainLine.length).toBeGreaterThan(0);
      expect(dialog.mainLine).toContain('小伙伴');
    });

    test('refuse 回应对所有兴趣类型 partnerAcceptance 均为 false', () => {
      const types = ['dinosaur', 'princess', 'speed', 'generic'];
      for (const type of types) {
        const dialog = getStep5ResponseDialog(type, '小白', 'refuse');
        expect(dialog.partnerAcceptance).toBe(false);
        expect(dialog.mainLine).toContain('没关系，我一直在，你随时可以来找我');
      }
    });

    test('邀请台词精确插值 foxName', () => {
      const dialog = getStep5InvitationDialog('dinosaur', '霸王龙');
      expect(dialog.mainLine).toBe('霸王龙想正式问你：你愿意做我的恐龙搭档吗？');
    });

    test('accept 回应精确插值 foxName 与搭档标签', () => {
      const dialog = getStep5ResponseDialog('speed', '闪电', 'accept');
      expect(dialog.mainLine).toBe('太好了！从今天起，我们就是赛车搭档啦！闪电好开心！');
    });

    test('返回结构包含所有必需字段', () => {
      const invitation = getStep5InvitationDialog('generic', '豆豆');
      expect(invitation).toHaveProperty('mainLine');
      expect(invitation).toHaveProperty('followUp');
      expect(invitation).toHaveProperty('waitBeforeNextMs');

      const response = getStep5ResponseDialog('generic', '豆豆', 'accept');
      expect(response).toHaveProperty('mainLine');
      expect(response).toHaveProperty('followUp');
      expect(response).toHaveProperty('partnerAcceptance');
      expect(response).toHaveProperty('waitBeforeNextMs');
    });
  });
});
