const {
  CEREMONY_SUB_STATES,
  SKIP_PATTERNS,
  isSkipAnswer,
  extractAge,
  extractInterests,
  createNamingCeremony
} = require('../../src/dialog/naming-ceremony');

describe('命名仪式 - 崇拜式回应与画像采集', () => {
  // ===== 切片1: createNamingCeremony 初始状态为 WORSHIP =====
  describe('初始化', () => {
    test('初始子状态为 WORSHIP', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      expect(ceremony.getSubState()).toBe(CEREMONY_SUB_STATES.WORSHIP);
    });
  });

  // ===== 切片2: getWorshipResponse() 返回通用崇拜式回应 =====
  describe('崇拜式回应 - 通用', () => {
    test('getWorshipResponse() 返回通用崇拜式回应', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      const response = ceremony.getWorshipResponse();
      expect(response.mainLine).toBe('闪电！好酷的名字！从现在起我就叫闪电了！');
      expect(response.followUp).toBeNull();
      expect(response.waitBeforeNextMs).toBe(1500);
    });
  });

  // ===== 切片3: getWorshipResponse() 恐龙兴趣类型 =====
  describe('崇拜式回应 - 恐龙兴趣', () => {
    test('getWorshipResponse() 恐龙类型返回恐龙崇拜式回应', () => {
      const ceremony = createNamingCeremony('恐龙蛋', 'child_choice', 'dinosaur');
      const response = ceremony.getWorshipResponse();
      expect(response.mainLine).toBe('恐龙蛋！！太酷了吧！我最喜欢恐龙了！从今天起我就叫恐龙蛋啦！嗷呜——！');
      expect(response.followUp).toBeNull();
      expect(response.waitBeforeNextMs).toBe(1500);
    });
  });

  // ===== 切片4: getWorshipResponse() 速度和公主兴趣类型 =====
  describe('崇拜式回应 - 速度和公主兴趣', () => {
    test('getWorshipResponse() 速度类型返回速度崇拜式回应', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice', 'speed');
      const response = ceremony.getWorshipResponse();
      expect(response.mainLine).toBe('闪电！！嗖——！太快了太快了！从今天起我就叫闪电了！谁也追不上我！呜——');
      expect(response.followUp).toBeNull();
    });

    test('getWorshipResponse() 公主类型返回公主崇拜式回应', () => {
      const ceremony = createNamingCeremony('艾莎', 'child_choice', 'princess');
      const response = ceremony.getWorshipResponse();
      expect(response.mainLine).toBe('艾莎！！哇——你会魔法吗？那从今天起我就是艾莎了！叮——我有魔法了！');
      expect(response.followUp).toBeNull();
    });
  });

  // ===== 切片5: processAnswer 从 WORSHIP 转换到 ASK_NICKNAME =====
  describe('子状态转换 - WORSHIP → ASK_NICKNAME', () => {
    test('processAnswer 在 WORSHIP 状态转换到 ASK_NICKNAME', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      const result = ceremony.processAnswer('好酷');
      expect(result.nextSubState).toBe(CEREMONY_SUB_STATES.ASK_NICKNAME);
      expect(result.isComplete).toBe(false);
      expect(ceremony.getSubState()).toBe(CEREMONY_SUB_STATES.ASK_NICKNAME);
    });
  });

  // ===== 切片6: getCurrentQuestion() 返回昵称问题 =====
  describe('获取当前画像问题', () => {
    test('ASK_NICKNAME 状态下 getCurrentQuestion() 返回昵称问题', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷'); // WORSHIP → ASK_NICKNAME
      const question = ceremony.getCurrentQuestion();
      expect(question.mainLine).toBe('你给我起了这么厉害的名字，你一定也很厉害！你叫什么？');
      expect(question.field).toBe('nickname');
      expect(question.followUp).toBeNull();
      expect(question.waitBeforeNextMs).toBe(0);
    });

    test('WORSHIP 状态下 getCurrentQuestion() 返回 null', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      expect(ceremony.getCurrentQuestion()).toBeNull();
    });

    test('COMPLETE 状态下 getCurrentQuestion() 返回 null', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      // 快速推进到 COMPLETE
      ceremony.processAnswer('好酷');   // WORSHIP → ASK_NICKNAME
      ceremony.processAnswer('小明');   // → ASK_AGE
      ceremony.processAnswer('5岁');    // → ASK_INTERESTS
      ceremony.processAnswer('画画');   // → ASK_SKILLS
      ceremony.processAnswer('跑步');   // → COMPLETE
      expect(ceremony.getCurrentQuestion()).toBeNull();
    });
  });

  // ===== 切片7: processAnswer 收集昵称 =====
  describe('收集昵称', () => {
    test('processAnswer 收集昵称并转换到 ASK_AGE', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷'); // WORSHIP → ASK_NICKNAME
      const result = ceremony.processAnswer('小明');
      expect(result.field).toBe('nickname');
      expect(result.value).toBe('小明');
      expect(result.skipped).toBe(false);
      expect(result.nextSubState).toBe(CEREMONY_SUB_STATES.ASK_AGE);
      expect(ceremony.getSubState()).toBe(CEREMONY_SUB_STATES.ASK_AGE);
    });
  });

  // ===== 切片8: isSkipAnswer 检测跳过模式 =====
  describe('跳过检测 - isSkipAnswer', () => {
    test('检测"不知道"为跳过', () => {
      expect(isSkipAnswer('不知道')).toBe(true);
    });

    test('检测"不晓得"为跳过', () => {
      expect(isSkipAnswer('不晓得')).toBe(true);
    });

    test('检测"不想说"为跳过', () => {
      expect(isSkipAnswer('不想说')).toBe(true);
    });

    test('检测"随便"为跳过', () => {
      expect(isSkipAnswer('随便')).toBe(true);
    });

    test('检测"嗯"为跳过', () => {
      expect(isSkipAnswer('嗯')).toBe(true);
    });

    test('检测"额"为跳过', () => {
      expect(isSkipAnswer('额')).toBe(true);
    });

    test('检测"不想"为跳过', () => {
      expect(isSkipAnswer('不想')).toBe(true);
    });

    test('检测"不要"为跳过', () => {
      expect(isSkipAnswer('不要')).toBe(true);
    });

    test('检测"没有"为跳过', () => {
      expect(isSkipAnswer('没有')).toBe(true);
    });

    test('正常回答不被识别为跳过', () => {
      expect(isSkipAnswer('小明')).toBe(false);
      expect(isSkipAnswer('5岁')).toBe(false);
      expect(isSkipAnswer('我喜欢画画')).toBe(false);
    });

    test('空内容识别为跳过', () => {
      expect(isSkipAnswer('')).toBe(true);
      expect(isSkipAnswer(null)).toBe(true);
      expect(isSkipAnswer(undefined)).toBe(true);
    });
  });

  // ===== 切片9: processAnswer 处理跳过 → null值，继续前进 =====
  describe('跳过处理', () => {
    test('跳过昵称问题 → nickname 为 null，转换到 ASK_AGE', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷'); // WORSHIP → ASK_NICKNAME
      const result = ceremony.processAnswer('不知道');
      expect(result.field).toBe('nickname');
      expect(result.value).toBeNull();
      expect(result.skipped).toBe(true);
      expect(result.nextSubState).toBe(CEREMONY_SUB_STATES.ASK_AGE);
    });

    test('跳过后画像中对应字段为 null', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷'); // WORSHIP → ASK_NICKNAME
      ceremony.processAnswer('不知道'); // skip nickname
      const profile = ceremony.getProfile();
      expect(profile.nickname).toBeNull();
    });
  });

  // ===== 切片10: extractAge 从回答中提取年龄 =====
  describe('年龄提取 - extractAge', () => {
    test('从"5岁"中提取5', () => {
      expect(extractAge('5岁')).toBe(5);
    });

    test('从"我6岁了"中提取6', () => {
      expect(extractAge('我6岁了')).toBe(6);
    });

    test('从纯数字"7"中提取7', () => {
      expect(extractAge('7')).toBe(7);
    });

    test('从中文数字"五岁"中提取5', () => {
      expect(extractAge('五岁')).toBe(5);
    });

    test('无效内容返回null', () => {
      expect(extractAge('不知道')).toBeNull();
      expect(extractAge('')).toBeNull();
      expect(extractAge(null)).toBeNull();
    });

    test('超出合理范围返回null', () => {
      expect(extractAge('100岁')).toBeNull();
      expect(extractAge('1岁')).toBeNull();
    });
  });

  // ===== 切片11: 年龄收集和转换 =====
  describe('年龄收集', () => {
    test('收集年龄并转换到 ASK_INTERESTS', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷');   // WORSHIP → ASK_NICKNAME
      ceremony.processAnswer('小明');   // → ASK_AGE
      const result = ceremony.processAnswer('5岁');
      expect(result.field).toBe('age');
      expect(result.value).toBe(5);
      expect(result.skipped).toBe(false);
      expect(result.nextSubState).toBe(CEREMONY_SUB_STATES.ASK_INTERESTS);
    });

    test('跳过年龄 → age 为 null', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷');   // WORSHIP → ASK_NICKNAME
      ceremony.processAnswer('小明');   // → ASK_AGE
      const result = ceremony.processAnswer('不想说');
      expect(result.field).toBe('age');
      expect(result.value).toBeNull();
      expect(result.skipped).toBe(true);
    });
  });

  // ===== 切片12: extractInterests =====
  describe('兴趣提取 - extractInterests', () => {
    test('单个兴趣返回数组', () => {
      expect(extractInterests('画画')).toEqual(['画画']);
    });

    test('逗号分隔多个兴趣', () => {
      expect(extractInterests('画画，唱歌')).toEqual(['画画', '唱歌']);
    });

    test('顿号分隔多个兴趣', () => {
      expect(extractInterests('画画、唱歌')).toEqual(['画画', '唱歌']);
    });

    test('跳过回答返回null', () => {
      expect(extractInterests('不知道')).toBeNull();
      expect(extractInterests('')).toBeNull();
      expect(extractInterests(null)).toBeNull();
    });

    test('"和"字分隔', () => {
      expect(extractInterests('画画和唱歌')).toEqual(['画画', '唱歌']);
    });
  });

  // ===== 切片13: 兴趣收集 =====
  describe('兴趣收集', () => {
    test('收集兴趣并转换到 ASK_SKILLS', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷');   // WORSHIP → ASK_NICKNAME
      ceremony.processAnswer('小明');   // → ASK_AGE
      ceremony.processAnswer('5岁');    // → ASK_INTERESTS
      const result = ceremony.processAnswer('画画和唱歌');
      expect(result.field).toBe('interests');
      expect(result.value).toEqual(['画画', '唱歌']);
      expect(result.nextSubState).toBe(CEREMONY_SUB_STATES.ASK_SKILLS);
    });
  });

  // ===== 切片14: 技能收集 =====
  describe('技能收集', () => {
    test('收集技能并转换到 COMPLETE', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷');   // WORSHIP → ASK_NICKNAME
      ceremony.processAnswer('小明');   // → ASK_AGE
      ceremony.processAnswer('5岁');    // → ASK_INTERESTS
      ceremony.processAnswer('画画');   // → ASK_SKILLS
      const result = ceremony.processAnswer('跑步很快');
      expect(result.field).toBe('selfClaimedSkills');
      expect(result.value).toBe('跑步很快');
      expect(result.nextSubState).toBe(CEREMONY_SUB_STATES.COMPLETE);
    });
  });

  // ===== 切片15: getProfile() 返回完整画像 =====
  describe('完整画像 - getProfile()', () => {
    test('完成所有问题后返回完整画像', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷');       // WORSHIP → ASK_NICKNAME
      ceremony.processAnswer('小明');       // → ASK_AGE
      ceremony.processAnswer('5岁');        // → ASK_INTERESTS
      ceremony.processAnswer('画画和唱歌'); // → ASK_SKILLS
      ceremony.processAnswer('跑步很快');   // → COMPLETE

      const profile = ceremony.getProfile();
      expect(profile.foxName).toBe('闪电');
      expect(profile.foxNameSource).toBe('child_choice');
      expect(profile.nickname).toBe('小明');
      expect(profile.age).toBe(5);
      expect(profile.interests).toEqual(['画画', '唱歌']);
      expect(profile.selfClaimedSkills).toBe('跑步很快');
    });

    test('foxName 和 foxNameSource 正确填写', () => {
      const ceremony = createNamingCeremony('恐龙蛋', 'fox_suggestion', 'dinosaur');
      const profile = ceremony.getProfile();
      expect(profile.foxName).toBe('恐龙蛋');
      expect(profile.foxNameSource).toBe('fox_suggestion');
    });

    test('部分跳过时画像中跳过字段为null', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷');   // WORSHIP → ASK_NICKNAME
      ceremony.processAnswer('不知道'); // skip nickname → ASK_AGE
      ceremony.processAnswer('5岁');    // → ASK_INTERESTS
      ceremony.processAnswer('画画');   // → ASK_SKILLS
      ceremony.processAnswer('跑步');   // → COMPLETE

      const profile = ceremony.getProfile();
      expect(profile.nickname).toBeNull();
      expect(profile.age).toBe(5);
      expect(profile.interests).toEqual(['画画']);
      expect(profile.selfClaimedSkills).toBe('跑步');
    });
  });

  // ===== 切片16: isComplete 在所有问题后为 true =====
  describe('完成检测', () => {
    test('所有问题回答后 isComplete 为 true', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷');   // WORSHIP → ASK_NICKNAME
      ceremony.processAnswer('小明');   // → ASK_AGE
      ceremony.processAnswer('5岁');    // → ASK_INTERESTS
      ceremony.processAnswer('画画');   // → ASK_SKILLS
      const result = ceremony.processAnswer('跑步'); // → COMPLETE
      expect(result.isComplete).toBe(true);
      expect(ceremony.getSubState()).toBe(CEREMONY_SUB_STATES.COMPLETE);
    });

    test('中间状态 isComplete 为 false', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.processAnswer('好酷'); // WORSHIP → ASK_NICKNAME
      const result = ceremony.processAnswer('小明');
      expect(result.isComplete).toBe(false);
    });
  });

  // ===== 切片17: 主动发言计数 =====
  describe('主动发言计数', () => {
    test('初始计数为0', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      expect(ceremony.getProactiveSpeechCount()).toBe(0);
    });

    test('incrementProactiveSpeech 增加计数', () => {
      const ceremony = createNamingCeremony('闪电', 'child_choice');
      ceremony.incrementProactiveSpeech();
      ceremony.incrementProactiveSpeech();
      expect(ceremony.getProactiveSpeechCount()).toBe(2);
    });
  });
});
