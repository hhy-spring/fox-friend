/**
 * MessageBus — 多智能体通信协议
 *
 * 职责：
 * - 消息发布/订阅（Pub/Sub）
 * - 点对点消息传递
 * - 广播消息
 * - 消息历史记录与追溯
 * - 错误隔离
 *
 * 消息格式：
 * {
 *   id: string,          // 自动生成
 *   from: string,        // 发送者 ID
 *   to: string,          // 接收者 ID | 'broadcast'
 *   type: string,        // 消息类型
 *   payload: any,        // 消息内容
 *   timestamp: number,   // 自动生成
 *   correlationId?: string  // 关联原始消息 ID
 * }
 */

const { v4: uuidv4 } = require('uuid');

const MESSAGE_TYPES = {
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_FAILED: 'task_failed',
  STATE_SYNC: 'state_sync',
  QUERY: 'query',
  RESPONSE: 'response',
  PROGRESS: 'progress'
};

/**
 * 创建消息总线
 * @returns {object} MessageBus 实例
 */
function createMessageBus() {
  const subscribers = new Map();
  const history = [];

  /**
   * 订阅消息
   * @param {string} subscriberId - 订阅者 ID
   * @param {function} handler - 消息处理函数
   * @returns {function} 取消订阅函数
   */
  function subscribe(subscriberId, handler) {
    if (!subscribers.has(subscriberId)) {
      subscribers.set(subscriberId, []);
    }
    subscribers.get(subscriberId).push(handler);

    return () => {
      const handlers = subscribers.get(subscriberId);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
        if (handlers.length === 0) subscribers.delete(subscriberId);
      }
    };
  }

  /**
   * 发布消息
   * @param {object} message - 消息对象
   */
  function publish(message) {
    const fullMessage = {
      id: message.id || uuidv4(),
      from: message.from,
      to: message.to || 'broadcast',
      type: message.type,
      payload: message.payload,
      timestamp: message.timestamp || Date.now(),
      correlationId: message.correlationId
    };

    history.push(fullMessage);

    const targetSubscribers = [];
    if (fullMessage.to === 'broadcast') {
      for (const [id, handlers] of subscribers) {
        if (id !== fullMessage.from) {
          targetSubscribers.push(...handlers);
        }
      }
    } else {
      const handlers = subscribers.get(fullMessage.to);
      if (handlers) {
        targetSubscribers.push(...handlers);
      }
    }

    for (const handler of targetSubscribers) {
      try {
        handler(fullMessage);
      } catch (err) {
        console.error(`[MessageBus] 订阅者处理消息失败: ${err.message}`);
      }
    }
  }

  /**
   * 获取消息历史
   * @param {number} limit - 限制数量
   * @returns {array} 消息历史
   */
  function getHistory(limit) {
    if (limit) return history.slice(-limit);
    return [...history];
  }

  /**
   * 按类型获取消息历史
   * @param {string} type - 消息类型
   * @returns {array} 过滤后的消息历史
   */
  function getHistoryByType(type) {
    return history.filter(msg => msg.type === type);
  }

  /**
   * 清空历史
   */
  function clearHistory() {
    history.length = 0;
  }

  return {
    subscribe,
    publish,
    getHistory,
    getHistoryByType,
    clearHistory
  };
}

module.exports = { createMessageBus, MESSAGE_TYPES };
