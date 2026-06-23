/**
 * AgentBase — 智能体基类
 *
 * 职责：
 * - 生命周期管理（IDLE → READY → RUNNING → READY/ERROR）
 * - 任务执行（通过 executor 函数）
 * - 消息处理（订阅 MessageBus）
 * - 状态管理
 * - 结果累积
 *
 * 接口：
 * - initialize(): 初始化智能体
 * - execute(task): 执行任务
 * - getStatus(): 获取当前状态
 * - getResults(): 获取所有结果
 * - getLastError(): 获取最后错误
 */

const { MESSAGE_TYPES } = require('../message-bus');

const AGENT_STATUS = {
  IDLE: 'idle',
  READY: 'ready',
  RUNNING: 'running',
  ERROR: 'error',
  STOPPED: 'stopped'
};

/**
 * 创建智能体基类实例
 * @param {object} options
 * @param {string} options.id - 智能体 ID
 * @param {string[]} options.capabilities - 能力列表
 * @param {object} options.bus - MessageBus 实例
 * @param {function} [options.executor] - 任务执行函数
 * @param {function} [options.onMessage] - 消息处理函数
 * @param {function} [options.onInitialize] - 初始化函数
 * @returns {object} AgentBase 实例
 */
function createAgentBase(options = {}) {
  const {
    id,
    capabilities = [],
    bus,
    executor,
    onMessage,
    onInitialize
  } = options;

  let status = AGENT_STATUS.IDLE;
  let lastError = null;
  const results = [];
  let unsubscribe = null;

  /**
   * 初始化智能体
   */
  async function initialize() {
    if (onInitialize) {
      await onInitialize();
    }

    if (bus) {
      unsubscribe = bus.subscribe(id, (msg) => {
        if (onMessage) {
          try {
            onMessage(msg);
          } catch (err) {
            console.error(`[Agent:${id}] 消息处理失败: ${err.message}`);
          }
        }
      });
    }

    status = AGENT_STATUS.READY;
  }

  /**
   * 执行任务
   * @param {object} task - 任务对象
   * @returns {Promise<any>} 执行结果
   */
  async function execute(task) {
    if (status !== AGENT_STATUS.READY) {
      throw new Error(`智能体 ${id} 当前状态为 ${status}，无法执行任务`);
    }

    status = AGENT_STATUS.RUNNING;

    try {
      const result = executor ? await executor(task) : { taskId: task.id };
      results.push({ taskId: task.id, ...result });

      if (bus) {
        bus.publish({
          from: id,
          to: 'coordinator',
          type: MESSAGE_TYPES.TASK_COMPLETED,
          payload: { taskId: task.id, result }
        });
      }

      status = AGENT_STATUS.READY;
      return result;
    } catch (err) {
      lastError = err;
      status = AGENT_STATUS.ERROR;

      if (bus) {
        bus.publish({
          from: id,
          to: 'coordinator',
          type: MESSAGE_TYPES.TASK_FAILED,
          payload: { taskId: task.id, error: err.message }
        });
      }

      throw err;
    }
  }

  /**
   * 停止智能体
   */
  function stop() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    status = AGENT_STATUS.STOPPED;
  }

  function getId() { return id; }
  function getStatus() { return status; }
  function getCapabilities() { return [...capabilities]; }
  function getResults() { return [...results]; }
  function getLastError() { return lastError; }

  return {
    initialize,
    execute,
    stop,
    getId,
    getStatus,
    getCapabilities,
    getResults,
    getLastError
  };
}

module.exports = { createAgentBase, AGENT_STATUS };
