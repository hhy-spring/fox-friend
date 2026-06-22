const {
  PROFILE_FIELDS,
  createProfileCollector,
  buildProfile
} = require('../../src/dialog/profile-collector');

describe('画像采集器 - 4步画像信息采集', () => {
  let collector;

  beforeEach(() => {
    collector = createProfileCollector();
  });

  describe('初始状态', () => {
    test('创建采集器后，第一个字段应为 nickname', () => {
      const current = collector.getCurrentField();
      expect(current).not.toBeNull();
      expect(current.field).toBe('nickname');
    });

    test('创建采集器后，isComplete 应为 false', () => {
      expect(collector.isComplete()).toBe(false);
    });

    test('创建采集器后，进度应为 0/4', () => {
      const progress = collector.getProgress();
      expect(progress.current).toBe(0);
      expect(progress.total).toBe(4);
      expect(progress.percentage).toBe(0);
    });
  });

  describe('getCurrentField()', () => {
    test('返回当前字段的完整信息', () => {
      const current = collector.getCurrentField();
      expect(current).toEqual({
        field: 'nickname',
        label: '昵称',
        index: 0,
        total: 4
      });
    });

    test('所有字段采集完毕后返回 null', () => {
      collector.collectAnswer('nickname', '闪电');
      collector.collectAnswer('age', 6);
      collector.collectAnswer('interests', ['恐龙']);
      collector.collectAnswer('selfClaimedSkills', ['跑步快']);
      expect(collector.getCurrentField()).toBeNull();
    });
  });

  describe('collectAnswer() - 采集昵称', () => {
    test('采集昵称后，存储值并前进到 age', () => {
      const result = collector.collectAnswer('nickname', '闪电');
      expect(result.field).toBe('nickname');
      expect(result.value).toBe('闪电');
      expect(result.nextField.field).toBe('age');
      expect(result.isComplete).toBe(false);
    });
  });

  describe('collectAnswer() - 采集年龄', () => {
    test('采集年龄后，存储值并前进到 interests', () => {
      collector.collectAnswer('nickname', '闪电');
      const result = collector.collectAnswer('age', 6);
      expect(result.field).toBe('age');
      expect(result.value).toBe(6);
      expect(result.nextField.field).toBe('interests');
      expect(result.isComplete).toBe(false);
    });
  });

  describe('collectAnswer() - 采集兴趣', () => {
    test('采集兴趣后，存储值并前进到 selfClaimedSkills', () => {
      collector.collectAnswer('nickname', '闪电');
      collector.collectAnswer('age', 6);
      const result = collector.collectAnswer('interests', ['恐龙', '画画']);
      expect(result.field).toBe('interests');
      expect(result.value).toEqual(['恐龙', '画画']);
      expect(result.nextField.field).toBe('selfClaimedSkills');
      expect(result.isComplete).toBe(false);
    });
  });

  describe('collectAnswer() - 采集自认能力', () => {
    test('采集自认能力后，标记为完成', () => {
      collector.collectAnswer('nickname', '闪电');
      collector.collectAnswer('age', 6);
      collector.collectAnswer('interests', ['恐龙', '画画']);
      const result = collector.collectAnswer('selfClaimedSkills', ['跑步快']);
      expect(result.field).toBe('selfClaimedSkills');
      expect(result.value).toEqual(['跑步快']);
      expect(result.nextField).toBeNull();
      expect(result.isComplete).toBe(true);
    });
  });

  describe('markSkipped() - 跳过字段', () => {
    test('跳过字段后，存储 null 并前进到下一个字段', () => {
      collector.collectAnswer('nickname', '闪电');
      const result = collector.markSkipped('age');
      expect(result.field).toBe('age');
      expect(result.value).toBeNull();
      expect(result.nextField.field).toBe('interests');
      expect(result.isComplete).toBe(false);
    });

    test('跳过最后一个字段后，标记为完成', () => {
      collector.collectAnswer('nickname', '闪电');
      collector.collectAnswer('age', 6);
      collector.collectAnswer('interests', ['恐龙']);
      const result = collector.markSkipped('selfClaimedSkills');
      expect(result.value).toBeNull();
      expect(result.isComplete).toBe(true);
    });

    test('跳过的字段在 getCollectedData 中返回 null', () => {
      collector.collectAnswer('nickname', '闪电');
      collector.markSkipped('age');
      collector.collectAnswer('interests', ['画画']);
      collector.markSkipped('selfClaimedSkills');
      const data = collector.getCollectedData();
      expect(data.age).toBeNull();
      expect(data.selfClaimedSkills).toBeNull();
    });
  });

  describe('isComplete()', () => {
    test('所有字段采集完毕后返回 true', () => {
      collector.collectAnswer('nickname', '闪电');
      collector.collectAnswer('age', 6);
      collector.collectAnswer('interests', ['恐龙']);
      collector.collectAnswer('selfClaimedSkills', ['跑步快']);
      expect(collector.isComplete()).toBe(true);
    });

    test('部分字段采集后返回 false', () => {
      collector.collectAnswer('nickname', '闪电');
      collector.collectAnswer('age', 6);
      expect(collector.isComplete()).toBe(false);
    });
  });

  describe('getCollectedData()', () => {
    test('返回所有已采集的值', () => {
      collector.collectAnswer('nickname', '闪电');
      collector.collectAnswer('age', 6);
      collector.collectAnswer('interests', ['恐龙', '画画']);
      collector.collectAnswer('selfClaimedSkills', ['跑步快']);
      const data = collector.getCollectedData();
      expect(data).toEqual({
        nickname: '闪电',
        age: 6,
        interests: ['恐龙', '画画'],
        selfClaimedSkills: ['跑步快']
      });
    });

    test('未采集的字段返回 null', () => {
      collector.collectAnswer('nickname', '闪电');
      const data = collector.getCollectedData();
      expect(data.nickname).toBe('闪电');
      expect(data.age).toBeNull();
      expect(data.interests).toBeNull();
      expect(data.selfClaimedSkills).toBeNull();
    });
  });

  describe('getProgress()', () => {
    test('采集2个字段后，进度为 2/4 = 50%', () => {
      collector.collectAnswer('nickname', '闪电');
      collector.collectAnswer('age', 6);
      const progress = collector.getProgress();
      expect(progress.current).toBe(2);
      expect(progress.total).toBe(4);
      expect(progress.percentage).toBe(50);
    });

    test('全部采集后，进度为 4/4 = 100%', () => {
      collector.collectAnswer('nickname', '闪电');
      collector.collectAnswer('age', 6);
      collector.collectAnswer('interests', ['恐龙']);
      collector.collectAnswer('selfClaimedSkills', ['跑步快']);
      const progress = collector.getProgress();
      expect(progress.current).toBe(4);
      expect(progress.total).toBe(4);
      expect(progress.percentage).toBe(100);
    });
  });

  describe('buildProfile() - 构建完整画像数据', () => {
    test('组装完整画像数据结构（默认 interests_derived_from_fox_name 为空数组）', () => {
      const collectedData = {
        nickname: '闪电',
        age: 6,
        interests: ['恐龙', '画画'],
        selfClaimedSkills: ['跑步快']
      };
      const profile = buildProfile(collectedData, '闪电', 'child_choice', 5);
      expect(profile).toEqual({
        nickname: '闪电',
        age: 6,
        interests: ['恐龙', '画画'],
        self_claimed_skills: ['跑步快'],
        fox_name: '闪电',
        fox_name_source: 'child_choice',
        interests_derived_from_fox_name: [],
        first_meeting_reactions: {
          proactive_speech_count: 5
        }
      });
    });

    test('传入 interests_derived_from_fox_name 时正确填充（Issue #3）', () => {
      const collectedData = {
        nickname: '闪电',
        age: 6,
        interests: ['恐龙', '画画'],
        selfClaimedSkills: ['跑步快']
      };
      const profile = buildProfile(collectedData, '恐龙蛋', 'child_choice', 5, ['恐龙']);
      expect(profile.interests_derived_from_fox_name).toEqual(['恐龙']);
      expect(profile.fox_name).toBe('恐龙蛋');
    });

    test('跳过的字段在画像数据中为 null', () => {
      const collectedData = {
        nickname: '闪电',
        age: null,
        interests: ['画画'],
        selfClaimedSkills: null
      };
      const profile = buildProfile(collectedData, '闪电', 'child_choice', 3);
      expect(profile.age).toBeNull();
      expect(profile.self_claimed_skills).toBeNull();
      expect(profile.interests).toEqual(['画画']);
    });

    test('画像数据包含 fox_name 和 fox_name_source', () => {
      const collectedData = {
        nickname: '小天',
        age: 7,
        interests: ['乐高'],
        selfClaimedSkills: ['拼积木']
      };
      const profile = buildProfile(collectedData, '小龙', 'fox_suggestion', 2);
      expect(profile.fox_name).toBe('小龙');
      expect(profile.fox_name_source).toBe('fox_suggestion');
    });

    test('画像数据包含 proactive_speech_count', () => {
      const collectedData = {
        nickname: '闪电',
        age: 6,
        interests: ['恐龙'],
        selfClaimedSkills: ['跑步快']
      };
      const profile = buildProfile(collectedData, '闪电', 'child_choice', 8);
      expect(profile.first_meeting_reactions.proactive_speech_count).toBe(8);
    });
  });

  describe('字段顺序验证', () => {
    test('采集答案顺序错误时抛出错误', () => {
      expect(() => {
        collector.collectAnswer('age', 6);
      }).toThrow('字段顺序错误');
    });

    test('跳过字段顺序错误时抛出错误', () => {
      expect(() => {
        collector.markSkipped('interests');
      }).toThrow('字段顺序错误');
    });
  });
});
