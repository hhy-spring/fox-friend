/**
 * 惊喜时刻管理器测试 - Issue #10 关系保鲜机制
 *
 * 参考Issue #10 验收标准：
 *   - 惊喜时刻：随机概率触发（约每 5-8 次一次），做出乎意料的事
 *     （如画幅画、讲个笑话、给个虚拟贴纸）
 *   - 惊喜时刻至少有 5 种不同事件类型
 *   - 所有保鲜机制不与教学内容冲突，嵌入在对话开场或结尾
 *
 * TDD 垂直切片测试覆盖：
 *   1. shouldTrigger 返回 true 当随机值低于阈值
 *   2. shouldTrigger 返回 false 当随机值高于阈值
 *   3. shouldTrigger 返回 false 当 sessionCount < 2
 *   4. getSurpriseTypes 至少返回 5 种类型
 *   5. getSurprisePool 返回所有惊喜事件
 *   6. generateSurprise 触发时返回有效惊喜
 *   7. generateSurprise 未触发时返回 not triggered
 *   8. generateSurprise 不同调用返回不同惊喜类型
 *   9. generateSurprise 包含 childProfile 昵称
 *   10. generateSurprise 返回 surpriseType 和 surpriseId
 *   11. 自定义 rng 函数被用于随机性
 */

const {
  createSurpriseMomentManager
} = require('../../src/dialog/surprise-moment');

