const {
  classifyChildResponse,
  RESPONSE_TYPES
} = require('../../src/dialog/child-response-classifier');

describe('儿童反应分类器 - Issue #4 费曼学习法首次触发', () => {
  describe('classifyChildResponse - correct 分类（念对了）', () => {
    test('孩子说出目标生字「龙」→ correct', () => {
      const result = classifyChildResponse('龙', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.CORRECT);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
      expect(result.matchedKeyword).toBe('龙');
    });

    test('「是龙」含目标生字 → correct', () => {
      const result = classifyChildResponse('是龙', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.CORRECT);
      expect(result.matchedKeyword).toBe('龙');
    });

    test('肯定词「对」→ correct（无目标生字）', () => {
      const result = classifyChildResponse('对', '闪');
      expect(result.type).toBe(RESPONSE_TYPES.CORRECT);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.matchedKeyword).toBe('对');
    });

    test('肯定词「是」→ correct', () => {
      const result = classifyChildResponse('是', '闪');
      expect(result.type).toBe(RESPONSE_TYPES.CORRECT);
      expect(result.matchedKeyword).toBe('是');
    });

    test('肯定词「念对了」→ correct', () => {
      const result = classifyChildResponse('念对了', '闪');
      expect(result.type).toBe(RESPONSE_TYPES.CORRECT);
      expect(result.matchedKeyword).toBe('念对了');
    });

    test('肯定词「我会」→ correct', () => {
      const result = classifyChildResponse('我会', '闪');
      expect(result.type).toBe(RESPONSE_TYPES.CORRECT);
      expect(result.matchedKeyword).toBe('我会');
    });
  });

  describe('classifyChildResponse - unsure 分类（不确定）', () => {
    test('「不知道」→ unsure', () => {
      const result = classifyChildResponse('不知道', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.confidence).toBeLessThanOrEqual(0.9);
      expect(result.matchedKeyword).toBe('不知道');
    });

    test('「不会」→ unsure', () => {
      const result = classifyChildResponse('不会', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.matchedKeyword).toBe('不会');
    });

    test('「不懂」→ unsure', () => {
      const result = classifyChildResponse('不懂', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.matchedKeyword).toBe('不懂');
    });

    test('「不确定」→ unsure', () => {
      const result = classifyChildResponse('不确定', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.matchedKeyword).toBe('不确定');
    });

    test('「想不起来」→ unsure', () => {
      const result = classifyChildResponse('想不起来', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.matchedKeyword).toBe('想不起来');
    });
  });

  describe('classifyChildResponse - refuse 分类（明确拒绝）', () => {
    test('「不要」→ refuse', () => {
      const result = classifyChildResponse('不要', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
      expect(result.matchedKeyword).toBe('不要');
    });

    test('「不想」→ refuse', () => {
      const result = classifyChildResponse('不想', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.matchedKeyword).toBe('不想');
    });

    test('「不想教」→ refuse', () => {
      const result = classifyChildResponse('不想教', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.matchedKeyword).toBe('不想教');
    });

    test('「别让我」→ refuse', () => {
      const result = classifyChildResponse('别让我', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.matchedKeyword).toBe('别让我');
    });

    test('「不愿意」→ refuse', () => {
      const result = classifyChildResponse('不愿意', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.matchedKeyword).toBe('不愿意');
    });
  });

  describe('classifyChildResponse - 默认回退', () => {
    test('无法识别的反应 → 保守返回 unsure', () => {
      const result = classifyChildResponse('嗯嗯啊啊', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.matchedKeyword).toBeNull();
    });

    test('无意义文本 → unsure 回退', () => {
      const result = classifyChildResponse('啊啊啊', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.matchedKeyword).toBeNull();
    });
  });

  describe('classifyChildResponse - targetCharacter 为 null', () => {
    test('targetCharacter=null 时，肯定词仍可识别为 correct', () => {
      const result = classifyChildResponse('对', null);
      expect(result.type).toBe(RESPONSE_TYPES.CORRECT);
      expect(result.matchedKeyword).toBe('对');
    });

    test('targetCharacter=null 时，不确定词仍可识别为 unsure', () => {
      const result = classifyChildResponse('不知道', null);
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.matchedKeyword).toBe('不知道');
    });

    test('targetCharacter=null 时，拒绝词仍可识别为 refuse', () => {
      const result = classifyChildResponse('不要', null);
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.matchedKeyword).toBe('不要');
    });

    test('targetCharacter=null 时，无法识别 → unsure 回退', () => {
      const result = classifyChildResponse('嗯嗯', null);
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.matchedKeyword).toBeNull();
    });
  });

  describe('classifyChildResponse - 边界情况', () => {
    test('空字符串 → unsure 回退', () => {
      const result = classifyChildResponse('', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.matchedKeyword).toBeNull();
    });

    test('null responseText → unsure 回退', () => {
      const result = classifyChildResponse(null, '龙');
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.matchedKeyword).toBeNull();
    });

    test('undefined responseText → unsure 回退', () => {
      const result = classifyChildResponse(undefined, '龙');
      expect(result.type).toBe(RESPONSE_TYPES.UNSURE);
      expect(result.matchedKeyword).toBeNull();
    });

    test('含空格的反应 → 去除空格后正确分类', () => {
      const result = classifyChildResponse('  龙  ', '龙');
      expect(result.type).toBe(RESPONSE_TYPES.CORRECT);
      expect(result.matchedKeyword).toBe('龙');
    });
  });

  describe('classifyChildResponse - confidence 值范围验证', () => {
    test('correct（目标生字命中）confidence 在 0.8-1.0', () => {
      const result = classifyChildResponse('龙', '龙');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    test('correct（肯定词命中）confidence 在 0.8-1.0', () => {
      const result = classifyChildResponse('对', '闪');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    test('unsure（不确定词命中）confidence 在 0.7-0.9', () => {
      const result = classifyChildResponse('不知道', '龙');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.confidence).toBeLessThanOrEqual(0.9);
    });

    test('refuse confidence 在 0.8-1.0', () => {
      const result = classifyChildResponse('不要', '龙');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    test('默认回退 confidence 在 0-0.7（保守低置信度）', () => {
      const result = classifyChildResponse('嗯嗯啊啊', '龙');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(0.7);
    });
  });

  describe('classifyChildResponse - 返回结构完整性', () => {
    test('返回对象包含所有必需字段', () => {
      const result = classifyChildResponse('龙', '龙');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('matchedKeyword');
    });

    test('type 字段为合法值', () => {
      const validTypes = ['correct', 'unsure', 'refuse'];
      const result = classifyChildResponse('龙', '龙');
      expect(validTypes).toContain(result.type);
    });

    test('confidence 字段为数字', () => {
      const result = classifyChildResponse('龙', '龙');
      expect(typeof result.confidence).toBe('number');
    });
  });

  describe('RESPONSE_TYPES 常量', () => {
    test('包含 3 种反应类型', () => {
      expect(RESPONSE_TYPES.CORRECT).toBe('correct');
      expect(RESPONSE_TYPES.UNSURE).toBe('unsure');
      expect(RESPONSE_TYPES.REFUSE).toBe('refuse');
    });
  });
});
