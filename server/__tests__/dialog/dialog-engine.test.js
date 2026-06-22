const {
  detectReaction,
  getStepDialog,
  REACTION_TYPES
} = require('../../src/dialog/dialog-engine');

describe('对话引擎 - 孩子反应检测与台词生成', () => {
  describe('反应类型检测', () => {
    test('秒回（<1秒）识别为 QUICK', () => {
      const reaction = detectReaction({ responseTimeMs: 500, content: '你好' });
      expect(reaction).toBe(REACTION_TYPES.QUICK);
    });

    test('犹豫（1-3秒说单词）识别为 HESITANT', () => {
      const reaction = detectReaction({ responseTimeMs: 2000, content: '嗯' });
      expect(reaction).toBe(REACTION_TYPES.HESITANT);
    });

    test('沉默（>3秒）识别为 SILENT', () => {
      const reaction = detectReaction({ responseTimeMs: 4000, content: '' });
      expect(reaction).toBe(REACTION_TYPES.SILENT);
    });

    test('1秒内但内容为空也识别为 HESITANT', () => {
      const reaction = detectReaction({ responseTimeMs: 800, content: '' });
      expect(reaction).toBe(REACTION_TYPES.HESITANT);
    });

    test('3秒说完整句子识别为 QUICK', () => {
      const reaction = detectReaction({ responseTimeMs: 2500, content: '你好呀小狐狸' });
      expect(reaction).toBe(REACTION_TYPES.QUICK);
    });
  });

  describe('步骤1 出场台词', () => {
    test('秒回 → 基础出场台词 + 等1秒进入步骤2', () => {
      const dialog = getStepDialog('APPEARANCE', REACTION_TYPES.QUICK);
      expect(dialog.mainLine).toContain('你好你好');
      expect(dialog.mainLine).toContain('我一直在等一个小朋友');
      expect(dialog.followUp).toBeNull();
      expect(dialog.waitBeforeNextMs).toBe(1000);
    });

    test('犹豫 → 基础出场台词 + 追加「你听见我说话了吗？」', () => {
      const dialog = getStepDialog('APPEARANCE', REACTION_TYPES.HESITANT);
      expect(dialog.mainLine).toContain('你好你好');
      expect(dialog.followUp).toContain('你听见我说话了吗');
      expect(dialog.waitBeforeNextMs).toBe(2000);
    });

    test('沉默 → 基础出场台词 + 害羞台词 + 再等2秒', () => {
      const dialog = getStepDialog('APPEARANCE', REACTION_TYPES.SILENT);
      expect(dialog.mainLine).toContain('你好你好');
      expect(dialog.followUp).toContain('害羞');
      expect(dialog.waitBeforeNextMs).toBe(2000);
    });
  });

  describe('步骤2 求助台词', () => {
    test('秒回 → 求助台词 + 问想起什么名字', () => {
      const dialog = getStepDialog('HELP_REQUEST', REACTION_TYPES.QUICK);
      expect(dialog.mainLine).toContain('我还没有名字');
      expect(dialog.mainLine).toContain('你能帮我起一个吗');
      expect(dialog.followUp).toContain('你想给我起个什么样的名字');
    });

    test('犹豫 → 求助台词 + 鼓励随便说', () => {
      const dialog = getStepDialog('HELP_REQUEST', REACTION_TYPES.HESITANT);
      expect(dialog.mainLine).toContain('我还没有名字');
      expect(dialog.followUp).toContain('随便说');
    });

    test('沉默 → 秘密式求助 + 鼓励起名', () => {
      const dialog = getStepDialog('HELP_REQUEST', REACTION_TYPES.SILENT);
      expect(dialog.mainLine).toContain('秘密');
      expect(dialog.mainLine).toContain('我没有名字');
      expect(dialog.followUp).toContain('你想给我起一个名字吗');
    });
  });
});
