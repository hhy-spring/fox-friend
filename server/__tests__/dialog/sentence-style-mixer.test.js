/**
 * 句式风格混用器测试 - Issue #8 每日拼音教学
 *
 * 参考PRD §4.5.3 句式混用：
 *   句式按 30/25/25/20 比例混用请求式/情报式/好奇式/挑战式
 *   （非严格约束，由 AI 动态调整）
 */

const {
  SENTENCE_STYLES,
  createSentenceStyleMixer
} = require('../../src/dialog/sentence-style-mixer');

describe('SentenceStyleMixer - 句式风格混用器', () => {
  describe('SENTENCE_STYLES 常量', () => {
    test('应定义4个句式风格常量', () => {
      expect(SENTENCE_STYLES).toHaveProperty('REQUEST');
      expect(SENTENCE_STYLES).toHaveProperty('INTEL');
      expect(SENTENCE_STYLES).toHaveProperty('CURIOUS');
      expect(SENTENCE_STYLES).toHaveProperty('CHALLENGE');
      expect(Object.keys(SENTENCE_STYLES)).toHaveLength(4);
    });

    test('句式风格常量值应为小写字符串', () => {
      expect(SENTENCE_STYLES.REQUEST).toBe('request');
      expect(SENTENCE_STYLES.INTEL).toBe('intel');
      expect(SENTENCE_STYLES.CURIOUS).toBe('curious');
      expect(SENTENCE_STYLES.CHALLENGE).toBe('challenge');
    });
  });

  describe('getTargetRatio - 目标比例', () => {
    test('应返回 30/25/25/20 的目标比例', () => {
      const mixer = createSentenceStyleMixer();
      const ratio = mixer.getTargetRatio();
      expect(ratio.request).toBe(0.3);
      expect(ratio.intel).toBe(0.25);
      expect(ratio.curious).toBe(0.25);
      expect(ratio.challenge).toBe(0.2);
    });
  });

  describe('selectStyle - 选择句式风格', () => {
    test('应返回4种有效风格之一', () => {
      const mixer = createSentenceStyleMixer();
      const validStyles = [
        SENTENCE_STYLES.REQUEST,
        SENTENCE_STYLES.INTEL,
        SENTENCE_STYLES.CURIOUS,
        SENTENCE_STYLES.CHALLENGE
      ];
      // 多次调用确保返回值始终有效
      for (let i = 0; i < 20; i += 1) {
        const style = mixer.selectStyle({ vowel: 'a', round: 1 });
        expect(validStyles).toContain(style);
      }
    });
  });

  describe('getStyleHistory - 历史记录', () => {
    test('初始时历史记录应为空数组', () => {
      const mixer = createSentenceStyleMixer();
      expect(mixer.getStyleHistory()).toEqual([]);
    });

    test('调用 selectStyle 后历史记录应增长', () => {
      const mixer = createSentenceStyleMixer();
      mixer.selectStyle({ vowel: 'a', round: 1 });
      mixer.selectStyle({ vowel: 'a', round: 1 });
      mixer.selectStyle({ vowel: 'a', round: 1 });
      const history = mixer.getStyleHistory();
      expect(history).toHaveLength(3);
      // 历史记录顺序应与调用顺序一致
      expect(Array.isArray(history)).toBe(true);
      history.forEach(style => {
        expect([
          SENTENCE_STYLES.REQUEST,
          SENTENCE_STYLES.INTEL,
          SENTENCE_STYLES.CURIOUS,
          SENTENCE_STYLES.CHALLENGE
        ]).toContain(style);
      });
    });
  });

  describe('getStyleDistribution - 分布统计', () => {
    test('初始时各风格计数应为0', () => {
      const mixer = createSentenceStyleMixer();
      const dist = mixer.getStyleDistribution();
      expect(dist).toEqual({
        request: 0,
        intel: 0,
        curious: 0,
        challenge: 0
      });
    });

    test('分布统计计数应与历史记录一致', () => {
      const mixer = createSentenceStyleMixer();
      // 调用50次以获得稳定统计
      for (let i = 0; i < 50; i += 1) {
        mixer.selectStyle({ vowel: 'a', round: 1 });
      }
      const dist = mixer.getStyleDistribution();
      const history = mixer.getStyleHistory();
      // 各风格计数之和应等于历史记录长度
      const total = dist.request + dist.intel + dist.curious + dist.challenge;
      expect(total).toBe(history.length);
      expect(total).toBe(50);
      // 手动统计历史记录，与分布对比
      const manualCount = { request: 0, intel: 0, curious: 0, challenge: 0 };
      history.forEach(s => { manualCount[s] += 1; });
      expect(dist).toEqual(manualCount);
    });
  });

  describe('连续重复规避', () => {
    test('不应出现同一风格连续3次及以上的情况', () => {
      const mixer = createSentenceStyleMixer();
      // 调用100次，扫描历史记录验证无3连
      for (let i = 0; i < 100; i += 1) {
        mixer.selectStyle({ vowel: 'a', round: 1 });
      }
      const history = mixer.getStyleHistory();
      for (let i = 2; i < history.length; i += 1) {
        const hasThreeConsecutive =
          history[i] === history[i - 1] && history[i - 1] === history[i - 2];
        expect(hasThreeConsecutive).toBe(false);
      }
    });
  });

  describe('孩子状态动态调整', () => {
    test('childState 为 low 时不应返回 challenge 风格', () => {
      const mixer = createSentenceStyleMixer();
      // 运行20次，断言无 challenge
      for (let i = 0; i < 20; i += 1) {
        const style = mixer.selectStyle({
          vowel: 'a',
          round: 1,
          childState: 'low'
        });
        expect(style).not.toBe(SENTENCE_STYLES.CHALLENGE);
      }
    });
  });

  describe('generateLine - 生成对话台词', () => {
    test("request 风格生成包含元音 a 的非空台词", () => {
      const mixer = createSentenceStyleMixer();
      const line = mixer.generateLine(SENTENCE_STYLES.REQUEST, { vowel: 'a' });
      expect(typeof line).toBe('string');
      expect(line.length).toBeGreaterThan(0);
      // 台词应包含元音或教学内容
      expect(line).toMatch(/a/);
    });

    test('4种风格均应返回非空字符串', () => {
      const mixer = createSentenceStyleMixer();
      const styles = [
        SENTENCE_STYLES.REQUEST,
        SENTENCE_STYLES.INTEL,
        SENTENCE_STYLES.CURIOUS,
        SENTENCE_STYLES.CHALLENGE
      ];
      styles.forEach(style => {
        const line = mixer.generateLine(style, { vowel: 'a' });
        expect(typeof line).toBe('string');
        expect(line.length).toBeGreaterThan(0);
      });
    });
  });

  describe('reset - 重置状态', () => {
    test('reset 后历史记录与分布均应清空', () => {
      const mixer = createSentenceStyleMixer();
      // 先产生若干历史
      for (let i = 0; i < 10; i += 1) {
        mixer.selectStyle({ vowel: 'a', round: 1 });
      }
      expect(mixer.getStyleHistory().length).toBe(10);
      // 执行重置
      mixer.reset();
      // 历史记录应清空
      expect(mixer.getStyleHistory()).toEqual([]);
      // 分布应全部归零
      expect(mixer.getStyleDistribution()).toEqual({
        request: 0,
        intel: 0,
        curious: 0,
        challenge: 0
      });
    });
  });
});
