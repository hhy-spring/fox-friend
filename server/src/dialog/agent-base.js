/**
 * 多智能体通信协议基类 - Issue #7 每日见面开场
 *
 * 定义多智能体系统的标准化通信协议。
 * 提供创建可基于消息通信的智能体的工厂函数。
 *
 * 协议要素：
 *   - MESSAGE_TYPES：标准化消息类型常量
 *   - createMessage：创建标准化消息（含 id / timestamp）
 *   - createAgent：创建具备任务执行与统计追踪能力的智能体
 *
 * 智能体 execute() 返回统一结果结构：
 *   { taskId, agentName, status: 'success'|'error', output, error, duration }
 */

const crypto = require('crypto');

/**
 * 标准化消息类型
 */
const MESSAGE_TYPES = {
  TASK_REQUEST: 'TASK_REQUEST',
  TASK_RESPONSE: 'TASK_RESPONSE',
  TASK_ERROR: 'TASK_ERROR',
  STATUS_UPDATE: 'STATUS_UPDATE'
};

/**
 * 生成唯一标识符
 * 优先使用 crypto.randomUUID()，不可用时回退到基于计数器与随机数的组合
 * @returns {string}
 */
function generateId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 创建标准化消息
 * @param {string} type - 消息类型（参考 MESSAGE_TYPES）
 * @param {string} agentName - 发送方智能体名称
 * @param {*} payload - 消息载荷
 * @returns {{ id: string, type: string, agentName: string, payload: *, timestamp: number }}
 */
function createMessage(type, agentName, payload) {
  return {
    id: generateId(),
    type,
    agentName,
    payload,
    timestamp: Date.now()
  };
}

/**
 * 创建智能体
 * @param {object} options
 * @param {string} options.name - 智能体名称
 * @param {function} options.taskHandler - 任务处理函数 (input) => output | Promise<output>
 * @returns {{ execute: function, getInfo: function, reset: function }}
 */
function createAgent({ name, taskHandler }) {
  let tasksCompleted = 0;
  let tasksFailed = 0;
  let lastError = null;

  /**
   * 执行任务（用协议包装 handler 调用）
   * @param {*} input - 任务输入
   * @returns {Promise<{ taskId: string, agentName: string, status: string, output: *, error: *, duration: number }>}
   */
  async function execute(input) {
    const taskId = generateId();
    const start = Date.now();

    try {
      const output = await taskHandler(input);
      const duration = Date.now() - start;
      tasksCompleted += 1;
      return {
        taskId,
        agentName: name,
        status: 'success',
        output,
        error: null,
        duration
      };
    } catch (err) {
      const duration = Date.now() - start;
      tasksFailed += 1;
      lastError = err && err.message ? err.message : err;
      return {
        taskId,
        agentName: name,
        status: 'error',
        output: null,
        error: lastError,
        duration
      };
    }
  }

  /**
   * 获取智能体信息与统计
   * @returns {{ name: string, tasksCompleted: number, tasksFailed: number, lastError: * }}
   */
  function getInfo() {
    return {
      name,
      tasksCompleted,
      tasksFailed,
      lastError
    };
  }

  /**
   * 重置统计信息
   */
  function reset() {
    tasksCompleted = 0;
    tasksFailed = 0;
    lastError = null;
  }

  return { execute, getInfo, reset };
}

module.exports = {
  MESSAGE_TYPES,
  createMessage,
  createAgent
};
