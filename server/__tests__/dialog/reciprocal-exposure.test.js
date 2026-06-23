/**
 * 互惠暴露管理器测试 - Issue #10 关系保鲜机制
 *
 * 参考Issue #10 验收标准：
 *   - 互惠暴露：session_count % 5 == 0 → 小狐狸主动分享秘密或脆弱
 *   - 互惠暴露台词不重复，至少 10 个候选池随机选
 *   - 所有保鲜机制不与教学内容冲突，嵌入在对话开场或结尾
 *
 * TDD 测试覆盖（按实现顺序）：
 *   1. shouldTrigger 在 sessionCount % 5 === 0 时返回 true
 *   2. shouldTrigger 在 sessionCount % 5 !== 0 时返回 false
 *   3. shouldTrigger 在 sessionCount 为 0 时返回 false
 *   4. generateExposure 在应触发时返回 triggered 与暴露文本
 *   5. generateExposure 在不应触发时返回 not triggered
 *   6. 暴露候选池至少有 10 条台词
 *   7. getUnusedExposures 过滤掉已使用的暴露
 *   8. generateExposure 不重复最近使用的暴露
 *   9. generateExposure 返回 poolSize 信息
 *  10. generateExposure 在所有暴露都用过时回绕重置
 */

const {
  createReciprocalExposureManager
} = require('../../src/dialog/reciprocal-exposure');