describe('SurpriseMomentManager - 惊喜时刻管理器 (Issue #10)', () => {
  describe('shouldTrigger - 概率触发逻辑', () => {
    test('1. shouldTrigger 返回 true 当随机值低于阈值', () => {
      // 使用自定义 rng 返回极小值，确保触发
      const manager = createSurpriseMomentManager({ rng: () => 0.01 });
      expect(manager.shouldTrigger(3)).toBe(true);
    });

    test('2. shouldTrigger 返回 false 当随机值高于阈值', () => {
      // 使用自定义 rng 返回较大值，确保不触发
      const manager = createSurpriseMomentManager({ rng: () => 0.99 });
      expect(manager.shouldTrigger(3)).toBe(false);
    });

    test('3. shouldTrigger 返回 false 当 sessionCount < 2', () => {
      // 即使随机值极小，首次见面也不触发
      const manager = createSurpriseMomentManager({ rng: () => 0 });
      expect(manager.shouldTrigger(0)).toBe(false);
      expect(manager.shouldTrigger(1)).toBe(false);
    });

    test('3b. shouldTrigger 返回 true 当 sessionCount >= 2 且随机值低', () => {
      const manager = createSurpriseMomentManager({ rng: () => 0.01 });
      expect(manager.shouldTrigger(2)).toBe(true);
      expect(manager.shouldTrigger(5)).toBe(true);
    });
  });

  describe('getSurpriseTypes - 事件类型清单', () => {
    test('4. getSurpriseTypes 至少返回 5 种类型（满足验收标准）', () => {
      const manager = createSurpriseMomentManager();
      const types = manager.getSurpriseTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThanOrEqual(5);
    });

    test('4b. getSurpriseTypes 包含预期的 6 种事件类型', () => {
      const manager = createSurpriseMomentManager();
      const types = manager.getSurpriseTypes();
      expect(types).toContain('draw_picture');
      expect(types).toContain('tell_joke');
      expect(types).toContain('give_sticker');
      expect(types).toContain('sing_song');
      expect(types).toContain('share_treasure');
      expect(types).toContain('do_magic');
    });
  });

  describe('getSurprisePool - 惊喜事件池', () => {
    test('5. getSurprisePool 返回所有惊喜事件', () => {
      const manager = createSurpriseMomentManager();
      const pool = manager.getSurprisePool();
      expect(Array.isArray(pool)).toBe(true);
      // 至少 5 种事件
      expect(pool.length).toBeGreaterThanOrEqual(5);
      // 每个事件包含 type 和 texts 字段
      pool.forEach(event => {
        expect(event).toHaveProperty('type');
        expect(typeof event.type).toBe('string');
        expect(event).toHaveProperty('texts');
        expect(Array.isArray(event.texts)).toBe(true);
        // 每种类型至少 2 个文本变体
        expect(event.texts.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('generateSurprise - 生成惊喜', () => {
    test('6. generateSurprise 触发时返回有效惊喜', () => {
      // rng 返回 0 确保触发（0 < 1/6）
      const manager = createSurpriseMomentManager({ rng: () => 0 });
      const result = manager.generateSurprise(3, { nickname: '小明' });
      expect(result.triggered).toBe(true);
      expect(result.surpriseType).toBeDefined();
      expect(result.surpriseText).toBeDefined();
      expect(result.surpriseId).toBeDefined();
      expect(typeof result.surpriseType).toBe('string');
      expect(typeof result.surpriseText).toBe('string');
      expect(typeof result.surpriseId).toBe('string');
    });

    test('7. generateSurprise 未触发时返回 not triggered', () => {
      // rng 返回 0.99 确保不触发
      const manager = createSurpriseMomentManager({ rng: () => 0.99 });
      const result = manager.generateSurprise(3, { nickname: '小明' });
      expect(result.triggered).toBe(false);
      expect(result.surpriseType).toBe('');
      expect(result.surpriseText).toBe('');
      expect(result.surpriseId).toBe('');
    });

    test('8. generateSurprise 不同调用返回不同惊喜类型', () => {
      // 收集多次触发的类型，验证存在多样性
      const types = new Set();
      // 通过不同 rng 返回值模拟多次随机触发
      for (let i = 0; i < 50; i++) {
        const manager = createSurpriseMomentManager();
        // 使用 Math.random，多次调用期望获得不同类型
        const result = manager.generateSurprise(5, { nickname: '小明' });
        if (result.triggered) {
          types.add(result.surpriseType);
        }
      }
      // 在 50 次随机调用中，至少应出现 2 种不同类型
      expect(types.size).toBeGreaterThanOrEqual(2);
    });

    test('9. generateSurprise 包含 childProfile 昵称', () => {
      const manager = createSurpriseMomentManager({ rng: () => 0 });
      const result = manager.generateSurprise(3, { nickname: '小花' });
      expect(result.triggered).toBe(true);
      expect(result.surpriseText).toContain('小花');
    });

    test('10. generateSurprise 返回 surpriseType 和 surpriseId', () => {
      const manager = createSurpriseMomentManager({ rng: () => 0 });
      const result = manager.generateSurprise(3, { nickname: '小明' });
      expect(result.triggered).toBe(true);
      // surpriseType 应是已知类型之一
      const validTypes = manager.getSurpriseTypes();
      expect(validTypes).toContain(result.surpriseType);
      // surpriseId 应以 surprise- 开头
      expect(result.surpriseId).toMatch(/^surprise-\d+$/);
    });

    test('10b. generateSurprise 多次触发时 surpriseId 递增', () => {
      const manager = createSurpriseMomentManager({ rng: () => 0 });
      const result1 = manager.generateSurprise(3, { nickname: '小明' });
      const result2 = manager.generateSurprise(3, { nickname: '小明' });
      expect(result1.surpriseId).not.toBe(result2.surpriseId);
    });
  });

  describe('自定义 rng 函数', () => {
    test('11. 自定义 rng 函数被用于随机性', () => {
      let callCount = 0;
      const customRng = () => {
        callCount++;
        return 0.01; // 返回小值确保触发
      };
      const manager = createSurpriseMomentManager({ rng: customRng });
      manager.shouldTrigger(3);
      expect(callCount).toBeGreaterThan(0);
    });

    test('11b. 不传 rng 时默认使用 Math.random', () => {
      const manager = createSurpriseMomentManager();
      // 多次调用应返回 boolean 且不抛错
      for (let i = 0; i < 20; i++) {
        const result = manager.shouldTrigger(5);
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('边界情况', () => {
    test('childProfile 为 null 时使用默认昵称', () => {
      const manager = createSurpriseMomentManager({ rng: () => 0 });
      const result = manager.generateSurprise(3, null);
      expect(result.triggered).toBe(true);
      // 默认昵称应为"小伙伴"
      expect(result.surpriseText).toContain('小伙伴');
    });

    test('childProfile 缺少 nickname 时使用默认昵称', () => {
      const manager = createSurpriseMomentManager({ rng: () => 0 });
      const result = manager.generateSurprise(3, {});
      expect(result.triggered).toBe(true);
      expect(result.surpriseText).toContain('小伙伴');
    });

    test('sessionCount 刚好为 2 时可以触发', () => {
      const manager = createSurpriseMomentManager({ rng: () => 0.01 });
      expect(manager.shouldTrigger(2)).toBe(true);
    });
  });
});
