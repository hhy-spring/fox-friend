/**
 * 搞笑任务池测试 - Issue #9 借分契约机制
 *
 * 参考PRD §4.3 借分契约
 *   当孩子输了对赌 → 陪小狐狸做搞笑任务
 *   核心设计约束：搞笑任务不涉及惩罚，保持在关系内的游戏化互动
 *
 * 测试覆盖（TDD 垂直切片，逐步追加）：
 *   - 任务池规模（至少5种事件类型）
 *   - 随机任务返回有效结构
 *   - 不重复选择
 *   - 重置已使用记录
 *   - 按ID查询
 *   - 边界情况
 */

const {
  createFunnyTaskPool,
  FUNNY_TASKS
} = require('../../src/dialog/funny-task-pool');

describe('FunnyTaskPool - 搞笑任务池 (Issue #9)', () => {
  describe('任务池规模', () => {
    test('1. FUNNY_TASKS 至少包含 5 个任务（满足5种事件类型约束）', () => {
      expect(Array.isArray(FUNNY_TASKS)).toBe(true);
      expect(FUNNY_TASKS.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('工厂函数', () => {
    test('2. createFunnyTaskPool 返回实例，含全部预期方法', () => {
      const pool = createFunnyTaskPool();
      expect(pool).not.toBeNull();
      expect(typeof pool.getRandomTask).toBe('function');
      expect(typeof pool.getAllTasks).toBe('function');
      expect(typeof pool.getTaskById).toBe('function');
      expect(typeof pool.reset).toBe('function');
      expect(typeof pool.getTaskCount).toBe('function');
      expect(typeof pool.hasUnusedTasks).toBe('function');
    });
  });

  describe('随机任务', () => {
    test('3. getRandomTask 返回包含 id/name/description/emoji 的有效任务对象', () => {
      const pool = createFunnyTaskPool();
      const task = pool.getRandomTask();
      expect(task).not.toBeNull();
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('name');
      expect(task).toHaveProperty('description');
      expect(task).toHaveProperty('emoji');
      // id 应是 FUNNY_TASKS 中已定义的某个 id
      const validIds = FUNNY_TASKS.map(t => t.id);
      expect(validIds).toContain(task.id);
    });
  });

  describe('全部任务查询', () => {
    test('4. getAllTasks 返回全部任务，数量与 FUNNY_TASKS 一致', () => {
      const pool = createFunnyTaskPool();
      const all = pool.getAllTasks();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBe(FUNNY_TASKS.length);
      // 每个任务结构完整
      all.forEach(t => {
        expect(t).toHaveProperty('id');
        expect(t).toHaveProperty('name');
        expect(t).toHaveProperty('description');
        expect(t).toHaveProperty('emoji');
      });
    });
  });

  describe('任务数量', () => {
    test('5. getTaskCount 返回 6（共6种搞笑任务）', () => {
      const pool = createFunnyTaskPool();
      expect(pool.getTaskCount()).toBe(6);
    });
  });

  describe('按ID查询', () => {
    test('6. getTaskById 返回指定ID的任务，字段与 FUNNY_TASKS 一致', () => {
      const pool = createFunnyTaskPool();
      const task = pool.getTaskById('duck_walk');
      expect(task).not.toBeNull();
      expect(task.id).toBe('duck_walk');
      expect(task.name).toBe('学小鸭子走路');
      expect(task.description).toContain('小鸭子');
      expect(task.emoji).toBe('🦆');
    });
  });

  describe('未使用任务检查', () => {
    test('7. 新建任务池 hasUnusedTasks 初始为 true', () => {
      const pool = createFunnyTaskPool();
      expect(pool.hasUnusedTasks()).toBe(true);
    });
  });

  describe('不重复选择', () => {
    test('8. 同一会话内连续 getRandomTask 返回的任务 id 互不重复', () => {
      const pool = createFunnyTaskPool();
      const count = pool.getTaskCount();
      const pickedIds = [];
      for (let i = 0; i < count; i++) {
        const task = pool.getRandomTask();
        expect(task).not.toBeNull();
        // 本次选出的 id 不应与之前已选的重复
        expect(pickedIds).not.toContain(task.id);
        pickedIds.push(task.id);
      }
      // 选完全部后，已选数量应等于任务总数
      expect(pickedIds.length).toBe(count);
    });
  });

  describe('重置已使用记录', () => {
    test('9. reset 后 hasUnusedTasks 恢复为 true，且可重新选择任务', () => {
      const pool = createFunnyTaskPool();
      // 先消耗一个任务
      const first = pool.getRandomTask();
      expect(first).not.toBeNull();
      // 重置
      pool.reset();
      // 重置后应仍有未使用任务
      expect(pool.hasUnusedTasks()).toBe(true);
      // 重置后可再次选出任务（且可能选出之前用过的）
      const after = pool.getRandomTask();
      expect(after).not.toBeNull();
    });

    test('9b. reset 后可重新选完全部任务（数量恢复）', () => {
      const pool = createFunnyTaskPool();
      const count = pool.getTaskCount();
      // 先选完全部
      for (let i = 0; i < count; i++) {
        pool.getRandomTask();
      }
      // 此时已无未使用任务
      expect(pool.hasUnusedTasks()).toBe(false);
      // 重置
      pool.reset();
      // 重置后可再次选完全部
      const pickedIds = [];
      for (let i = 0; i < count; i++) {
        const task = pool.getRandomTask();
        expect(task).not.toBeNull();
        expect(pickedIds).not.toContain(task.id);
        pickedIds.push(task.id);
      }
      expect(pickedIds.length).toBe(count);
    });
  });

  describe('边界情况', () => {
    test('10. 全部任务用完后 getRandomTask 返回 null，hasUnusedTasks 为 false', () => {
      const pool = createFunnyTaskPool();
      const count = pool.getTaskCount();
      // 选完全部任务
      for (let i = 0; i < count; i++) {
        const task = pool.getRandomTask();
        expect(task).not.toBeNull();
      }
      // 再选应返回 null
      expect(pool.getRandomTask()).toBeNull();
      expect(pool.hasUnusedTasks()).toBe(false);
    });

    test('11. getTaskById 传入不存在的 id 时返回 null', () => {
      const pool = createFunnyTaskPool();
      expect(pool.getTaskById('not_exist_id')).toBeNull();
    });

    test('12. 多个实例之间互不影响（各自维护已使用记录）', () => {
      const poolA = createFunnyTaskPool();
      const poolB = createFunnyTaskPool();
      // A 选一个任务
      const taskA = poolA.getRandomTask();
      expect(taskA).not.toBeNull();
      // B 不受 A 影响，仍可选完全部
      const count = poolB.getTaskCount();
      const pickedIds = [];
      for (let i = 0; i < count; i++) {
        const task = poolB.getRandomTask();
        expect(task).not.toBeNull();
        expect(pickedIds).not.toContain(task.id);
        pickedIds.push(task.id);
      }
      expect(pickedIds.length).toBe(count);
    });
  });
});
