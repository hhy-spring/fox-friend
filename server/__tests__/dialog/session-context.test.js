const {
  createSessionContext
} = require('../../src/dialog/session-context');
const { INTEREST_TYPES } = require('../../src/dialog/interest-classifier');

describe('会话上下文管理器 - Issue #3 台词分型引擎', () => {
  describe('createSessionContext + setFoxName - 核心流程', () => {
    test('设置狐狸名字「恐龙蛋」后，getInterestType 返回 dinosaur 分型', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('恐龙蛋');
      expect(ctx.getInterestType()).toBe(INTEREST_TYPES.DINOSAUR);
    });
  });

  describe('getInterestKeywords - 获取匹配的兴趣关键词', () => {
    test('设置「恐龙蛋」后，getInterestKeywords 返回包含匹配关键词的数组', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('恐龙蛋');
      const keywords = ctx.getInterestKeywords();
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain('恐龙');
    });
  });

  describe('isClassified - 分型状态判断', () => {
    test('设置「恐龙蛋」后，isClassified 返回 true', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('恐龙蛋');
      expect(ctx.isClassified()).toBe(true);
    });

    test('设置「小白」后，isClassified 返回 false（generic 类型）', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('小白');
      expect(ctx.isClassified()).toBe(false);
      expect(ctx.getInterestType()).toBe(INTEREST_TYPES.GENERIC);
    });
  });

  describe('getInterestsDerivedFromFoxName - 画像字段生成', () => {
    test('设置「恐龙蛋」后，返回包含恐龙相关关键词的数组', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('恐龙蛋');
      const derived = ctx.getInterestsDerivedFromFoxName();
      expect(Array.isArray(derived)).toBe(true);
      expect(derived.length).toBeGreaterThan(0);
      expect(derived).toContain('恐龙');
    });

    test('设置「小白」后，返回空数组（generic 类型）', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('小白');
      const derived = ctx.getInterestsDerivedFromFoxName();
      expect(Array.isArray(derived)).toBe(true);
      expect(derived).toEqual([]);
    });

    test('设置「艾莎」后，返回包含魔法相关关键词的数组（princess 分型）', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('艾莎');
      expect(ctx.getInterestType()).toBe(INTEREST_TYPES.PRINCESS);
      const derived = ctx.getInterestsDerivedFromFoxName();
      expect(Array.isArray(derived)).toBe(true);
      expect(derived.length).toBeGreaterThan(0);
    });

    test('设置「闪电」后，返回包含速度相关关键词的数组（speed 分型）', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('闪电');
      expect(ctx.getInterestType()).toBe(INTEREST_TYPES.SPEED);
      const derived = ctx.getInterestsDerivedFromFoxName();
      expect(Array.isArray(derived)).toBe(true);
      expect(derived.length).toBeGreaterThan(0);
    });
  });

  describe('getClassificationResult - 获取完整分型结果', () => {
    test('设置「恐龙蛋」后，返回包含所有字段的完整分型结果', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('恐龙蛋');
      const result = ctx.getClassificationResult();
      expect(result).toHaveProperty('type', INTEREST_TYPES.DINOSAUR);
      expect(result).toHaveProperty('keywords');
      expect(result).toHaveProperty('matchedTerms');
      expect(result).toHaveProperty('foxName', '恐龙蛋');
      expect(result).toHaveProperty('isClassified', true);
    });
  });

  describe('toProfileField - 画像字段存储格式', () => {
    test('设置「恐龙蛋」后，返回可合并到 child_profile 的字段对象', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('恐龙蛋');
      const field = ctx.toProfileField();
      expect(field).toHaveProperty('interests_derived_from_fox_name');
      expect(Array.isArray(field.interests_derived_from_fox_name)).toBe(true);
      expect(field.interests_derived_from_fox_name.length).toBeGreaterThan(0);
    });

    test('设置「小白」后，字段对象中 interests_derived_from_fox_name 为空数组', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('小白');
      const field = ctx.toProfileField();
      expect(field).toHaveProperty('interests_derived_from_fox_name');
      expect(field.interests_derived_from_fox_name).toEqual([]);
    });

    test('字段对象可与已有画像数据合并', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('恐龙蛋');
      const existingProfile = { nickname: '小明', age: 5 };
      const merged = { ...existingProfile, ...ctx.toProfileField() };
      expect(merged).toHaveProperty('nickname', '小明');
      expect(merged).toHaveProperty('age', 5);
      expect(merged).toHaveProperty('interests_derived_from_fox_name');
    });
  });

  describe('toJSON - 可序列化的会话上下文', () => {
    test('设置「恐龙蛋」后，返回包含 childId 和分型数据的可序列化对象', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('恐龙蛋');
      const json = ctx.toJSON();
      expect(json).toHaveProperty('childId', 'child-001');
      expect(json).toHaveProperty('foxName', '恐龙蛋');
      expect(json).toHaveProperty('interestType', INTEREST_TYPES.DINOSAUR);
      expect(json).toHaveProperty('isClassified', true);
      expect(json).toHaveProperty('keywords');
      // 确保可被 JSON 序列化
      expect(() => JSON.stringify(json)).not.toThrow();
    });

    test('不同 childId 的会话上下文互不干扰', () => {
      const ctxA = createSessionContext('child-A');
      const ctxB = createSessionContext('child-B');
      ctxA.setFoxName('恐龙蛋');
      ctxB.setFoxName('小白');
      expect(ctxA.toJSON().childId).toBe('child-A');
      expect(ctxB.toJSON().childId).toBe('child-B');
      expect(ctxA.toJSON().interestType).toBe(INTEREST_TYPES.DINOSAUR);
      expect(ctxB.toJSON().interestType).toBe(INTEREST_TYPES.GENERIC);
    });
  });

  describe('分型结果持久化 - 后续教学会话可用', () => {
    test('设置名字后，多次调用各访问器返回一致的分类结果', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('恐龙蛋');

      // 多次调用各访问器，验证分类结果持久化
      const type1 = ctx.getInterestType();
      const type2 = ctx.getInterestType();
      const keywords1 = ctx.getInterestKeywords();
      const keywords2 = ctx.getInterestKeywords();
      const classified1 = ctx.isClassified();
      const classified2 = ctx.isClassified();

      expect(type1).toBe(type2);
      expect(keywords1).toEqual(keywords2);
      expect(classified1).toBe(classified2);
      expect(type1).toBe(INTEREST_TYPES.DINOSAUR);
      expect(classified1).toBe(true);
    });

    test('分类结果在 toProfileField 和 toJSON 中保持一致', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('闪电');

      const profileField = ctx.toProfileField();
      const json = ctx.toJSON();

      expect(profileField.interests_derived_from_fox_name).toEqual(json.keywords);
      expect(json.interestType).toBe(INTEREST_TYPES.SPEED);
    });
  });

  describe('边界情况处理', () => {
    test('设置空字符串名字 → generic 分型，isClassified 为 false', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName('');
      expect(ctx.getInterestType()).toBe(INTEREST_TYPES.GENERIC);
      expect(ctx.isClassified()).toBe(false);
      expect(ctx.getInterestKeywords()).toEqual([]);
      expect(ctx.getInterestsDerivedFromFoxName()).toEqual([]);
    });

    test('设置 null 名字 → generic 分型，isClassified 为 false', () => {
      const ctx = createSessionContext('child-001');
      ctx.setFoxName(null);
      expect(ctx.getInterestType()).toBe(INTEREST_TYPES.GENERIC);
      expect(ctx.isClassified()).toBe(false);
      expect(ctx.getInterestKeywords()).toEqual([]);
      expect(ctx.getInterestsDerivedFromFoxName()).toEqual([]);
    });

    test('未调用 setFoxName 前，各访问器返回安全默认值', () => {
      const ctx = createSessionContext('child-001');
      expect(ctx.getInterestType()).toBe(INTEREST_TYPES.GENERIC);
      expect(ctx.isClassified()).toBe(false);
      expect(ctx.getInterestKeywords()).toEqual([]);
      expect(ctx.getInterestsDerivedFromFoxName()).toEqual([]);
      expect(ctx.getClassificationResult()).toBeNull();
      const field = ctx.toProfileField();
      expect(field.interests_derived_from_fox_name).toEqual([]);
    });
  });
});
