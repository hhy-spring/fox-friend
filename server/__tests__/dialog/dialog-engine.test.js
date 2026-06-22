const {
  detectReaction,
  getStepDialog,
  getNamingCeremonyDialog,
  getNamingCeremonyDialogWithInterest,
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

  describe('步骤3 命名仪式 - getStepDialog 模板', () => {
    test('QUICK → 返回含 {foxName} 占位符的模板', () => {
      const dialog = getStepDialog('NAMING_CEREMONY', REACTION_TYPES.QUICK);
      expect(dialog.mainLine).toContain('{foxName}');
      expect(dialog.followUp).toContain('你一定也很厉害');
      expect(dialog.waitBeforeNextMs).toBe(1500);
    });

    test('HESITANT → 返回含 {foxName} 占位符的模板', () => {
      const dialog = getStepDialog('NAMING_CEREMONY', REACTION_TYPES.HESITANT);
      expect(dialog.mainLine).toContain('{foxName}');
      expect(dialog.followUp).toContain('你叫什么呀');
      expect(dialog.waitBeforeNextMs).toBe(2000);
    });

    test('SILENT → 返回含 {foxName} 占位符的模板', () => {
      const dialog = getStepDialog('NAMING_CEREMONY', REACTION_TYPES.SILENT);
      expect(dialog.mainLine).toContain('{foxName}');
      expect(dialog.followUp).toContain('嗯...你给我起了这么厉害的名字');
      expect(dialog.waitBeforeNextMs).toBe(2000);
    });
  });

  describe('步骤3 命名仪式 - getNamingCeremonyDialog 替换占位符', () => {
    test('QUICK + 名字"闪电" → mainLine 中 {foxName} 被替换', () => {
      const dialog = getNamingCeremonyDialog(REACTION_TYPES.QUICK, '闪电');
      expect(dialog.mainLine).toBe('闪电！好酷的名字！从现在起我就叫闪电了！');
      expect(dialog.mainLine).not.toContain('{foxName}');
      expect(dialog.followUp).toContain('你一定也很厉害');
      expect(dialog.waitBeforeNextMs).toBe(1500);
    });

    test('HESITANT + 名字"小花" → mainLine 中 {foxName} 被替换', () => {
      const dialog = getNamingCeremonyDialog(REACTION_TYPES.HESITANT, '小花');
      expect(dialog.mainLine).toBe('小花！好酷的名字！从现在起我就叫小花了！');
      expect(dialog.followUp).toContain('你叫什么呀');
    });

    test('SILENT + 名字"大壮" → mainLine 中 {foxName} 被替换', () => {
      const dialog = getNamingCeremonyDialog(REACTION_TYPES.SILENT, '大壮');
      expect(dialog.mainLine).toBe('大壮！好酷的名字！从现在起我就叫大壮了！');
      expect(dialog.followUp).toContain('嗯...');
    });
  });

  describe('步骤3 命名仪式 - getNamingCeremonyDialogWithInterest 兴趣分支', () => {
    test('dinosaur 兴趣 → 恐龙崇拜式 mainLine', () => {
      const dialog = getNamingCeremonyDialogWithInterest(REACTION_TYPES.QUICK, '闪电', 'dinosaur');
      expect(dialog.mainLine).toBe('闪电！！太酷了吧！我最喜欢恐龙了！从今天起我就叫闪电啦！嗷呜——！');
      expect(dialog.followUp).toContain('你一定也很厉害');
    });

    test('princess 兴趣 → 公主崇拜式 mainLine', () => {
      const dialog = getNamingCeremonyDialogWithInterest(REACTION_TYPES.QUICK, '闪电', 'princess');
      expect(dialog.mainLine).toBe('闪电！！哇——你会魔法吗？那从今天起我就是闪电了！叮——我有魔法了！');
    });

    test('speed 兴趣 → 速度崇拜式 mainLine', () => {
      const dialog = getNamingCeremonyDialogWithInterest(REACTION_TYPES.QUICK, '闪电', 'speed');
      expect(dialog.mainLine).toBe('闪电！！嗖——！太快了太快了！从今天起我就叫闪电了！谁也追不上我！呜——');
    });

    test('未知兴趣类型 → 回退到通用模板', () => {
      const dialog = getNamingCeremonyDialogWithInterest(REACTION_TYPES.QUICK, '闪电', 'unknown_type');
      expect(dialog.mainLine).toBe('闪电！好酷的名字！从现在起我就叫闪电了！');
    });

    test('undefined 兴趣类型 → 回退到通用模板', () => {
      const dialog = getNamingCeremonyDialogWithInterest(REACTION_TYPES.QUICK, '闪电', undefined);
      expect(dialog.mainLine).toBe('闪电！好酷的名字！从现在起我就叫闪电了！');
    });

    test('HESITANT + dinosaur → 恐龙崇拜式 mainLine + HESITANT followUp', () => {
      const dialog = getNamingCeremonyDialogWithInterest(REACTION_TYPES.HESITANT, '小花', 'dinosaur');
      expect(dialog.mainLine).toContain('我最喜欢恐龙了');
      expect(dialog.followUp).toContain('你叫什么呀');
    });
  });
});
