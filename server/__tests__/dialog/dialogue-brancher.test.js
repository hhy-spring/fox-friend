const {
  createDialogueBrancher
} = require('../../src/dialog/dialogue-brancher');
const { INTEREST_TYPES } = require('../../src/dialog/interest-classifier');
const { STEP3_SUB_STATES } = require('../../src/dialog/step3-templates');

describe('台词分型引擎集成模块 - Issue #3 dialogue-brancher', () => {
  describe('createDialogueBrancher - 基础功能', () => {
    test('创建分支器实例，返回包含所有方法的对象', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_001');
      expect(brancher).toHaveProperty('getInterestType');
      expect(brancher).toHaveProperty('getStep3Dialog');
      expect(brancher).toHaveProperty('getStep4Dialog');
      expect(brancher).toHaveProperty('getStep5Dialog');
      expect(brancher).toHaveProperty('getSessionContext');
      expect(brancher).toHaveProperty('getInterestsDerivedFromFoxName');
      expect(brancher).toHaveProperty('buildProfileWithInterest');
    });

    test('getInterestType 返回正确的兴趣类型', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_001');
      expect(brancher.getInterestType()).toBe(INTEREST_TYPES.DINOSAUR);
    });

    test('getInterestType 对闪电返回 speed', () => {
      const brancher = createDialogueBrancher('闪电', 'child_002');
      expect(brancher.getInterestType()).toBe(INTEREST_TYPES.SPEED);
    });

    test('getInterestType 对小白返回 generic', () => {
      const brancher = createDialogueBrancher('小白', 'child_003');
      expect(brancher.getInterestType()).toBe(INTEREST_TYPES.GENERIC);
    });
  });

  describe('getStep3Dialog - 步骤3台词分型', () => {
    test('dinosaur + WORSHIP → 含嗷呜——音效的崇拜式回应', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_001');
      const dialog = brancher.getStep3Dialog(STEP3_SUB_STATES.WORSHIP);
      expect(dialog.mainLine).toContain('嗷呜——');
      expect(dialog.mainLine).toContain('恐龙蛋');
      expect(dialog.mainLine).toContain('恐龙');
    });

    test('princess + WORSHIP → 含叮——音效的崇拜式回应', () => {
      const brancher = createDialogueBrancher('艾莎', 'child_001');
      const dialog = brancher.getStep3Dialog(STEP3_SUB_STATES.WORSHIP);
      expect(dialog.mainLine).toContain('叮——');
      expect(dialog.mainLine).toContain('艾莎');
    });

    test('speed + WORSHIP → 含嗖——音效的崇拜式回应', () => {
      const brancher = createDialogueBrancher('闪电', 'child_001');
      const dialog = brancher.getStep3Dialog(STEP3_SUB_STATES.WORSHIP);
      expect(dialog.mainLine).toContain('嗖——');
      expect(dialog.mainLine).toContain('闪电');
    });

    test('dinosaur + ASK_INTERESTS → 含恐龙关键词的追问', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_001');
      const dialog = brancher.getStep3Dialog(STEP3_SUB_STATES.ASK_INTERESTS);
      expect(dialog.mainLine).toContain('恐龙');
      expect(dialog.field).toBe('interests');
    });

    test('generic + ASK_INTERESTS → 通用追问', () => {
      const brancher = createDialogueBrancher('小白', 'child_001');
      const dialog = brancher.getStep3Dialog(STEP3_SUB_STATES.ASK_INTERESTS);
      expect(dialog.mainLine).toContain('你喜欢做什么');
    });
  });

  describe('getStep4Dialog - 步骤4费曼触发分型', () => {
    test('dinosaur + 无孩子反应 → 触发台词聚焦"龙"字', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_001');
      const dialog = brancher.getStep4Dialog();
      expect(dialog.mainLine).toContain('龙');
      expect(dialog.targetCharacter).toBe('龙');
    });

    test('speed + 无孩子反应 → 触发台词聚焦"闪"字', () => {
      const brancher = createDialogueBrancher('闪电', 'child_001');
      const dialog = brancher.getStep4Dialog();
      expect(dialog.mainLine).toContain('闪');
      expect(dialog.targetCharacter).toBe('闪');
    });

    test('generic + 无孩子反应 → 回退通用台词', () => {
      const brancher = createDialogueBrancher('小白', 'child_001');
      const dialog = brancher.getStep4Dialog();
      expect(dialog.mainLine).toContain('我还想知道更多字');
      expect(dialog.targetCharacter).toBeNull();
    });

    test('dinosaur + correct 反应 → 崇拜反馈', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_001');
      const dialog = brancher.getStep4Dialog('correct');
      expect(dialog.mainLine).toContain('你太厉害了');
      expect(dialog.teachingWillingness).toBe(true);
    });
  });

  describe('getStep5Dialog - 步骤5搭档确认分型', () => {
    test('dinosaur + 无孩子反应 → 恐龙搭档邀请', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_001');
      const dialog = brancher.getStep5Dialog();
      expect(dialog.mainLine).toContain('恐龙搭档');
    });

    test('princess + 无孩子反应 → 魔法搭档邀请', () => {
      const brancher = createDialogueBrancher('艾莎', 'child_001');
      const dialog = brancher.getStep5Dialog();
      expect(dialog.mainLine).toContain('魔法搭档');
    });

    test('speed + accept → 赛车搭档确认', () => {
      const brancher = createDialogueBrancher('闪电', 'child_001');
      const dialog = brancher.getStep5Dialog('accept');
      expect(dialog.mainLine).toContain('赛车搭档');
      expect(dialog.partnerAcceptance).toBe(true);
    });

    test('generic + refuse → 温柔收尾', () => {
      const brancher = createDialogueBrancher('小白', 'child_001');
      const dialog = brancher.getStep5Dialog('refuse');
      expect(dialog.mainLine).toContain('没关系');
      expect(dialog.partnerAcceptance).toBe(false);
    });
  });

  describe('getSessionContext - 会话上下文', () => {
    test('返回包含兴趣分型结果的会话上下文', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_001');
      const ctx = brancher.getSessionContext();
      expect(ctx.getInterestType()).toBe(INTEREST_TYPES.DINOSAUR);
      expect(ctx.isClassified()).toBe(true);
    });

    test('会话上下文包含 childId', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_001');
      const ctx = brancher.getSessionContext();
      const json = ctx.toJSON();
      expect(json.childId).toBe('child_001');
      expect(json.foxName).toBe('恐龙蛋');
    });
  });

  describe('getInterestsDerivedFromFoxName - 画像字段', () => {
    test('dinosaur → 返回匹配的关键词数组', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_001');
      const interests = brancher.getInterestsDerivedFromFoxName();
      expect(Array.isArray(interests)).toBe(true);
      expect(interests.length).toBeGreaterThan(0);
    });

    test('generic → 返回空数组', () => {
      const brancher = createDialogueBrancher('小白', 'child_001');
      const interests = brancher.getInterestsDerivedFromFoxName();
      expect(interests).toEqual([]);
    });
  });

  describe('buildProfileWithInterest - 完整画像构建', () => {
    test('返回包含 interests_derived_from_fox_name 字段的画像', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_001');
      const collectedData = {
        nickname: '小明',
        age: 5,
        interests: ['恐龙', '画画'],
        selfClaimedSkills: '跑得快'
      };
      const profile = brancher.buildProfileWithInterest(
        collectedData,
        '恐龙蛋',
        'child_choice',
        3
      );
      expect(profile).toHaveProperty('interests_derived_from_fox_name');
      expect(profile.fox_name).toBe('恐龙蛋');
      expect(profile.fox_name_source).toBe('child_choice');
      expect(profile.nickname).toBe('小明');
      expect(profile.first_meeting_reactions.proactive_speech_count).toBe(3);
    });

    test('generic 类型 → interests_derived_from_fox_name 为空数组', () => {
      const brancher = createDialogueBrancher('小白', 'child_001');
      const collectedData = {
        nickname: '小红',
        age: 4,
        interests: null,
        selfClaimedSkills: null
      };
      const profile = brancher.buildProfileWithInterest(
        collectedData,
        '小白',
        'child_choice',
        2
      );
      expect(profile.interests_derived_from_fox_name).toEqual([]);
    });
  });

  describe('端到端流程验证 - 4种兴趣分型完整流程', () => {
    test('dinosaur 完整流程：分类→步骤3→步骤4→步骤5', () => {
      const brancher = createDialogueBrancher('恐龙蛋', 'child_e2e_1');

      // 步骤3 崇拜式回应
      const worship = brancher.getStep3Dialog(STEP3_SUB_STATES.WORSHIP);
      expect(worship.mainLine).toContain('嗷呜——');

      // 步骤3 画像采集
      const interestsQ = brancher.getStep3Dialog(STEP3_SUB_STATES.ASK_INTERESTS);
      expect(interestsQ.mainLine).toContain('恐龙');

      // 步骤4 费曼触发
      const feynman = brancher.getStep4Dialog();
      expect(feynman.targetCharacter).toBe('龙');

      // 步骤5 搭档确认
      const partner = brancher.getStep5Dialog();
      expect(partner.mainLine).toContain('恐龙搭档');
    });

    test('princess 完整流程：分类→步骤3→步骤4→步骤5', () => {
      const brancher = createDialogueBrancher('艾莎', 'child_e2e_2');

      const worship = brancher.getStep3Dialog(STEP3_SUB_STATES.WORSHIP);
      expect(worship.mainLine).toContain('叮——');

      const interestsQ = brancher.getStep3Dialog(STEP3_SUB_STATES.ASK_INTERESTS);
      expect(interestsQ.mainLine).toContain('公主');

      const feynman = brancher.getStep4Dialog();
      expect(feynman.targetCharacter).toBe('莎');

      const partner = brancher.getStep5Dialog();
      expect(partner.mainLine).toContain('魔法搭档');
    });

    test('speed 完整流程：分类→步骤3→步骤4→步骤5', () => {
      const brancher = createDialogueBrancher('闪电', 'child_e2e_3');

      const worship = brancher.getStep3Dialog(STEP3_SUB_STATES.WORSHIP);
      expect(worship.mainLine).toContain('嗖——');

      const interestsQ = brancher.getStep3Dialog(STEP3_SUB_STATES.ASK_INTERESTS);
      expect(interestsQ.mainLine).toContain('赛车');

      const feynman = brancher.getStep4Dialog();
      expect(feynman.targetCharacter).toBe('闪');

      const partner = brancher.getStep5Dialog();
      expect(partner.mainLine).toContain('赛车搭档');
    });

    test('generic 完整流程：分类→步骤3→步骤4→步骤5', () => {
      const brancher = createDialogueBrancher('豆豆', 'child_e2e_4');

      const worship = brancher.getStep3Dialog(STEP3_SUB_STATES.WORSHIP);
      expect(worship.mainLine).not.toContain('嗷呜');
      expect(worship.mainLine).not.toContain('叮——');
      expect(worship.mainLine).not.toContain('嗖——');

      const interestsQ = brancher.getStep3Dialog(STEP3_SUB_STATES.ASK_INTERESTS);
      expect(interestsQ.mainLine).toContain('你喜欢做什么');

      const feynman = brancher.getStep4Dialog();
      expect(feynman.targetCharacter).toBeNull();

      const partner = brancher.getStep5Dialog();
      expect(partner.mainLine).toContain('小伙伴');
    });
  });
});
