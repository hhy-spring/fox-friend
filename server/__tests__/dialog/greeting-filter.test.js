/**
 * 问候语过滤器测试 - Issue #17
 *
 * TDD 测试用例：验证问候语不会被误识别为名字
 *
 * 多智能体协作测试维度：
 *   1. GreetingPatternAgent：问候语模式覆盖测试
 *   2. GreetingFilterAgent：过滤逻辑准确性测试
 *   3. IntegrationAgent：与 name-processor 集成测试
 *   4. RegressionAgent：回归测试（确保合法名字不受影响）
 */

const {
  isGreeting,
  getGreetingPatterns,
  GREETING_PATTERNS
} = require('../../src/dialog/greeting-filter');
const {
  isNameProvided,
  extractName,
  processChildInput
} = require('../../src/dialog/name-processor');

describe('Issue #17: 问候语过滤器', () => {
  describe('GreetingPatternAgent - 问候语模式识别', () => {
    test('孩子说"你好" → 识别为问候语', () => {
      expect(isGreeting('你好')).toBe(true);
    });

    test('孩子说"嗨" → 识别为问候语', () => {
      expect(isGreeting('嗨')).toBe(true);
    });

    test('孩子说"哈喽" → 识别为问候语', () => {
      expect(isGreeting('哈喽')).toBe(true);
    });

    test('孩子说"早上好" → 识别为问候语', () => {
      expect(isGreeting('早上好')).toBe(true);
    });

    test('孩子说"嗯" → 识别为问候语（单字语气词）', () => {
      expect(isGreeting('嗯')).toBe(true);
    });

    test('孩子说"嗯嗯" → 识别为问候语（叠词）', () => {
      expect(isGreeting('嗯嗯')).toBe(true);
    });

    test('孩子说"嗯嗯嗯" → 识别为问候语（三叠词）', () => {
      expect(isGreeting('嗯嗯嗯')).toBe(true);
    });

    test('孩子说"你好。" → 识别为问候语（带句号）', () => {
      expect(isGreeting('你好。')).toBe(true);
    });

    test('孩子说"你好！" → 识别为问候语（带标点）', () => {
      expect(isGreeting('你好！')).toBe(true);
    });

    test('孩子说"在吗" → 识别为问候语', () => {
      expect(isGreeting('在吗')).toBe(true);
    });

    test('孩子说"恐龙蛋" → 不是问候语（合法名字）', () => {
      expect(isGreeting('恐龙蛋')).toBe(false);
    });

    test('孩子说"闪电" → 不是问候语（合法名字）', () => {
      expect(isGreeting('闪电')).toBe(false);
    });

    test('孩子说"带龙的" → 不是问候语（暗示选择）', () => {
      expect(isGreeting('带龙的')).toBe(false);
    });

    test('空内容 → 不是问候语', () => {
      expect(isGreeting('')).toBe(false);
    });

    test('null → 不是问候语', () => {
      expect(isGreeting(null)).toBe(false);
    });
  });

  describe('GreetingFilterAgent - 问候语模式库完整性', () => {
    test('问候语模式库不为空', () => {
      expect(GREETING_PATTERNS.length).toBeGreaterThan(0);
    });

    test('问候语模式库包含基础问候', () => {
      expect(GREETING_PATTERNS).toContain('你好');
      expect(GREETING_PATTERNS).toContain('嗨');
      expect(GREETING_PATTERNS).toContain('哈喽');
    });

    test('getGreetingPatterns 返回副本（不泄露内部引用）', () => {
      const patterns = getGreetingPatterns();
      const originalLength = patterns.length;
      patterns.push('测试');
      expect(getGreetingPatterns().length).toBe(originalLength);
    });
  });

  describe('IntegrationAgent - 与 name-processor 集成（核心修复）', () => {
    test('孩子说"你好" → 不识别为名字（Issue #17 核心修复）', () => {
      expect(isNameProvided('你好')).toBe(false);
    });

    test('孩子说"嗨" → 不识别为名字', () => {
      expect(isNameProvided('嗨')).toBe(false);
    });

    test('孩子说"哈喽" → 不识别为名字', () => {
      expect(isNameProvided('哈喽')).toBe(false);
    });

    test('孩子说"嗯" → 不识别为名字', () => {
      expect(isNameProvided('嗯')).toBe(false);
    });

    test('孩子说"嗯嗯" → 不识别为名字', () => {
      expect(isNameProvided('嗯嗯')).toBe(false);
    });

    test('孩子说"早上好" → 不识别为名字', () => {
      expect(isNameProvided('早上好')).toBe(false);
    });

    test('孩子说"在吗" → 不识别为名字', () => {
      expect(isNameProvided('在吗')).toBe(false);
    });
  });

  describe('RegressionAgent - 回归测试（合法名字不受影响）', () => {
    test('孩子说"恐龙蛋" → 仍识别为名字', () => {
      expect(isNameProvided('恐龙蛋')).toBe(true);
    });

    test('孩子说"闪电" → 仍识别为名字', () => {
      expect(isNameProvided('闪电')).toBe(true);
    });

    test('孩子说"我叫你闪电" → 仍识别为名字', () => {
      expect(isNameProvided('我叫你闪电')).toBe(true);
    });

    test('孩子说"带龙的" → 仍识别为名字（暗示选择）', () => {
      expect(isNameProvided('带龙的')).toBe(true);
    });

    test('孩子说"不知道" → 仍不识别为名字', () => {
      expect(isNameProvided('不知道')).toBe(false);
    });

    test('extractName("恐龙蛋") → 仍返回正确名字', () => {
      const result = extractName('恐龙蛋');
      expect(result.name).toBe('恐龙蛋');
      expect(result.source).toBe('child_choice');
    });

    test('extractName("你好") → 返回 null（不提取问候语）', () => {
      expect(extractName('你好')).toBe(null);
    });
  });

  describe('processChildInput 集成 - 问候语场景', () => {
    test('孩子说"你好" → 不记录名字，显示暗示', () => {
      const result = processChildInput({
        childContent: '你好',
        currentStep: 'HELP_REQUEST',
        fsm: { getState: () => 'HELP_REQUEST' }
      });
      expect(result.nameRecorded).toBe(false);
      expect(result.showHints).toBe(true);
    });

    test('孩子说"嗨" → 不记录名字，显示暗示', () => {
      const result = processChildInput({
        childContent: '嗨',
        currentStep: 'HELP_REQUEST',
        fsm: { getState: () => 'HELP_REQUEST' }
      });
      expect(result.nameRecorded).toBe(false);
      expect(result.showHints).toBe(true);
    });

    test('孩子说"哈喽" → 不记录名字，显示暗示', () => {
      const result = processChildInput({
        childContent: '哈喽',
        currentStep: 'HELP_REQUEST',
        fsm: { getState: () => 'HELP_REQUEST' }
      });
      expect(result.nameRecorded).toBe(false);
      expect(result.showHints).toBe(true);
    });

    test('孩子说"恐龙蛋" → 记录名字（合法名字不受影响）', () => {
      const result = processChildInput({
        childContent: '恐龙蛋',
        currentStep: 'HELP_REQUEST',
        fsm: { getState: () => 'HELP_REQUEST' }
      });
      expect(result.nameRecorded).toBe(true);
      expect(result.foxName).toBe('恐龙蛋');
    });
  });
});
