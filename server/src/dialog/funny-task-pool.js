/**
 * 搞笑任务池 - Issue #9 借分契约机制
 *
 * 参考PRD §4.3 借分契约
 *   当孩子输了对赌 → 陪小狐狸做搞笑任务
 *   核心设计约束：搞笑任务不涉及惩罚，保持在关系内的游戏化互动
 *
 * 职责：
 *   1. 维护搞笑任务池（至少5种事件类型）
 *   2. 支持随机选择，且同一会话内尽量不重复
 *   3. 任务描述适合4-7岁儿童，语气活泼可爱
 */

// 搞笑任务池
// 参考PRD §4.3：输了→执行搞笑任务（如学小鸭子走路）
// 搞笑任务不涉及惩罚，保持在关系内的游戏化互动
const FUNNY_TASKS = [
  {
    id: 'duck_walk',
    name: '学小鸭子走路',
    description: '你能学小鸭子摇摇摆摆地走路吗？嘎嘎嘎！',
    emoji: '🦆'
  },
  {
    id: 'funny_face',
    name: '做鬼脸',
    description: '我们来比比谁做的鬼脸最搞笑！准备好了吗？',
    emoji: '😜'
  },
  {
    id: 'cat_meow',
    name: '学猫咪叫',
    description: '你能学小猫咪喵喵叫吗？我也要学！',
    emoji: '🐱'
  },
  {
    id: 'wobble_dance',
    name: '摇摆跳舞',
    description: '我们一起摇摇晃晃地跳个舞吧！',
    emoji: '💃'
  },
  {
    id: 'elephant_trunk',
    name: '模仿大象',
    description: '你能学大象甩鼻子吗？嘟嘟嘟！',
    emoji: '🐘'
  },
  {
    id: 'frog_jump',
    name: '学小青蛙跳',
    description: '你能学小青蛙蹦蹦跳吗？呱呱呱！',
    emoji: '🐸'
  }
];

/**
 * 创建搞笑任务池实例
 * 提供随机选择（同一会话内尽量不重复）、查询、重置等能力
 * @returns {object} 搞笑任务池实例
 */
function createFunnyTaskPool() {
  // 已使用任务ID集合（同一会话内不重复选择）
  const usedIds = new Set();

  return {
    getRandomTask() {
      // 优先从未使用的任务中随机选择，保证同一会话内尽量不重复
      const available = FUNNY_TASKS.filter(t => !usedIds.has(t.id));
      if (available.length === 0) {
        return null;
      }
      const idx = Math.floor(Math.random() * available.length);
      const task = available[idx];
      usedIds.add(task.id);
      return task;
    },
    getAllTasks() {
      return FUNNY_TASKS;
    },
    getTaskById(id) {
      return FUNNY_TASKS.find(t => t.id === id) || null;
    },
    reset() {
      usedIds.clear();
    },
    getTaskCount() {
      return FUNNY_TASKS.length;
    },
    hasUnusedTasks() {
      return usedIds.size < FUNNY_TASKS.length;
    }
  };
}

module.exports = {
  FUNNY_TASKS,
  createFunnyTaskPool
};
