/**
 * 多智能体协调器 - 中央协调模块
 *
 * 参考技术架构执行摘要§三「对话引擎架构」FSM Router 模式
 *
 * 职责：
 *   1. 任务拆解与依赖分析
 *   2. 智能体调度与并行执行
 *   3. 状态监控与异常处理
 *   4. 结果集成与版本控制
 *
 * 性能目标（Issue #23 要求）：
 *   - 执行速度比单智能体方案提升 ≥50%
 *   - 任务处理准确性 ≥99.5%
 *   - 结果完整性 100%
 *   - CPU 峰值 ≤80%
 */

const { createMessageBus, MESSAGE_TYPES } = require('./message-bus');

/**
 * 任务状态枚举
 */
const TASK_STATES = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED'
};

/**
 * 创建协调器
 * @param {object} options
 * @param {number} [options.maxConcurrency=4] - 最大并发数
 * @returns {object} 协调器实例
 */
function createCoordinator(options = {}) {
  const maxConcurrency = options.maxConcurrency || 4;
  const messageBus = createMessageBus();
  const agents = new Map();
  const tasks = new Map();
  const results = new Map();
  const stateSnapshots = [];

  /**
   * 注册智能体
   * @param {object} agent - 智能体实例 { id, name, execute }
   */
  function registerAgent(agent) {
    agents.set(agent.id, agent);
    messageBus.subscribe(agent.id, (message) => {
      if (message.type === MESSAGE_TYPES.TASK_ASSIGN && message.to === agent.id) {
        handleAgentTask(agent, message);
      }
    });
  }

  /**
   * 处理智能体任务
   */
  async function handleAgentTask(agent, message) {
    const task = tasks.get(message.payload.taskId);
    if (!task) return;

    task.state = TASK_STATES.RUNNING;
    task.startedAt = Date.now();

    try {
      const result = await agent.execute(message.payload.input, {
        publish: (type, payload) => messageBus.publish({
          type,
          from: agent.id,
          to: '*',
          payload,
          correlationId: message.correlationId
        }),
        getState: () => getSharedState()
      });

      task.state = TASK_STATES.COMPLETED;
      task.completedAt = Date.now();
      task.durationMs = task.completedAt - task.startedAt;
      results.set(task.id, result);

      // 事件驱动：直接 resolve 等待中的 Promise（替代忙等待轮询）
      if (task.resolve) task.resolve(result);

      messageBus.publish({
        type: MESSAGE_TYPES.TASK_RESULT,
        from: agent.id,
        to: 'coordinator',
        payload: { taskId: task.id, result },
        correlationId: message.correlationId
      });
    } catch (error) {
      task.state = TASK_STATES.FAILED;
      task.error = error.message;
      // 事件驱动：直接 reject 等待中的 Promise
      if (task.reject) task.reject(error);
      messageBus.publishError(agent.id, 'coordinator', error, message.correlationId);
    }
  }

  /**
   * 拆解任务为子任务
   * @param {object} mainTask - 主任务
   * @returns {Array} 子任务列表（含依赖关系）
   */
  function decomposeTask(mainTask) {
    const subtasks = [];

    // 阶段1：诊断（可并行）
    subtasks.push({
      id: 'diagnose-name-detection',
      name: '诊断名字检测逻辑',
      agentId: 'diagnostic-agent',
      dependencies: [],
      priority: 1,
      input: {
        target: 'name-processor.js',
        testInput: mainTask.testInput || '你好小狐狸',
        expectedBehavior: '不应被识别为名字'
      }
    });

    subtasks.push({
      id: 'diagnose-ws-handler',
      name: '诊断 WebSocket 消息结构',
      agentId: 'diagnostic-agent',
      dependencies: [],
      priority: 1,
      input: {
        target: 'ws-voice-handler.js',
        expectedFields: ['showHints', 'hints', 'hintLine'],
        step: 'HELP_REQUEST'
      }
    });

    // 阶段2：修复（依赖诊断）
    subtasks.push({
      id: 'fix-name-detection',
      name: '修复名字检测逻辑',
      agentId: 'fix-agent',
      dependencies: ['diagnose-name-detection'],
      priority: 2,
      input: {
        target: 'name-processor.js',
        fixType: 'greeting-prefix-detection'
      }
    });

    subtasks.push({
      id: 'fix-ws-handler',
      name: '修复 WebSocket 消息结构',
      agentId: 'fix-agent',
      dependencies: ['diagnose-ws-handler'],
      priority: 2,
      input: {
        target: 'ws-voice-handler.js',
        fixType: 'standardize-hint-fields'
      }
    });

    // 阶段3：验证（依赖所有修复）
    subtasks.push({
      id: 'validate-fix',
      name: '验证修复结果',
      agentId: 'validation-agent',
      dependencies: ['fix-name-detection', 'fix-ws-handler'],
      priority: 3,
      input: {
        testFile: 'issue-23-help-request-hints.test.js',
        coverageThreshold: 80
      }
    });

    return subtasks;
  }

  /**
   * 执行任务图（支持并行）
   * @param {Array} subtasks - 子任务列表
   * @returns {Promise<object>} 执行结果
   */
  async function executeTaskGraph(subtasks) {
    const startTime = Date.now();
    const executionLog = [];

    // 按优先级排序
    const sorted = [...subtasks].sort((a, b) => a.priority - b.priority);

    // 分层执行（同层并行）
    const layers = groupByPriority(sorted);

    for (const layer of layers) {
      const layerStart = Date.now();
      const executable = layer.filter(t => areDependenciesMet(t, subtasks));

      // 并行执行同层任务
      const layerResults = await Promise.all(
        executable.map(task => executeSubtask(task))
      );

      executionLog.push({
        priority: layer[0].priority,
        taskCount: executable.length,
        durationMs: Date.now() - layerStart,
        results: layerResults
      });

      // 保存状态快照
      stateSnapshots.push({
        timestamp: Date.now(),
        completedTasks: [...tasks.entries()]
          .filter(([_, t]) => t.state === TASK_STATES.COMPLETED)
          .map(([id, t]) => ({ id, name: t.name, durationMs: t.durationMs }))
      });
    }

    const totalDurationMs = Date.now() - startTime;

    return {
      totalDurationMs,
      executionLog,
      results: Object.fromEntries(results),
      messageLog: messageBus.getMessageLog()
    };
  }

  /**
   * 执行单个子任务（事件驱动，无忙等待轮询）
   */
  async function executeSubtask(task) {
    tasks.set(task.id, {
      id: task.id,
      name: task.name,
      state: TASK_STATES.PENDING,
      createdAt: Date.now()
    });

    const agent = agents.get(task.agentId);
    if (!agent) {
      throw new Error(`智能体 ${task.agentId} 未注册`);
    }

    messageBus.publish({
      type: MESSAGE_TYPES.TASK_ASSIGN,
      from: 'coordinator',
      to: task.agentId,
      payload: { taskId: task.id, input: task.input }
    });

    // 事件驱动：将 resolve/reject 存入 task 对象，由 handleAgentTask 完成时直接调用
    return new Promise((resolve, reject) => {
      const taskEntry = tasks.get(task.id);
      // 若任务已同步完成（边缘情况），直接返回
      if (taskEntry.state === TASK_STATES.COMPLETED) {
        resolve(results.get(task.id));
        return;
      }
      if (taskEntry.state === TASK_STATES.FAILED) {
        reject(new Error(taskEntry.error));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`任务 ${task.id} 超时`));
      }, 30000);
      if (timeout.unref) timeout.unref();

      taskEntry.resolve = (result) => {
        clearTimeout(timeout);
        resolve(result);
      };
      taskEntry.reject = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }

  /**
   * 按优先级分组
   */
  function groupByPriority(subtasks) {
    const groups = {};
    for (const task of subtasks) {
      if (!groups[task.priority]) groups[task.priority] = [];
      groups[task.priority].push(task);
    }
    return Object.values(groups);
  }

  /**
   * 检查依赖是否满足
   */
  function areDependenciesMet(task, allTasks) {
    return task.dependencies.every(depId => {
      const dep = tasks.get(depId);
      return dep && dep.state === TASK_STATES.COMPLETED;
    });
  }

  /**
   * 获取共享状态（用于智能体间状态同步）
   */
  function getSharedState() {
    return {
      tasks: Object.fromEntries(tasks),
      results: Object.fromEntries(results),
      snapshots: stateSnapshots
    };
  }

  /**
   * 集成所有子任务结果
   * @param {object} executionResult - 执行结果
   * @returns {object} 集成后的最终结果
   */
  function integrateResults(executionResult) {
    return {
      success: true,
      totalDurationMs: executionResult.totalDurationMs,
      taskCount: Object.keys(executionResult.results).length,
      results: executionResult.results,
      executionLog: executionResult.executionLog,
      stateSnapshots,
      messageLog: executionResult.messageLog
    };
  }

  return {
    registerAgent,
    decomposeTask,
    executeTaskGraph,
    integrateResults,
    getSharedState,
    messageBus
  };
}

module.exports = { createCoordinator, TASK_STATES };
