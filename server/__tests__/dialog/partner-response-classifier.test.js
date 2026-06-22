/**
 * 搭档反应分类器测试 - Issue #5 搭档确认流程
 *
 * 参考技术架构文档§「搭档确认」
 * 参考PRD §4.1 步骤5 搭档确认
 *
 * 职责：
 *   1. 将孩子对搭档邀请的反应分类为三种：accept / hesitate / refuse
 *   2. 返回分类结果（含匹配关键词与置信度），供编排器决定下一步策略
 */
const {
  classifyPartnerResponse,
  RESPONSE_TYPES
} = require('../../src/dialog/partner-response-classifier');

describe('搭档反应分类器 - Issue #5 搭档确认流程', () => {
  describe('classifyPartnerResponse - accept 分类（愿意）', () => {
    test('"愿意" → accept', () => {
      const result = classifyPartnerResponse('愿意');
      expect(result.type).toBe(RESPONSE_TYPES.ACCEPT);
      expect(result.matchedKeyword).toBe('愿意');
    });

    test('"好" → accept', () => {
      const result = classifyPartnerResponse('好');
      expect(result.type).toBe(RESPONSE_TYPES.ACCEPT);
      expect(result.matchedKeyword).toBe('好');
    });

    test('"可以" → accept', () => {
      const result = classifyPartnerResponse('可以');
      expect(result.type).toBe(RESPONSE_TYPES.ACCEPT);
      expect(result.matchedKeyword).toBe('可以');
    });

    test('"没问题" → accept', () => {
      const result = classifyPartnerResponse('没问题');
      expect(result.type).toBe(RESPONSE_TYPES.ACCEPT);
      expect(result.matchedKeyword).toBe('没问题');
    });

    test('"我想" → accept', () => {
      const result = classifyPartnerResponse('我想');
      expect(result.type).toBe(RESPONSE_TYPES.ACCEPT);
      expect(result.matchedKeyword).toBe('我想');
    });

    test('"当你的搭档" → accept', () => {
      const result = classifyPartnerResponse('当你的搭档');
      expect(result.type).toBe(RESPONSE_TYPES.ACCEPT);
      expect(result.matchedKeyword).toBe('当你的搭档');
    });

    test('"好啊" → accept', () => {
      const result = classifyPartnerResponse('好啊');
      expect(result.type).toBe(RESPONSE_TYPES.ACCEPT);
      expect(result.matchedKeyword).toBe('好啊');
    });
  });

  describe('classifyPartnerResponse - refuse 分类（明确拒绝）', () => {
    test('"不要" → refuse', () => {
      const result = classifyPartnerResponse('不要');
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.matchedKeyword).toBe('不要');
    });

    test('"不愿意" → refuse', () => {
      const result = classifyPartnerResponse('不愿意');
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.matchedKeyword).toBe('不愿意');
    });

    test('"不想" → refuse', () => {
      const result = classifyPartnerResponse('不想');
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.matchedKeyword).toBe('不想');
    });

    test('"别" → refuse', () => {
      const result = classifyPartnerResponse('别');
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.matchedKeyword).toBe('别');
    });

    test('"算了" → refuse', () => {
      const result = classifyPartnerResponse('算了');
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.matchedKeyword).toBe('算了');
    });
  });

  describe('classifyPartnerResponse - hesitate 分类（犹豫）', () => {
    test('"嗯" → hesitate', () => {
      const result = classifyPartnerResponse('嗯');
      expect(result.type).toBe(RESPONSE_TYPES.HESITATE);
      expect(result.matchedKeyword).toBe('嗯');
    });

    test('"让我想想" → hesitate', () => {
      const result = classifyPartnerResponse('让我想想');
      expect(result.type).toBe(RESPONSE_TYPES.HESITATE);
      expect(result.matchedKeyword).toBe('让我想想');
    });

    test('"不确定" → hesitate', () => {
      const result = classifyPartnerResponse('不确定');
      expect(result.type).toBe(RESPONSE_TYPES.HESITATE);
      expect(result.matchedKeyword).toBe('不确定');
    });

    test('"再想想" → hesitate', () => {
      const result = classifyPartnerResponse('再想想');
      expect(result.type).toBe(RESPONSE_TYPES.HESITATE);
      expect(result.matchedKeyword).toBe('再想想');
    });

    test('"可能" → hesitate', () => {
      const result = classifyPartnerResponse('可能');
      expect(result.type).toBe(RESPONSE_TYPES.HESITATE);
      expect(result.matchedKeyword).toBe('可能');
    });

    test('"也许" → hesitate', () => {
      const result = classifyPartnerResponse('也许');
      expect(result.type).toBe(RESPONSE_TYPES.HESITATE);
      expect(result.matchedKeyword).toBe('也许');
    });
  });

  describe('classifyPartnerResponse - 优先级 accept > refuse > hesitate', () => {
    test('同时含 accept 与 hesitate 关键词 → accept 优先', () => {
      // "愿意" 是 accept，"嗯" 是 hesitate
      const result = classifyPartnerResponse('嗯，我愿意');
      expect(result.type).toBe(RESPONSE_TYPES.ACCEPT);
      expect(result.matchedKeyword).toBe('愿意');
    });

    test('同时含 refuse 与 hesitate 关键词 → refuse 优先于 hesitate', () => {
      // "不要" 是 refuse，"可能" 是 hesitate
      const result = classifyPartnerResponse('可能不要吧');
      expect(result.type).toBe(RESPONSE_TYPES.REFUSE);
      expect(result.matchedKeyword).toBe('不要');
    });

    test('同时含 accept 与 refuse 关键词 → accept 优先于 refuse', () => {
      // "愿意" 是 accept，"不要" 是 refuse
      // 注意：此处验证 accept 优先级最高
      const result = classifyPartnerResponse('我愿意，不要误会');
      expect(result.type).toBe(RESPONSE_TYPES.ACCEPT);
    });
  });

  describe('classifyPartnerResponse - 默认回退', () => {
    test('无法识别的反应 → 保守返回 hesitate', () => {
      const result = classifyPartnerResponse('啊啊啊啊');
      expect(result.type).toBe(RESPONSE_TYPES.HESITATE);
      expect(result.matchedKeyword).toBeNull();
    });

    test('无意义文本 → hesitate 回退', () => {
      const result = classifyPartnerResponse('啦啦啦');
      expect(result.type).toBe(RESPONSE_TYPES.HESITATE);
      expect(result.matchedKeyword).toBeNull();
    });
  });

  describe('classifyPartnerResponse - 边界情况', () => {
    test('空字符串 → hesitate 回退', () => {
      const result = classifyPartnerResponse('');
      expect(result.type).toBe(RESPONSE_TYPES.HESITATE);
      expect(result.matchedKeyword).toBeNull();
    });

    test('null responseText → hesitate 回退', () => {
      const result = classifyPartnerResponse(null);
      expect(result.type).toBe(RESPONSE_TYPES.HESITATE);
      expect(result.matchedKeyword).toBeNull();
    });

    test('undefined responseText → hesitate 回退', () => {
      const result = classifyPartnerResponse(undefined);
      expect(result.type).toBe(RESPONSE_TYPES.HESITATE);
      expect(result.matchedKeyword).toBeNull();
    });

    test('含空格的反应 → 去除空格后正确分类', () => {
      const result = classifyPartnerResponse('  愿意  ');
      expect(result.type).toBe(RESPONSE_TYPES.ACCEPT);
      expect(result.matchedKeyword).toBe('愿意');
    });
  });

  describe('classifyPartnerResponse - confidence 值范围验证', () => {
    test('accept confidence 在 0.8-1.0', () => {
      const result = classifyPartnerResponse('愿意');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    test('refuse confidence 在 0.8-1.0', () => {
      const result = classifyPartnerResponse('不要');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    test('hesitate（犹豫词命中）confidence 在 0.7-0.9', () => {
      const result = classifyPartnerResponse('让我想想');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.confidence).toBeLessThanOrEqual(0.9);
    });

    test('默认回退 confidence 在 0-0.7（保守低置信度）', () => {
      const result = classifyPartnerResponse('啊啊啊啊');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(0.7);
    });
  });

  describe('classifyPartnerResponse - 返回结构完整性', () => {
    test('返回对象包含所有必需字段', () => {
      const result = classifyPartnerResponse('愿意');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('matchedKeyword');
    });

    test('type 字段为合法值', () => {
      const validTypes = ['accept', 'hesitate', 'refuse'];
      const result = classifyPartnerResponse('愿意');
      expect(validTypes).toContain(result.type);
    });

    test('confidence 字段为数字', () => {
      const result = classifyPartnerResponse('愿意');
      expect(typeof result.confidence).toBe('number');
    });
  });

  describe('RESPONSE_TYPES 常量', () => {
    test('包含 3 种反应类型', () => {
      expect(RESPONSE_TYPES.ACCEPT).toBe('accept');
      expect(RESPONSE_TYPES.HESITATE).toBe('hesitate');
      expect(RESPONSE_TYPES.REFUSE).toBe('refuse');
    });
  });
});
