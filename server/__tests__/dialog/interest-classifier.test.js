const {
  classifyInterest,
  getInterestLabel,
  getInterestSound,
  INTEREST_TYPES
} = require('../../src/dialog/interest-classifier');

describe('兴趣分型引擎 - Issue #3 台词分型核心', () => {
  describe('classifyInterest - 名字→兴趣关键词提取', () => {
    test('「恐龙蛋」→ dinosaur 分型', () => {
      const result = classifyInterest('恐龙蛋');
      expect(result.type).toBe(INTEREST_TYPES.DINOSAUR);
      expect(result.isClassified).toBe(true);
      expect(result.foxName).toBe('恐龙蛋');
      expect(result.keywords.length).toBeGreaterThan(0);
      expect(result.matchedTerms.length).toBeGreaterThan(0);
    });

    test('「霸王龙」→ dinosaur 分型', () => {
      const result = classifyInterest('霸王龙');
      expect(result.type).toBe(INTEREST_TYPES.DINOSAUR);
      expect(result.isClassified).toBe(true);
    });

    test('「小恐龙」→ dinosaur 分型', () => {
      const result = classifyInterest('小恐龙');
      expect(result.type).toBe(INTEREST_TYPES.DINOSAUR);
      expect(result.isClassified).toBe(true);
    });

    test('「艾莎」→ princess 分型', () => {
      const result = classifyInterest('艾莎');
      expect(result.type).toBe(INTEREST_TYPES.PRINCESS);
      expect(result.isClassified).toBe(true);
      expect(result.foxName).toBe('艾莎');
    });

    test('「小公主」→ princess 分型', () => {
      const result = classifyInterest('小公主');
      expect(result.type).toBe(INTEREST_TYPES.PRINCESS);
      expect(result.isClassified).toBe(true);
    });

    test('「魔法仙子」→ princess 分型', () => {
      const result = classifyInterest('魔法仙子');
      expect(result.type).toBe(INTEREST_TYPES.PRINCESS);
      expect(result.isClassified).toBe(true);
    });

    test('「闪电」→ speed 分型', () => {
      const result = classifyInterest('闪电');
      expect(result.type).toBe(INTEREST_TYPES.SPEED);
      expect(result.isClassified).toBe(true);
      expect(result.foxName).toBe('闪电');
    });

    test('「小赛车」→ speed 分型', () => {
      const result = classifyInterest('小赛车');
      expect(result.type).toBe(INTEREST_TYPES.SPEED);
      expect(result.isClassified).toBe(true);
    });

    test('「火箭侠」→ speed 分型', () => {
      const result = classifyInterest('火箭侠');
      expect(result.type).toBe(INTEREST_TYPES.SPEED);
      expect(result.isClassified).toBe(true);
    });

    test('「小白」→ generic 分型（无法判断）', () => {
      const result = classifyInterest('小白');
      expect(result.type).toBe(INTEREST_TYPES.GENERIC);
      expect(result.isClassified).toBe(false);
      expect(result.keywords).toEqual([]);
      expect(result.matchedTerms).toEqual([]);
    });

    test('「豆豆」→ generic 分型（无法判断）', () => {
      const result = classifyInterest('豆豆');
      expect(result.type).toBe(INTEREST_TYPES.GENERIC);
      expect(result.isClassified).toBe(false);
    });

    test('「星星」→ generic 分型', () => {
      const result = classifyInterest('星星');
      expect(result.type).toBe(INTEREST_TYPES.GENERIC);
      expect(result.isClassified).toBe(false);
    });
  });

  describe('classifyInterest - 边界情况', () => {
    test('空字符串 → generic 分型', () => {
      const result = classifyInterest('');
      expect(result.type).toBe(INTEREST_TYPES.GENERIC);
      expect(result.isClassified).toBe(false);
      expect(result.foxName).toBe('');
    });

    test('null → generic 分型', () => {
      const result = classifyInterest(null);
      expect(result.type).toBe(INTEREST_TYPES.GENERIC);
      expect(result.isClassified).toBe(false);
    });

    test('undefined → generic 分型', () => {
      const result = classifyInterest(undefined);
      expect(result.type).toBe(INTEREST_TYPES.GENERIC);
      expect(result.isClassified).toBe(false);
    });

    test('名字含空格 → 正确去除空格后分类', () => {
      const result = classifyInterest('  恐龙蛋  ');
      expect(result.type).toBe(INTEREST_TYPES.DINOSAUR);
      expect(result.foxName).toBe('恐龙蛋');
    });
  });

  describe('classifyInterest - 长关键词优先匹配', () => {
    test('「霸王龙」匹配「霸王龙」而非仅「龙」', () => {
      const result = classifyInterest('霸王龙');
      expect(result.type).toBe(INTEREST_TYPES.DINOSAUR);
      // 应该匹配到霸王龙这个长关键词
      expect(result.keywords).toContain('霸王龙');
    });

    test('「三角龙」匹配「三角龙」', () => {
      const result = classifyInterest('三角龙');
      expect(result.type).toBe(INTEREST_TYPES.DINOSAUR);
      expect(result.keywords).toContain('三角龙');
    });
  });

  describe('classifyInterest - 返回结构完整性', () => {
    test('返回对象包含所有必需字段', () => {
      const result = classifyInterest('恐龙蛋');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('keywords');
      expect(result).toHaveProperty('matchedTerms');
      expect(result).toHaveProperty('foxName');
      expect(result).toHaveProperty('isClassified');
    });

    test('keywords 和 matchedTerms 是数组', () => {
      const result = classifyInterest('闪电');
      expect(Array.isArray(result.keywords)).toBe(true);
      expect(Array.isArray(result.matchedTerms)).toBe(true);
    });
  });

  describe('getInterestLabel - 兴趣分型中文标签', () => {
    test('dinosaur → 恐龙', () => {
      expect(getInterestLabel(INTEREST_TYPES.DINOSAUR)).toBe('恐龙');
    });

    test('princess → 魔法', () => {
      expect(getInterestLabel(INTEREST_TYPES.PRINCESS)).toBe('魔法');
    });

    test('speed → 赛车', () => {
      expect(getInterestLabel(INTEREST_TYPES.SPEED)).toBe('赛车');
    });

    test('generic → 小伙伴', () => {
      expect(getInterestLabel(INTEREST_TYPES.GENERIC)).toBe('小伙伴');
    });

    test('未知类型 → 回退到小伙伴', () => {
      expect(getInterestLabel('unknown')).toBe('小伙伴');
    });
  });

  describe('getInterestSound - 兴趣分型语气词/动作音效', () => {
    test('dinosaur → 嗷呜——', () => {
      expect(getInterestSound(INTEREST_TYPES.DINOSAUR)).toBe('嗷呜——');
    });

    test('princess → 叮——', () => {
      expect(getInterestSound(INTEREST_TYPES.PRINCESS)).toBe('叮——');
    });

    test('speed → 嗖——', () => {
      expect(getInterestSound(INTEREST_TYPES.SPEED)).toBe('嗖——');
    });

    test('generic → 空字符串', () => {
      expect(getInterestSound(INTEREST_TYPES.GENERIC)).toBe('');
    });

    test('未知类型 → 空字符串', () => {
      expect(getInterestSound('unknown')).toBe('');
    });
  });

  describe('INTEREST_TYPES 常量', () => {
    test('包含 4 种分型', () => {
      expect(INTEREST_TYPES.DINOSAUR).toBe('dinosaur');
      expect(INTEREST_TYPES.PRINCESS).toBe('princess');
      expect(INTEREST_TYPES.SPEED).toBe('speed');
      expect(INTEREST_TYPES.GENERIC).toBe('generic');
    });
  });
});
