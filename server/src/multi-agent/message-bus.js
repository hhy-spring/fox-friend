/**
 * 多智能体消息总线 - 标准化智能体间通信协议
 *
 * 参考技术架构执行摘要§三「对话引擎架构」
 *
 * 通信协议规范：
 *   - 消息格式：{ id, type, from, to, payload, timestamp, correlationId }
 *   - 传输方式：同步事件发射器（MVP 阶段），可扩展为异步队列
 *   - 错误处理：消息携带 error 字段，接收方负责处理
 *
 * Issue #23: 步骤2求助台词和暗示选项消息结构修复
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * 消息类型枚举
 */
const MESSAGE_TYPES = {
  TASK_ASSIGN: 'TASK_ASSIGN',        // 任务分配
  TASK_RESULT: 'TASK_RESULT',        // 任务结果
  TASK_ERROR: 'TASK_ERROR',          // 任务错误
  STATE_SYNC: 'STATE_SYNC',          // 状态同步
  COORDINATION: 'COORDINATION',      // 协调指令
  VALIDATION: 'VALIDATION'           // 验证请求
};

/**
 * 创建消息总线
 * @returns {object} 消息总线实例
 */
function createMessageBus() {
  const emitter = new EventEmitter();
  const messageLog = [];
  const subscriptions = new Map();

  /**
   * 发布消息
   * @param {object} params
   * @param {string} params.type - 消息类型
   * @param {string} params.from - 发送方智能体 ID
   * @param {string} params.to - 接收方智能体 ID（'*' 表示广播）
   * @param {object} params.payload - 消息内容
   * @param {string} [params.correlationId] - 关联 ID（用于请求-响应模式）
   * @returns {string} 消息 ID
   */
  function publish({ type, from, to, payload, correlationId }) {
    const message = {
      id: uuidv4(),
      type,
      from,
      to,
      payload,
      timestamp: Date.now(),
      correlationId: correlationId || uuidv4(),
      error: null
    };

    messageLog.push(message);

    // 定向发送
    if (to !== '*') {
      const handler = subscriptions.get(to);
      if (handler) {
        handler(message);
      }
    } else {
      // 广播
      for (const handler of subscriptions.values()) {
        handler(message);
      }
    }

    emitter.emit('message', message);
    return message.id;
  }

  /**
   * 订阅消息
   * @param {string} agentId - 智能体 ID
   * @param {function} handler - 消息处理函数
   */
  function subscribe(agentId, handler) {
    subscriptions.set(agentId, handler);
  }

  /**
   * 发布错误消息
   * @param {string} from - 发送方
   * @param {string} to - 接收方
   * @param {Error} error - 错误对象
   * @param {string} [correlationId] - 关联 ID
   */
  function publishError(from, to, error, correlationId) {
    const message = {
      id: uuidv4(),
      type: MESSAGE_TYPES.TASK_ERROR,
      from,
      to,
      payload: {},
      timestamp: Date.now(),
      correlationId: correlationId || uuidv4(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };
    messageLog.push(message);

    const handler = subscriptions.get(to);
    if (handler) {
      handler(message);
    }
    emitter.emit('error', message);
  }

  /**
   * 获取消息日志（用于版本控制和追踪）
   * @returns {Array}
   */
  function getMessageLog() {
    return [...messageLog];
  }

  return {
    publish,
    subscribe,
    publishError,
    getMessageLog,
    on: emitter.on.bind(emitter),
    emit: emitter.emit.bind(emitter)
  };
}

module.exports = { createMessageBus, MESSAGE_TYPES };
