const {
  getStep3WorshipDialog,
  getStep3ProfileQuestions,
  getStep3Dialog,
  STEP3_SUB_STATES
} = require('../../src/dialog/step3-templates');
const { INTEREST_TYPES } = require('../../src/dialog/interest-classifier');

describe('步骤3 台词分型引擎 - Issue #3 Step 3 Templates', () => {
  // ===== 切片1: getStep3WorshipDialog 恐龙兴趣类型 =====
  describe('崇拜式回应 - 恐龙兴趣', () => {
    test('dinosaur 类型包含嗷呜——音效、提及恐龙、插入狐狸名字', () => {
      const result = getStep3WorshipDialog(INTEREST_TYPES.DINOSAUR, '恐龙蛋');
      expect(result.mainLine).toContain('嗷呜——');
      expect(result.mainLine).toContain('恐龙');
      expect(result.mainLine).toContain('恐龙蛋');
    });
  });

  // ===== 切片2: getStep3WorshipDialog 公主兴趣类型 =====
  describe('崇拜式回应 - 公主兴趣', () => {
    test('princess 类型包含叮——音效、提及魔法、插入狐狸名字', () => {
      const result = getStep3WorshipDialog(INTEREST_TYPES.PRINCESS, '艾莎');
      expect(result.mainLine).toContain('叮——');
      expect(result.mainLine).toContain('魔法');
      expect(result.mainLine).toContain('艾莎');
    });
  });

  // ===== 切片3: getStep3WorshipDialog 速度兴趣类型 =====
  describe('崇拜式回应 - 速度兴趣', () => {
    test('speed 类型包含嗖——音效、提及速度/赛车、插入狐狸名字', () => {
      const result = getStep3WorshipDialog(INTEREST_TYPES.SPEED, '闪电');
      expect(result.mainLine).toContain('嗖——');
      // 提及速度相关（太快/追不上 等速度意象）
      expect(result.mainLine).toContain('闪电');
    });
  });

  // ===== 切片4: getStep3WorshipDialog 通用兴趣类型 =====
  describe('崇拜式回应 - 通用兴趣', () => {
    test('generic 类型为纯崇拜式回应、无特殊音效、插入狐狸名字', () => {
      const result = getStep3WorshipDialog(INTEREST_TYPES.GENERIC, '小白');
      expect(result.mainLine).toContain('小白');
      // 无特殊音效（不含嗷呜——/叮——/嗖——）
      expect(result.mainLine).not.toContain('嗷呜——');
      expect(result.mainLine).not.toContain('叮——');
      expect(result.mainLine).not.toContain('嗖——');
    });
  });

  // ===== 切片5: getStep3WorshipDialog 返回结构 =====
  describe('崇拜式回应 - 返回结构', () => {
    test('返回对象包含 mainLine/followUp/waitBeforeNextMs 字段', () => {
      const result = getStep3WorshipDialog(INTEREST_TYPES.DINOSAUR, '恐龙蛋');
      expect(result).toHaveProperty('mainLine');
      expect(result).toHaveProperty('followUp');
      expect(result).toHaveProperty('waitBeforeNextMs');
      expect(typeof result.mainLine).toBe('string');
      expect(typeof result.waitBeforeNextMs).toBe('number');
    });

    test('未知兴趣类型回退到 generic 崇拜式回应', () => {
      const result = getStep3WorshipDialog('unknown_type', '小白');
      expect(result.mainLine).toContain('小白');
      expect(result.mainLine).not.toContain('嗷呜——');
      expect(result.mainLine).not.toContain('叮——');
      expect(result.mainLine).not.toContain('嗖——');
    });
  });

  // ===== 切片6: getStep3ProfileQuestions 恐龙兴趣类型 =====
  describe('画像采集追问 - 恐龙兴趣', () => {
    test('dinosaur 类型 interests 问题嵌入"你还喜欢什么恐龙？"', () => {
      const questions = getStep3ProfileQuestions(INTEREST_TYPES.DINOSAUR);
      expect(questions.interests.mainLine).toContain('你还喜欢什么恐龙？');
    });
  });

  // ===== 切片7: getStep3ProfileQuestions 公主兴趣类型 =====
  describe('画像采集追问 - 公主兴趣', () => {
    test('princess 类型 interests 问题嵌入"你还喜欢什么公主？"', () => {
      const questions = getStep3ProfileQuestions(INTEREST_TYPES.PRINCESS);
      expect(questions.interests.mainLine).toContain('你还喜欢什么公主？');
    });
  });

  // ===== 切片8: getStep3ProfileQuestions 速度兴趣类型 =====
  describe('画像采集追问 - 速度兴趣', () => {
    test('speed 类型 interests 问题嵌入"你还喜欢什么？赛车？飞机？"', () => {
      const questions = getStep3ProfileQuestions(INTEREST_TYPES.SPEED);
      expect(questions.interests.mainLine).toContain('你还喜欢什么？赛车？飞机？');
    });
  });

  // ===== 切片9: getStep3ProfileQuestions 通用兴趣类型 =====
  describe('画像采集追问 - 通用兴趣', () => {
    test('generic 类型 interests 问题为"你喜欢做什么？"', () => {
      const questions = getStep3ProfileQuestions(INTEREST_TYPES.GENERIC);
      expect(questions.interests.mainLine).toContain('你喜欢做什么？');
    });
  });

  // ===== 切片10: getStep3ProfileQuestions 返回结构 =====
  describe('画像采集追问 - 返回结构', () => {
    test('返回对象包含 nickname/age/interests/skills 四个字段', () => {
      const questions = getStep3ProfileQuestions(INTEREST_TYPES.DINOSAUR);
      expect(questions).toHaveProperty('nickname');
      expect(questions).toHaveProperty('age');
      expect(questions).toHaveProperty('interests');
      expect(questions).toHaveProperty('skills');
    });

    test('每个问题包含 mainLine/followUp/field/waitBeforeNextMs 字段', () => {
      const questions = getStep3ProfileQuestions(INTEREST_TYPES.DINOSAUR);
      for (const key of ['nickname', 'age', 'interests', 'skills']) {
        const q = questions[key];
        expect(q).toHaveProperty('mainLine');
        expect(q).toHaveProperty('followUp');
        expect(q).toHaveProperty('field');
        expect(q).toHaveProperty('waitBeforeNextMs');
        expect(typeof q.mainLine).toBe('string');
        expect(typeof q.field).toBe('string');
        expect(typeof q.waitBeforeNextMs).toBe('number');
      }
    });

    test('field 字段映射正确：nickname/age/interests/selfClaimedSkills', () => {
      const questions = getStep3ProfileQuestions(INTEREST_TYPES.GENERIC);
      expect(questions.nickname.field).toBe('nickname');
      expect(questions.age.field).toBe('age');
      expect(questions.interests.field).toBe('interests');
      expect(questions.skills.field).toBe('selfClaimedSkills');
    });

    test('未知兴趣类型回退到 generic 画像问题', () => {
      const questions = getStep3ProfileQuestions('unknown_type');
      expect(questions.interests.mainLine).toContain('你喜欢做什么？');
    });

    test('返回深拷贝，修改不影响模板', () => {
      const q1 = getStep3ProfileQuestions(INTEREST_TYPES.DINOSAUR);
      q1.interests.mainLine = '被修改了';
      const q2 = getStep3ProfileQuestions(INTEREST_TYPES.DINOSAUR);
      expect(q2.interests.mainLine).not.toBe('被修改了');
    });
  });

  // ===== 切片11: getStep3Dialog 统一访问器 - WORSHIP 子状态 =====
  describe('统一访问器 - WORSHIP 子状态', () => {
    test('WORSHIP 子状态返回崇拜式回应', () => {
      const dialog = getStep3Dialog(
        INTEREST_TYPES.DINOSAUR,
        '恐龙蛋',
        STEP3_SUB_STATES.WORSHIP
      );
      expect(dialog.mainLine).toContain('嗷呜——');
      expect(dialog.mainLine).toContain('恐龙蛋');
      expect(dialog).toHaveProperty('waitBeforeNextMs');
    });
  });

  // ===== 切片12: getStep3Dialog 统一访问器 - 画像问题子状态 =====
  describe('统一访问器 - 画像问题子状态', () => {
    test('ASK_NICKNAME 子状态返回昵称问题', () => {
      const dialog = getStep3Dialog(
        INTEREST_TYPES.DINOSAUR,
        '恐龙蛋',
        STEP3_SUB_STATES.ASK_NICKNAME
      );
      expect(dialog.field).toBe('nickname');
      expect(dialog.mainLine).toContain('你叫什么');
    });

    test('ASK_AGE 子状态返回年龄问题', () => {
      const dialog = getStep3Dialog(
        INTEREST_TYPES.GENERIC,
        '小白',
        STEP3_SUB_STATES.ASK_AGE
      );
      expect(dialog.field).toBe('age');
      expect(dialog.mainLine).toContain('几岁');
    });

    test('ASK_INTERESTS 子状态返回兴趣问题（dinosaur 嵌入恐龙）', () => {
      const dialog = getStep3Dialog(
        INTEREST_TYPES.DINOSAUR,
        '恐龙蛋',
        STEP3_SUB_STATES.ASK_INTERESTS
      );
      expect(dialog.field).toBe('interests');
      expect(dialog.mainLine).toContain('你还喜欢什么恐龙？');
    });

    test('ASK_INTERESTS 子状态返回兴趣问题（speed 嵌入赛车飞机）', () => {
      const dialog = getStep3Dialog(
        INTEREST_TYPES.SPEED,
        '闪电',
        STEP3_SUB_STATES.ASK_INTERESTS
      );
      expect(dialog.field).toBe('interests');
      expect(dialog.mainLine).toContain('你还喜欢什么？赛车？飞机？');
    });

    test('ASK_SKILLS 子状态返回技能问题', () => {
      const dialog = getStep3Dialog(
        INTEREST_TYPES.PRINCESS,
        '艾莎',
        STEP3_SUB_STATES.ASK_SKILLS
      );
      expect(dialog.field).toBe('selfClaimedSkills');
      expect(dialog.mainLine).toContain('最擅长');
    });

    test('COMPLETE 子状态返回 null', () => {
      const dialog = getStep3Dialog(
        INTEREST_TYPES.GENERIC,
        '小白',
        STEP3_SUB_STATES.COMPLETE
      );
      expect(dialog).toBeNull();
    });

    test('未知子状态返回 null', () => {
      const dialog = getStep3Dialog(
        INTEREST_TYPES.GENERIC,
        '小白',
        'UNKNOWN_SUBSTATE'
      );
      expect(dialog).toBeNull();
    });
  });
});
