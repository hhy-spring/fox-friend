/**
 * 拼音教学内容测试 - Issue #8 每日拼音教学
 *
 * 参考PRD §4.2 骨架层：命运主线故事 - 字母石（拼音）阶段
 * MVP 范围：a/o/e 三个元音的一节课
 */

const {
  PINYIN_VOWELS,
  createPinyinContentProvider
} = require('../../src/dialog/pinyin-content');

describe('拼音教学内容 - a/o/e 三元音教学', () => {
  // ===== 切片1: getVowels() 返回 a/o/e 三个元音 =====
  describe('元音列表', () => {
    test('getVowels() 返回恰好 3 个元音 a/o/e', () => {
      const provider = createPinyinContentProvider();
      const vowels = provider.getVowels();
      expect(vowels).toHaveLength(3);
      expect(vowels.map(v => v.vowel)).toEqual(['a', 'o', 'e']);
    });
  });

  // ===== 切片2: 每个元音对象含 vowel/exampleWord/teachingLine/mouthShape 字段 =====
  describe('元音对象字段', () => {
    test('每个元音对象含 vowel/exampleWord/teachingLine/mouthShape 四个字段', () => {
      const provider = createPinyinContentProvider();
      const vowels = provider.getVowels();
      vowels.forEach(v => {
        expect(v).toHaveProperty('vowel');
        expect(v).toHaveProperty('exampleWord');
        expect(v).toHaveProperty('teachingLine');
        expect(v).toHaveProperty('mouthShape');
      });
    });
  });

  // ===== 切片3: getVowel('a') 返回 a 元音对象 =====
  describe('获取单个元音', () => {
    test("getVowel('a') 返回 a 元音对象", () => {
      const provider = createPinyinContentProvider();
      const vowel = provider.getVowel('a');
      expect(vowel).not.toBeNull();
      expect(vowel.vowel).toBe('a');
      expect(vowel.exampleWord).toBe('阿姨');
    });

    // ===== 切片4: getVowel('x') 未知元音返回 null =====
    test("getVowel('x') 对未知元音返回 null", () => {
      const provider = createPinyinContentProvider();
      expect(provider.getVowel('x')).toBeNull();
      expect(provider.getVowel('b')).toBeNull();
    });
  });

  // ===== 切片5: getTeachingLine('a') 返回非空字符串 =====
  describe('获取教学台词', () => {
    test("getTeachingLine('a') 返回非空字符串", () => {
      const provider = createPinyinContentProvider();
      const line = provider.getTeachingLine('a');
      expect(typeof line).toBe('string');
      expect(line.length).toBeGreaterThan(0);
    });

    test('三个元音都能返回非空教学台词', () => {
      const provider = createPinyinContentProvider();
      ['a', 'o', 'e'].forEach(v => {
        const line = provider.getTeachingLine(v);
        expect(typeof line).toBe('string');
        expect(line.length).toBeGreaterThan(0);
      });
    });
  });

  // ===== 切片6: getMasteryStatus 默认为 'new' =====
  describe('掌握状态 - 默认值', () => {
    test('所有元音初始掌握状态为 new', () => {
      const provider = createPinyinContentProvider();
      ['a', 'o', 'e'].forEach(v => {
        expect(provider.getMasteryStatus(v)).toBe('new');
      });
    });
  });

  // ===== 切片7: updateMastery 后 getMasteryStatus 返回新状态 =====
  describe('掌握状态 - 更新', () => {
    test("updateMastery('a', 'mastered') 后 getMasteryStatus('a') 返回 'mastered'", () => {
      const provider = createPinyinContentProvider();
      provider.updateMastery('a', 'mastered');
      expect(provider.getMasteryStatus('a')).toBe('mastered');
    });

    test("updateMastery('o', 'learning') 后 getMasteryStatus('o') 返回 'learning'", () => {
      const provider = createPinyinContentProvider();
      provider.updateMastery('o', 'learning');
      expect(provider.getMasteryStatus('o')).toBe('learning');
    });

    test('更新一个元音不影响其他元音的状态', () => {
      const provider = createPinyinContentProvider();
      provider.updateMastery('a', 'mastered');
      expect(provider.getMasteryStatus('a')).toBe('mastered');
      expect(provider.getMasteryStatus('o')).toBe('new');
      expect(provider.getMasteryStatus('e')).toBe('new');
    });
  });

  // ===== 切片8: getLessonPlan() 返回 3-9 轮 (每元音 1-3 轮) =====
  describe('课程计划', () => {
    test('getLessonPlan() 返回 3-9 轮对话', () => {
      const provider = createPinyinContentProvider();
      const plan = provider.getLessonPlan();
      expect(plan.length).toBeGreaterThanOrEqual(3);
      expect(plan.length).toBeLessThanOrEqual(9);
    });

    test('每个课程项包含 vowel/round/content 三个字段', () => {
      const provider = createPinyinContentProvider();
      const plan = provider.getLessonPlan();
      plan.forEach(item => {
        expect(item).toHaveProperty('vowel');
        expect(item).toHaveProperty('round');
        expect(item).toHaveProperty('content');
        expect(typeof item.content).toBe('string');
        expect(item.content.length).toBeGreaterThan(0);
      });
    });

    test('每个元音有 1-3 轮对话', () => {
      const provider = createPinyinContentProvider();
      const plan = provider.getLessonPlan();
      ['a', 'o', 'e'].forEach(v => {
        const rounds = plan.filter(item => item.vowel === v);
        expect(rounds.length).toBeGreaterThanOrEqual(1);
        expect(rounds.length).toBeLessThanOrEqual(3);
      });
    });
  });

  // ===== 切片9: isLessonComplete() 初始 false，全部 mastered 后 true =====
  describe('课程完成检测', () => {
    test('初始状态 isLessonComplete() 为 false', () => {
      const provider = createPinyinContentProvider();
      expect(provider.isLessonComplete()).toBe(false);
    });

    test('只掌握部分元音时 isLessonComplete() 为 false', () => {
      const provider = createPinyinContentProvider();
      provider.updateMastery('a', 'mastered');
      provider.updateMastery('o', 'mastered');
      expect(provider.isLessonComplete()).toBe(false);
    });

    test('三个元音全部 mastered 后 isLessonComplete() 为 true', () => {
      const provider = createPinyinContentProvider();
      provider.updateMastery('a', 'mastered');
      provider.updateMastery('o', 'mastered');
      provider.updateMastery('e', 'mastered');
      expect(provider.isLessonComplete()).toBe(true);
    });
  });

  // ===== 切片10: getAllMasteryStatus() 返回 3 个元音的状态映射 =====
  describe('全部掌握状态', () => {
    test('getAllMasteryStatus() 初始返回 3 个元音均为 new 的映射', () => {
      const provider = createPinyinContentProvider();
      const allStatus = provider.getAllMasteryStatus();
      expect(Object.keys(allStatus).sort()).toEqual(['a', 'e', 'o']);
      expect(allStatus.a).toBe('new');
      expect(allStatus.o).toBe('new');
      expect(allStatus.e).toBe('new');
    });

    test('更新后 getAllMasteryStatus() 反映最新状态', () => {
      const provider = createPinyinContentProvider();
      provider.updateMastery('a', 'mastered');
      provider.updateMastery('o', 'learning');
      const allStatus = provider.getAllMasteryStatus();
      expect(allStatus.a).toBe('mastered');
      expect(allStatus.o).toBe('learning');
      expect(allStatus.e).toBe('new');
    });
  });
});
