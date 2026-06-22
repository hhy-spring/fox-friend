const {
  processChildInput,
  isNameProvided
} = require('../../src/dialog/name-processor');

describe('名字处理 - 孩子直接说名字', () => {
  describe('名字识别', () => {
    test('孩子说出名字 → 识别为名字输入', () => {
      const result = isNameProvided('我叫你闪电');
      expect(result).toBe(true);
    });

    test('孩子说出名字（简短）→ 识别为名字输入', () => {
      const result = isNameProvided('恐龙蛋');
      expect(result).toBe(true);
    });

    test('孩子说"不知道" → 不识别为名字', () => {
      const result = isNameProvided('不知道');
      expect(result).toBe(false);
    });

    test('空内容 → 不识别为名字', () => {
      const result = isNameProvided('');
      expect(result).toBe(false);
    });
  });

  describe('名字处理流程', () => {
    test('孩子直接说名字 → 跳过暗示，记录名字', () => {
      const result = processChildInput({
        childContent: '闪电',
        currentStep: 'HELP_REQUEST',
        fsm: { getState: () => 'HELP_REQUEST' }
      });
      expect(result.nameRecorded).toBe(true);
      expect(result.foxName).toBe('闪电');
      expect(result.skipHints).toBe(true);
      expect(result.nameSource).toBe('child_choice');
    });

    test('孩子通过暗示选名字 → 记录名字，来源为 fox_suggestion', () => {
      const result = processChildInput({
        childContent: '带龙的',
        currentStep: 'HELP_REQUEST',
        fsm: { getState: () => 'HELP_REQUEST' }
      });
      expect(result.nameRecorded).toBe(true);
      expect(result.foxName).toContain('龙');
      expect(result.skipHints).toBe(false);
      expect(result.nameSource).toBe('fox_suggestion');
    });

    test('孩子说"不知道" → 不记录名字，显示暗示', () => {
      const result = processChildInput({
        childContent: '不知道',
        currentStep: 'HELP_REQUEST',
        fsm: { getState: () => 'HELP_REQUEST' }
      });
      expect(result.nameRecorded).toBe(false);
      expect(result.skipHints).toBe(false);
      expect(result.showHints).toBe(true);
    });

    test('名字记录后 FSM 应转换到 NAMING_CEREMONY', () => {
      const result = processChildInput({
        childContent: '闪电',
        currentStep: 'HELP_REQUEST',
        fsm: { getState: () => 'HELP_REQUEST' }
      });
      expect(result.nextState).toBe('NAMING_CEREMONY');
    });
  });
});
