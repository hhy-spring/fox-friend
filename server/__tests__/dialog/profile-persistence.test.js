const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateProfile, saveProfile, loadProfile } = require('../../src/dialog/profile-persistence');

describe('画像落库 - profile-persistence', () => {
  describe('validateProfile() - 验证画像完整性', () => {
    test('4个必要字段都有值时，isValid=true, meetsMvpStandard=true', () => {
      const profile = {
        nickname: '闪电',
        age: 6,
        interests: ['恐龙', '画画'],
        self_claimed_skills: ['跑步快'],
        fox_name: '闪电',
        fox_name_source: 'child_choice',
        interests_derived_from_fox_name: [],
        first_meeting_reactions: {
          proactive_speech_count: 5,
          teaching_willingness: null,
          partner_acceptance: null
        }
      };

      const result = validateProfile(profile);

      expect(result.isValid).toBe(true);
      expect(result.meetsMvpStandard).toBe(true);
      expect(result.completedFields).toBe(4);
      expect(result.missingFields).toEqual([]);
    });

    test('3个字段有值、1个为null时，isValid=true, meetsMvpStandard=true', () => {
      const profile = {
        nickname: '闪电',
        age: 6,
        interests: ['恐龙', '画画'],
        self_claimed_skills: null,
        fox_name: '闪电',
        fox_name_source: 'child_choice',
        interests_derived_from_fox_name: [],
        first_meeting_reactions: {
          proactive_speech_count: 5,
          teaching_willingness: null,
          partner_acceptance: null
        }
      };

      const result = validateProfile(profile);

      expect(result.isValid).toBe(true);
      expect(result.meetsMvpStandard).toBe(true);
      expect(result.completedFields).toBe(3);
      expect(result.missingFields).toEqual(['self_claimed_skills']);
    });

    test('只有2个字段有值时，meetsMvpStandard=false', () => {
      const profile = {
        nickname: '闪电',
        age: 6,
        interests: null,
        self_claimed_skills: null,
        fox_name: '闪电',
        fox_name_source: 'child_choice',
        interests_derived_from_fox_name: [],
        first_meeting_reactions: {
          proactive_speech_count: 5,
          teaching_willingness: null,
          partner_acceptance: null
        }
      };

      const result = validateProfile(profile);

      expect(result.meetsMvpStandard).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.completedFields).toBe(2);
      expect(result.missingFields).toEqual(['interests', 'self_claimed_skills']);
    });

    test('全部必要字段为null时，meetsMvpStandard=false, missingFields包含所有4个字段', () => {
      const profile = {
        nickname: null,
        age: null,
        interests: null,
        self_claimed_skills: null,
        fox_name: '闪电',
        fox_name_source: 'child_choice',
        interests_derived_from_fox_name: [],
        first_meeting_reactions: {
          proactive_speech_count: 0,
          teaching_willingness: null,
          partner_acceptance: null
        }
      };

      const result = validateProfile(profile);

      expect(result.meetsMvpStandard).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.completedFields).toBe(0);
      expect(result.missingFields).toEqual([
        'nickname',
        'age',
        'interests',
        'self_claimed_skills'
      ]);
    });
  });

  describe('saveProfile() - 保存画像到文件', () => {
    let tmpDir;

    beforeEach(() => {
      // 每个测试使用独立的临时目录，避免相互污染
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fox-friend-profile-'));
    });

    afterEach(() => {
      // 测试后清理临时目录
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    // 构造一个完整的画像数据
    function buildFullProfile() {
      return {
        nickname: '闪电',
        age: 6,
        interests: ['恐龙', '画画'],
        self_claimed_skills: ['跑步快'],
        fox_name: '闪电',
        fox_name_source: 'child_choice',
        interests_derived_from_fox_name: ['恐龙'],
        first_meeting_reactions: {
          proactive_speech_count: 5,
          teaching_willingness: true,
          partner_acceptance: true
        }
      };
    }

    test('保存有效画像时，success=true 且文件存在', () => {
      const profile = buildFullProfile();
      const childId = 'child-001';

      const result = saveProfile(profile, childId, { storageDir: tmpDir });

      expect(result.success).toBe(true);
      expect(result.path).toBe(path.join(tmpDir, `profile_${childId}.json`));
      expect(fs.existsSync(result.path)).toBe(true);
    });

    test('保存时如果目录不存在，自动创建嵌套目录', () => {
      const profile = buildFullProfile();
      const childId = 'child-002';
      // 构造一个不存在的嵌套目录
      const nestedDir = path.join(tmpDir, 'nested', 'deep', 'storage');

      const result = saveProfile(profile, childId, { storageDir: nestedDir });

      expect(result.success).toBe(true);
      expect(fs.existsSync(nestedDir)).toBe(true);
      expect(fs.existsSync(result.path)).toBe(true);
    });

    test('保存的文件包含 saved_at 时间戳（ISO 格式）', () => {
      const profile = buildFullProfile();
      const childId = 'child-003';
      const beforeTime = new Date().toISOString();

      const result = saveProfile(profile, childId, { storageDir: tmpDir });

      const afterTime = new Date().toISOString();
      // 返回结果中包含 timestamp
      expect(result.timestamp).toBeDefined();
      // saved_at 时间戳应介于保存前后时间之间
      expect(result.timestamp >= beforeTime).toBe(true);
      expect(result.timestamp <= afterTime).toBe(true);

      // 文件内容中也应包含 saved_at 字段
      const fileContent = JSON.parse(fs.readFileSync(result.path, 'utf8'));
      expect(fileContent.saved_at).toBeDefined();
      expect(fileContent.saved_at).toBe(result.timestamp);
    });

    test('保存的 JSON 文件内容与传入画像一致（含所有字段）', () => {
      const profile = buildFullProfile();
      const childId = 'child-004';

      const result = saveProfile(profile, childId, { storageDir: tmpDir });

      const fileContent = JSON.parse(fs.readFileSync(result.path, 'utf8'));

      // 所有原始字段应被保留
      expect(fileContent.nickname).toBe('闪电');
      expect(fileContent.age).toBe(6);
      expect(fileContent.interests).toEqual(['恐龙', '画画']);
      expect(fileContent.self_claimed_skills).toEqual(['跑步快']);
      expect(fileContent.fox_name).toBe('闪电');
      expect(fileContent.fox_name_source).toBe('child_choice');
      expect(fileContent.interests_derived_from_fox_name).toEqual(['恐龙']);
      expect(fileContent.first_meeting_reactions).toEqual({
        proactive_speech_count: 5,
        teaching_willingness: true,
        partner_acceptance: true
      });
      // 应包含 saved_at 字段
      expect(fileContent.saved_at).toBeDefined();
    });
  });

  describe('loadProfile() - 读取画像', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fox-friend-load-'));
    });

    afterEach(() => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('读取已保存的画像时，success=true 且 profile 数据正确', () => {
      const profile = {
        nickname: '小天',
        age: 7,
        interests: ['乐高'],
        self_claimed_skills: ['拼积木'],
        fox_name: '小龙',
        fox_name_source: 'fox_suggestion',
        interests_derived_from_fox_name: ['龙'],
        first_meeting_reactions: {
          proactive_speech_count: 3,
          teaching_willingness: false,
          partner_acceptance: true
        }
      };
      const childId = 'child-load-001';

      // 先保存
      const saveResult = saveProfile(profile, childId, { storageDir: tmpDir });
      expect(saveResult.success).toBe(true);

      // 再读取
      const loadResult = loadProfile(childId, { storageDir: tmpDir });

      expect(loadResult.success).toBe(true);
      expect(loadResult.profile).not.toBeNull();
      expect(loadResult.path).toBe(path.join(tmpDir, `profile_${childId}.json`));
      // 验证读取到的画像字段
      expect(loadResult.profile.nickname).toBe('小天');
      expect(loadResult.profile.age).toBe(7);
      expect(loadResult.profile.interests).toEqual(['乐高']);
      expect(loadResult.profile.self_claimed_skills).toEqual(['拼积木']);
      expect(loadResult.profile.fox_name).toBe('小龙');
      expect(loadResult.profile.fox_name_source).toBe('fox_suggestion');
      expect(loadResult.profile.interests_derived_from_fox_name).toEqual(['龙']);
      expect(loadResult.profile.first_meeting_reactions).toEqual({
        proactive_speech_count: 3,
        teaching_willingness: false,
        partner_acceptance: true
      });
      // saved_at 字段也应被读取出来
      expect(loadResult.profile.saved_at).toBeDefined();
    });

    test('读取不存在的画像时，success=false 且 profile=null', () => {
      const childId = 'non-existent-child';

      const loadResult = loadProfile(childId, { storageDir: tmpDir });

      expect(loadResult.success).toBe(false);
      expect(loadResult.profile).toBeNull();
      expect(loadResult.path).toBe(path.join(tmpDir, `profile_${childId}.json`));
    });
  });
});
