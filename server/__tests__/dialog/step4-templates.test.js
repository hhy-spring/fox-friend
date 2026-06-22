/**
 * 步骤4 费曼学习触发台词模板 - Issue #3 台词分型引擎
 *
 * 参考技术架构文档§三「对话引擎架构」
 * 参考PRD §4.1 步骤4 费曼学习法首次触发
 *
 * 职责：
 *   1. 根据兴趣分型从狐狸名字中提取要教的"生字"
 *   2. 输出费曼触发的主动台词（小狐狸请孩子教它认字）
 *   3. 根据孩子反应输出对应反馈台词，并记录 teaching_willingness
 */
const {
  extractTargetCharacter,
  getStep4TriggerDialog,
  getStep4FeedbackDialog,
  getStep4Dialog
} = require('../../src/dialog/step4-templates');

describe('步骤4 费曼学习触发台词 - Issue #3 台词分型引擎', () => {
  describe('extractTargetCharacter - 根据兴趣分型提取要教的生字', () => {
    // ===== 切片1: dinosaur 类型从名字中提取「龙」 =====
    test('dinosaur 类型 + 「恐龙蛋」 → 提取「龙」', () => {
      const target = extractTargetCharacter('dinosaur', '恐龙蛋');
      expect(target).toBe('龙');
    });

    // ===== 切片2: speed 类型从名字中提取「闪」 =====
    test('speed 类型 + 「闪电」 → 提取「闪」', () => {
      const target = extractTargetCharacter('speed', '闪电');
      expect(target).toBe('闪');
    });

    // ===== 切片3: princess 类型提取「莎」或「魔」 =====
    test('princess 类型 + 「艾莎」 → 提取「莎」', () => {
      const target = extractTargetCharacter('princess', '艾莎');
      expect(target).toBe('莎');
    });

    test('princess 类型 + 「魔法仙子」 → 提取「魔」', () => {
      const target = extractTargetCharacter('princess', '魔法仙子');
      expect(target).toBe('魔');
    });

    // ===== 切片4: generic 类型返回 null（无特定生字可教） =====
    test('generic 类型 + 「小白」 → 返回 null', () => {
      const target = extractTargetCharacter('generic', '小白');
      expect(target).toBeNull();
    });

    test('generic 类型 + 「豆豆」 → 返回 null', () => {
      const target = extractTargetCharacter('generic', '豆豆');
      expect(target).toBeNull();
    });

    // ===== 切片5: 名字中不含目标字时返回 null（边界情况） =====
    test('dinosaur 类型 + 「化石」（不含龙） → 返回 null', () => {
      const target = extractTargetCharacter('dinosaur', '化石');
      expect(target).toBeNull();
    });

    test('speed 类型 + 「赛车」（不含闪） → 返回 null', () => {
      const target = extractTargetCharacter('speed', '赛车');
      expect(target).toBeNull();
    });

    test('princess 类型 + 「公主」（不含莎/魔） → 返回 null', () => {
      const target = extractTargetCharacter('princess', '公主');
      expect(target).toBeNull();
    });

    test('空名字 → 返回 null', () => {
      const target = extractTargetCharacter('dinosaur', '');
      expect(target).toBeNull();
    });

    test('null 名字 → 返回 null', () => {
      const target = extractTargetCharacter('dinosaur', null);
      expect(target).toBeNull();
    });

    test('未知兴趣类型 → 返回 null', () => {
      const target = extractTargetCharacter('unknown', '恐龙蛋');
      expect(target).toBeNull();
    });
  });

  describe('getStep4TriggerDialog - 费曼触发主动台词', () => {
    // ===== 切片6: dinosaur 触发台词 =====
    test('dinosaur + 「恐龙蛋」 → 台词聚焦「龙」字并请孩子教', () => {
      const dialog = getStep4TriggerDialog('dinosaur', '恐龙蛋');
      expect(dialog).toHaveProperty('mainLine');
      expect(dialog).toHaveProperty('followUp');
      expect(dialog).toHaveProperty('targetCharacter');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
      expect(dialog.targetCharacter).toBe('龙');
      // 台词应包含名字和要教的字
      expect(dialog.mainLine).toContain('恐龙蛋');
      expect(dialog.mainLine).toContain('龙');
      // 应体现"以教代学"——请孩子教
      expect(dialog.mainLine).toContain('教');
      expect(typeof dialog.waitBeforeNextMs).toBe('number');
    });

    // ===== 切片7: speed 触发台词 =====
    test('speed + 「闪电」 → 台词聚焦「闪」字并请孩子教', () => {
      const dialog = getStep4TriggerDialog('speed', '闪电');
      expect(dialog.targetCharacter).toBe('闪');
      expect(dialog.mainLine).toContain('闪电');
      expect(dialog.mainLine).toContain('闪');
      expect(dialog.mainLine).toContain('教');
      expect(typeof dialog.waitBeforeNextMs).toBe('number');
    });

    // ===== 切片8: princess 触发台词（莎和魔两种） =====
    test('princess + 「艾莎」 → 台词聚焦「莎」字并请孩子教', () => {
      const dialog = getStep4TriggerDialog('princess', '艾莎');
      expect(dialog.targetCharacter).toBe('莎');
      expect(dialog.mainLine).toContain('艾莎');
      expect(dialog.mainLine).toContain('莎');
      expect(dialog.mainLine).toContain('教');
    });

    test('princess + 「魔法仙子」 → 台词聚焦「魔」字并请孩子教', () => {
      const dialog = getStep4TriggerDialog('princess', '魔法仙子');
      expect(dialog.targetCharacter).toBe('魔');
      expect(dialog.mainLine).toContain('魔法仙子');
      expect(dialog.mainLine).toContain('魔');
      expect(dialog.mainLine).toContain('教');
    });

    // ===== 切片9: generic 通用回退台词 =====
    test('generic + 「小白」 → 回退到「我还想知道更多字！你能教我认你的名字吗？」', () => {
      const dialog = getStep4TriggerDialog('generic', '小白');
      expect(dialog.targetCharacter).toBeNull();
      // 参考PRD §4.1 步骤4：名字无生字 → 转通用台词
      expect(dialog.mainLine).toContain('我还想知道更多字');
      expect(dialog.mainLine).toContain('你能教我认你的名字吗');
      expect(dialog.mainLine).toContain('教');
      expect(typeof dialog.waitBeforeNextMs).toBe('number');
    });

    test('generic + 「豆豆」 → 回退到通用台词', () => {
      const dialog = getStep4TriggerDialog('generic', '豆豆');
      expect(dialog.targetCharacter).toBeNull();
      expect(dialog.mainLine).toContain('我还想知道更多字');
      expect(dialog.mainLine).toContain('你能教我认你的名字吗');
    });

    test('dinosaur + 「化石」（名字不含目标字） → 回退到通用台词', () => {
      // 兴趣类型已分类但名字中无目标生字时，也应回退到通用台词
      const dialog = getStep4TriggerDialog('dinosaur', '化石');
      expect(dialog.targetCharacter).toBeNull();
      expect(dialog.mainLine).toContain('我还想知道更多字');
      expect(dialog.mainLine).toContain('你能教我认你的名字吗');
    });
  });

  describe('getStep4FeedbackDialog - 孩子反应反馈台词', () => {
    // ===== 切片10: correct 崇拜反馈 =====
    test('correct → 崇拜反馈「你太厉害了！你是我的识字搭档！」+ teachingWillingness: true', () => {
      const dialog = getStep4FeedbackDialog('correct');
      expect(dialog).toHaveProperty('mainLine');
      expect(dialog).toHaveProperty('followUp');
      expect(dialog).toHaveProperty('teachingWillingness');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
      // 参考PRD §4.1 步骤4：孩子念对 → 崇拜反馈
      expect(dialog.mainLine).toContain('你太厉害了');
      expect(dialog.mainLine).toContain('识字搭档');
      expect(dialog.teachingWillingness).toBe(true);
      expect(typeof dialog.waitBeforeNextMs).toBe('number');
    });

    // ===== 切片11: unsure 共同探索 =====
    test('unsure → 「没关系，我们一起查查！」共同探索 + teachingWillingness: true', () => {
      const dialog = getStep4FeedbackDialog('unsure');
      // 参考PRD §4.1 步骤4：孩子不确定 → 共同探索，仍记录 teaching_willingness: true
      expect(dialog.mainLine).toContain('没关系');
      expect(dialog.mainLine).toContain('我们一起查查');
      expect(dialog.teachingWillingness).toBe(true);
      expect(typeof dialog.waitBeforeNextMs).toBe('number');
    });

    // ===== 切片12: refuse 拒绝记录 false =====
    test('refuse → teachingWillingness: false，不强制教学', () => {
      const dialog = getStep4FeedbackDialog('refuse');
      // 参考PRD §4.1 步骤4：孩子明确拒绝教 → 记录 teaching_willingness: false，不强制进入教学
      expect(dialog.teachingWillingness).toBe(false);
      // 台词应温柔收尾，不强制教学
      expect(dialog.mainLine.length).toBeGreaterThan(0);
      expect(dialog.mainLine).toContain('没关系');
      expect(typeof dialog.waitBeforeNextMs).toBe('number');
    });

    test('未知反应 → 回退到 refuse 行为（teachingWillingness: false）', () => {
      // 未知反应按保守处理，不记录愿意教学
      const dialog = getStep4FeedbackDialog('unknown');
      expect(dialog.teachingWillingness).toBe(false);
      expect(dialog.mainLine.length).toBeGreaterThan(0);
    });
  });

  describe('getStep4Dialog - 组合访问器', () => {
    // ===== 切片13: getStep4Dialog 组合访问器 =====
    test('不传 childResponse → 返回费曼触发台词（含 targetCharacter）', () => {
      const dialog = getStep4Dialog('dinosaur', '恐龙蛋');
      // 无孩子反应时，返回触发台词
      expect(dialog).toHaveProperty('mainLine');
      expect(dialog).toHaveProperty('targetCharacter');
      expect(dialog.targetCharacter).toBe('龙');
      expect(dialog.mainLine).toContain('恐龙蛋');
      expect(dialog.mainLine).toContain('教');
    });

    test('不传 childResponse（generic） → 返回通用触发台词', () => {
      const dialog = getStep4Dialog('generic', '小白');
      expect(dialog.targetCharacter).toBeNull();
      expect(dialog.mainLine).toContain('我还想知道更多字');
    });

    test('传 correct → 返回崇拜反馈台词（含 teachingWillingness: true）', () => {
      const dialog = getStep4Dialog('dinosaur', '恐龙蛋', 'correct');
      expect(dialog).toHaveProperty('teachingWillingness');
      expect(dialog.teachingWillingness).toBe(true);
      expect(dialog.mainLine).toContain('你太厉害了');
      expect(dialog.mainLine).toContain('识字搭档');
    });

    test('传 unsure → 返回共同探索反馈台词（含 teachingWillingness: true）', () => {
      const dialog = getStep4Dialog('speed', '闪电', 'unsure');
      expect(dialog.teachingWillingness).toBe(true);
      expect(dialog.mainLine).toContain('我们一起查查');
    });

    test('传 refuse → 返回拒绝反馈台词（含 teachingWillingness: false）', () => {
      const dialog = getStep4Dialog('princess', '艾莎', 'refuse');
      expect(dialog.teachingWillingness).toBe(false);
      expect(dialog.mainLine).toContain('没关系');
    });

    test('传 null 作为 childResponse → 返回触发台词', () => {
      const dialog = getStep4Dialog('dinosaur', '恐龙蛋', null);
      expect(dialog).toHaveProperty('targetCharacter');
      expect(dialog.targetCharacter).toBe('龙');
      expect(dialog.mainLine).toContain('教');
    });

    test('返回结构包含所有必需字段（触发分支）', () => {
      const dialog = getStep4Dialog('dinosaur', '恐龙蛋');
      expect(dialog).toHaveProperty('mainLine');
      expect(dialog).toHaveProperty('followUp');
      expect(dialog).toHaveProperty('targetCharacter');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
    });

    test('返回结构包含所有必需字段（反馈分支）', () => {
      const dialog = getStep4Dialog('dinosaur', '恐龙蛋', 'correct');
      expect(dialog).toHaveProperty('mainLine');
      expect(dialog).toHaveProperty('followUp');
      expect(dialog).toHaveProperty('teachingWillingness');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
    });
  });
});