describe('ReciprocalExposureManager - 互惠暴露管理器 (Issue #10)', () => {
  describe('1. shouldTrigger - sessionCount % 5 === 0 时返回 true', () => {
    test('sessionCount 为 5 时应返回 true', () => {
      const manager = createReciprocalExposureManager();
      expect(manager.shouldTrigger(5)).toBe(true);
    });

    test('sessionCount 为 10 时应返回 true', () => {
      const manager = createReciprocalExposureManager();
      expect(manager.shouldTrigger(10)).toBe(true);
    });

    test('sessionCount 为 15 时应返回 true', () => {
      const manager = createReciprocalExposureManager();
      expect(manager.shouldTrigger(15)).toBe(true);
    });

    test('sessionCount 为 20 时应返回 true', () => {
      const manager = createReciprocalExposureManager();
      expect(manager.shouldTrigger(20)).toBe(true);
    });
  });

  describe('2. shouldTrigger - sessionCount % 5 !== 0 时返回 false', () => {
    test('sessionCount 为 1~4 时应返回 false', () => {
      const manager = createReciprocalExposureManager();
      expect(manager.shouldTrigger(1)).toBe(false);
      expect(manager.shouldTrigger(2)).toBe(false);
      expect(manager.shouldTrigger(3)).toBe(false);
      expect(manager.shouldTrigger(4)).toBe(false);
    });

    test('sessionCount 为 6~9 时应返回 false', () => {
      const manager = createReciprocalExposureManager();
      expect(manager.shouldTrigger(6)).toBe(false);
      expect(manager.shouldTrigger(7)).toBe(false);
      expect(manager.shouldTrigger(8)).toBe(false);
      expect(manager.shouldTrigger(9)).toBe(false);
    });
  });

  describe('3. shouldTrigger - sessionCount 为 0 时返回 false', () => {
    test('sessionCount 为 0 时应返回 false（避免首次见面即触发）', () => {
      const manager = createReciprocalExposureManager();
      expect(manager.shouldTrigger(0)).toBe(false);
    });
  });

  describe('4. generateExposure - 应触发时返回 triggered 与暴露文本', () => {
    test('sessionCount 为 5 时返回 triggered: true 且 exposureText 非空', () => {
      const manager = createReciprocalExposureManager();
      const result = manager.generateExposure(5, []);
      expect(result.triggered).toBe(true);
      expect(typeof result.exposureText).toBe('string');
      expect(result.exposureText.length).toBeGreaterThan(0);
    });

    test('触发时应返回有效的 exposureId', () => {
      const manager = createReciprocalExposureManager();
      const result = manager.generateExposure(5, []);
      expect(result.triggered).toBe(true);
      expect(typeof result.exposureId).toBe('string');
      expect(result.exposureId.length).toBeGreaterThan(0);
    });

    test('返回的 exposureText 应在候选池中', () => {
      const manager = createReciprocalExposureManager();
      const pool = manager.getExposurePool();
      const result = manager.generateExposure(5, []);
      expect(pool).toContain(result.exposureText);
    });
  });

  describe('5. generateExposure - 不应触发时返回 not triggered', () => {
    test('sessionCount 为 3 时返回 triggered: false', () => {
      const manager = createReciprocalExposureManager();
      const result = manager.generateExposure(3, []);
      expect(result.triggered).toBe(false);
    });

    test('sessionCount 为 0 时返回 triggered: false', () => {
      const manager = createReciprocalExposureManager();
      const result = manager.generateExposure(0, []);
      expect(result.triggered).toBe(false);
    });

    test('非触发时 exposureText 应为空字符串', () => {
      const manager = createReciprocalExposureManager();
      const result = manager.generateExposure(3, []);
      expect(result.exposureText).toBe('');
    });

    test('非触发时 exposureId 应为空字符串', () => {
      const manager = createReciprocalExposureManager();
      const result = manager.generateExposure(3, []);
      expect(result.exposureId).toBe('');
    });
  });

  describe('6. 暴露候选池至少有 10 条台词', () => {
    test('getExposurePool 返回的数组长度 >= 10', () => {
      const manager = createReciprocalExposureManager();
      const pool = manager.getExposurePool();
      expect(pool.length).toBeGreaterThanOrEqual(10);
    });

    test('候选池中每条台词都应为非空字符串', () => {
      const manager = createReciprocalExposureManager();
      const pool = manager.getExposurePool();
      pool.forEach(text => {
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      });
    });
  });

  describe('7. getUnusedExposures - 过滤掉已使用的暴露', () => {
    test('传入空数组时返回全部候选池', () => {
      const manager = createReciprocalExposureManager();
      const pool = manager.getExposurePool();
      const unused = manager.getUnusedExposures([]);
      expect(unused).toEqual(pool);
    });

    test('传入部分已使用 id 时返回剩余未使用台词', () => {
      const manager = createReciprocalExposureManager();
      const pool = manager.getExposurePool();
      // 使用前3个id作为已使用
      const usedIds = pool.slice(0, 3).map((_, i) => `exposure_${i}`);
      const unused = manager.getUnusedExposures(usedIds);
      expect(unused.length).toBe(pool.length - 3);
    });
  });

  describe('8. generateExposure - 不重复最近使用的暴露', () => {
    test('连续触发时不会返回已使用的暴露', () => {
      const manager = createReciprocalExposureManager();
      const usedExposureIds = [];

      // 模拟连续3次触发（session 5, 10, 15）
      const result1 = manager.generateExposure(5, usedExposureIds);
      usedExposureIds.push(result1.exposureId);

      const result2 = manager.generateExposure(10, usedExposureIds);
      usedExposureIds.push(result2.exposureId);

      const result3 = manager.generateExposure(15, usedExposureIds);
      usedExposureIds.push(result3.exposureId);

      // 三次结果应互不相同
      const ids = [result1.exposureId, result2.exposureId, result3.exposureId];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('9. generateExposure - 返回 poolSize 信息', () => {
    test('触发时 poolSize 应等于候选池大小', () => {
      const manager = createReciprocalExposureManager();
      const pool = manager.getExposurePool();
      const result = manager.generateExposure(5, []);
      expect(result.poolSize).toBe(pool.length);
    });

    test('非触发时 poolSize 也应等于候选池大小', () => {
      const manager = createReciprocalExposureManager();
      const pool = manager.getExposurePool();
      const result = manager.generateExposure(3, []);
      expect(result.poolSize).toBe(pool.length);
    });
  });

  describe('10. generateExposure - 所有暴露都用过时回绕重置', () => {
    test('当 usedExposures 包含所有 id 时，仍能返回有效暴露', () => {
      const manager = createReciprocalExposureManager();
      const pool = manager.getExposurePool();
      // 构造全部已使用的 id 列表
      const allUsedIds = [];
      for (let i = 0; i < pool.length; i++) {
        allUsedIds.push(`exposure_${i}`);
      }

      const result = manager.generateExposure(5, allUsedIds);
      expect(result.triggered).toBe(true);
      expect(typeof result.exposureText).toBe('string');
      expect(result.exposureText.length).toBeGreaterThan(0);
      expect(typeof result.exposureId).toBe('string');
      expect(result.exposureId.length).toBeGreaterThan(0);
    });
  });
});
