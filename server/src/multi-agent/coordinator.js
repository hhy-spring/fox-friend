/**
 * Coordinator — 中央协调模块
 *
 * 职责：
 * - 任务拆解（将主任务分解为子任务）
 * - 依赖关系分析（识别并行/顺序任务）
 * - 优先级排序
 * - 并行/顺序执行调度
 * - 结果集成
 * - 异常处理（单任务失败不阻塞其他任务）
 * - 进度监控
 *
 * 架构：
 *   ┌──────────────┐
 *   │  Coordinator  │
 *   │  - decompose  │
 *   │  - schedule   │
 *   │  - execute    │
 *   │  - integrate  │
 *   └──────┬───────┘
 *          │
 *   ┌──────┴───────┐
 *   │  Agent Pool   │
 *   │  [A1, A2, A3] │
 *   └──────────────┘
 */

const { v4: uuidv4 } = require('uuid');

const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * 创建协调器
 * @param {object} options
 * @param {object} options.bus - MessageBus 实例
 * @param {array} [options.agents] - 可用智能体列表
 * @returns {object} Coordinator 实例
 */
function createCoordinator(options = {}) {
  const { bus, agents = [] } = options;
  const agentPool = [...agents];
  const progress = { total: 0, completed: 0, failed: 0, running: 0 };

  /**
   * 注册智能体
   * @param {object} agent - 智能体实例
   */
  function registerAgent(agent) {
    agentPool.push(agent);
  }

  /**
   * 任务拆解
   * @param {object} mainTask - 主任务
   * @returns {array} 子任务列表
   */
  function decompose(mainTask) {
    const { components = [], goal } = mainTask;

    return components.map((component, index) => ({
      id: `task-${uuidv4().slice(0, 8)}`,
      type: goal || 'build',
      payload: { component },
      dependencies: [],
      priority: index + 1
    }));
  }

  /**
   * 获取可并行执行的任务（无依赖或依赖已完成）
   * @param {array} tasks - 所有任务
   * @param {Set} completedIds - 已完成的任务 ID
   * @returns {array} 可并行执行的任务
   */
  function getParallelTasks(tasks, completedIds = new Set()) {
    return tasks.filter(task =>
      task.dependencies.every(dep => completedIds.has(dep))
    );
  }

  /**
   * 按优先级排序任务
   * @param {array} tasks - 任务列表
   * @returns {array} 排序后的任务
   */
  function sortByPriority(tasks) {
    return [...tasks].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  /**
   * 获取可用的智能体
   * @returns {object|null} 可用智能体
   */
  function getAvailableAgent() {
    return agentPool.find(agent => agent.getStatus() === 'ready') || null;
  }

  /**
   * 执行单个任务
   * @param {object} task - 任务
   * @returns {Promise<object>} 执行结果
   */
  async function executeSingleTask(task) {
    const agent = getAvailableAgent();
    if (!agent) {
      progress.failed++;
      return { taskId: task.id, error: '无可用智能体', status: TASK_STATUS.FAILED };
    }

    try {
      progress.running++;
      const result = await agent.execute(task);
      progress.running--;
      progress.completed++;
      return { taskId: task.id, ...result, status: TASK_STATUS.COMPLETED };
    } catch (err) {
      progress.running--;
      progress.failed++;
      return { taskId: task.id, error: err.message, status: TASK_STATUS.FAILED };
    }
  }

  /**
   * 获取可用智能体数量
   * @returns {number} 可用智能体数量
   */
  function getAvailableAgentCount() {
    return agentPool.filter(agent => agent.getStatus() === 'ready').length;
  }

  /**
   * 执行所有任务（自动处理依赖关系）
   * @param {array} tasks - 任务列表
   * @returns {Promise<array>} 所有任务结果
   */
  async function executeTasks(tasks) {
    progress.total = tasks.length;
    progress.completed = 0;
    progress.failed = 0;
    progress.running = 0;

    const results = [];
    const completedIds = new Set();
    const remaining = [...tasks];

    while (remaining.length > 0) {
      // 获取当前可执行的任务
      const executable = getParallelTasks(remaining, completedIds);
      if (executable.length === 0) {
        break;
      }

      // 按优先级排序
      const sorted = sortByPriority(executable);

      // 分批执行：每批最多使用可用智能体数量
      while (sorted.length > 0) {
        const availableCount = Math.max(1, getAvailableAgentCount());
        const batch = sorted.splice(0, availableCount);

        const batchResults = await Promise.all(
          batch.map(task => executeSingleTask(task))
        );

        results.push(...batchResults);

        // 标记完成的任务
        for (const result of batchResults) {
          if (result.status === TASK_STATUS.COMPLETED) {
            completedIds.add(result.taskId);
          }
        }

        // 从剩余任务中移除已处理的
        const processedIds = new Set(batch.map(t => t.id));
        for (let i = remaining.length - 1; i >= 0; i--) {
          if (processedIds.has(remaining[i].id)) {
            remaining.splice(i, 1);
          }
        }
      }
    }

    return results;
  }

  /**
   * 集成所有子任务结果
   * @param {array} results - 所有任务结果
   * @returns {object} 集成后的完整结果
   */
  function integrateResults(results) {
    const components = results
      .filter(r => r.status !== TASK_STATUS.FAILED)
      .map(r => ({
        component: r.component,
        ...(r.html ? { html: r.html } : {}),
        ...(r.output ? { output: r.output } : {})
      }));

    const errors = results
      .filter(r => r.status === TASK_STATUS.FAILED)
      .map(r => ({ taskId: r.taskId, error: r.error }));

    return {
      components,
      errors,
      totalComponents: components.length,
      totalErrors: errors.length
    };
  }

  /**
   * 获取执行进度
   * @returns {object} 进度信息
   */
  function getProgress() {
    return { ...progress };
  }

  return {
    registerAgent,
    decompose,
    getParallelTasks,
    executeTasks,
    integrateResults,
    getProgress
  };
}

module.exports = { createCoordinator, TASK_STATUS };
