/**
 * MessageBus 测试 — 多智能体通信协议
 *
 * 验证行为：
 * - 消息发布/订阅
 * - 点对点消息传递
 * - 广播消息
 * - 消息历史记录
 * - 错误处理
 */

const { createMessageBus, MESSAGE_TYPES } = require('../../src/multi-agent/message-bus');

describe('MessageBus', () => {
  let bus;

  beforeEach(() => {
    bus = createMessageBus();
  });

  describe('消息订阅与发布', () => {
    test('订阅者应收到已发布消息', () => {
      const received = [];
      bus.subscribe('agent-A', (msg) => received.push(msg));

      bus.publish({
        from: 'coordinator',
        to: 'agent-A',
        type: MESSAGE_TYPES.TASK_ASSIGNED,
        payload: { task: 'build-fox' }
      });

      expect(received).toHaveLength(1);
      expect(received[0].payload.task).toBe('build-fox');
    });

    test('广播消息应被所有订阅者收到', () => {
      const receivedA = [];
      const receivedB = [];
      bus.subscribe('agent-A', (msg) => receivedA.push(msg));
      bus.subscribe('agent-B', (msg) => receivedB.push(msg));

      bus.publish({
        from: 'coordinator',
        to: 'broadcast',
        type: MESSAGE_TYPES.STATE_SYNC,
        payload: { phase: 'integration' }
      });

      expect(receivedA).toHaveLength(1);
      expect(receivedB).toHaveLength(1);
    });

    test('未指定 to 的消息应被所有订阅者收到', () => {
      const received = [];
      bus.subscribe('agent-A', (msg) => received.push(msg));
      bus.subscribe('agent-B', (msg) => received.push(msg));

      bus.publish({
        from: 'coordinator',
        type: MESSAGE_TYPES.STATE_SYNC,
        payload: { status: 'started' }
      });

      expect(received).toHaveLength(2);
    });
  });

  describe('消息历史与追溯', () => {
    test('应记录所有消息历史', () => {
      bus.publish({
        from: 'coordinator',
        to: 'agent-A',
        type: MESSAGE_TYPES.TASK_ASSIGNED,
        payload: { task: 'task-1' }
      });

      const history = bus.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe(MESSAGE_TYPES.TASK_ASSIGNED);
    });

    test('应按类型过滤消息历史', () => {
      bus.publish({
        from: 'coordinator',
        to: 'agent-A',
        type: MESSAGE_TYPES.TASK_ASSIGNED,
        payload: {}
      });
      bus.publish({
        from: 'agent-A',
        to: 'coordinator',
        type: MESSAGE_TYPES.TASK_COMPLETED,
        payload: {}
      });

      const completed = bus.getHistoryByType(MESSAGE_TYPES.TASK_COMPLETED);
      expect(completed).toHaveLength(1);
    });

    test('应自动生成消息 ID 和时间戳', () => {
      bus.publish({
        from: 'coordinator',
        to: 'agent-A',
        type: MESSAGE_TYPES.TASK_ASSIGNED,
        payload: {}
      });

      const history = bus.getHistory();
      expect(history[0].id).toBeDefined();
      expect(history[0].timestamp).toBeDefined();
    });
  });

  describe('错误处理', () => {
    test('订阅者抛出错误不应影响其他订阅者', () => {
      const received = [];
      bus.subscribe('agent-A', () => { throw new Error('处理失败'); });
      bus.subscribe('agent-B', (msg) => received.push(msg));

      expect(() => {
        bus.publish({
          from: 'coordinator',
          to: 'broadcast',
          type: MESSAGE_TYPES.STATE_SYNC,
          payload: {}
        });
      }).not.toThrow();

      expect(received).toHaveLength(1);
    });

    test('取消订阅后不应再收到消息', () => {
      const received = [];
      const unsubscribe = bus.subscribe('agent-A', (msg) => received.push(msg));

      bus.publish({
        from: 'coordinator',
        to: 'agent-A',
        type: MESSAGE_TYPES.TASK_ASSIGNED,
        payload: {}
      });
      unsubscribe();
      bus.publish({
        from: 'coordinator',
        to: 'agent-A',
        type: MESSAGE_TYPES.TASK_ASSIGNED,
        payload: {}
      });

      expect(received).toHaveLength(1);
    });
  });
});
