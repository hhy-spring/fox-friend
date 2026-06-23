/**
 * AgentBase 测试 — 智能体基类
 *
 * 验证行为：
 * - 智能体初始化与生命周期
 * - 任务执行
 * - 消息处理
 * - 状态管理
 * - 结果输出
 */

const { createAgentBase, AGENT_STATUS } = require('../../src/multi-agent/agents/agent-base');
const { createMessageBus, MESSAGE_TYPES } = require('../../src/multi-agent/message-bus');

describe('AgentBase', () => {
  let bus;

  beforeEach(() => {
    bus = createMessageBus();
  });

  describe('生命周期管理', () => {
    test('应正确初始化并进入 IDLE 状态', () => {
      const agent = createAgentBase({
        id: 'fox-agent',
        capabilities: ['render', 'animate'],
        bus
      });

      expect(agent.getId()).toBe('fox-agent');
      expect(agent.getStatus()).toBe(AGENT_STATUS.IDLE);
      expect(agent.getCapabilities()).toEqual(['render', 'animate']);
    });

    test('初始化后应进入 READY 状态', async () => {
      const agent = createAgentBase({
        id: 'fox-agent',
        capabilities: ['render'],
        bus
      });

      await agent.initialize();

      expect(agent.getStatus()).toBe(AGENT_STATUS.READY);
    });
  });

  describe('任务执行', () => {
    test('应执行分配的任务并返回结果', async () => {
      const agent = createAgentBase({
        id: 'fox-agent',
        capabilities: ['render'],
        bus,
        executor: async (task) => ({
          taskId: task.id,
          result: `rendered-${task.payload.component}`
        })
      });

      await agent.initialize();
      const result = await agent.execute({
        id: 'task-1',
        type: 'render',
        payload: { component: 'fox-character' }
      });

      expect(result.taskId).toBe('task-1');
      expect(result.result).toBe('rendered-fox-character');
      expect(agent.getStatus()).toBe(AGENT_STATUS.READY);
    });

    test('执行期间状态应为 RUNNING', async () => {
      let statusDuringExecution;
      const agent = createAgentBase({
        id: 'fox-agent',
        capabilities: ['render'],
        bus,
        executor: async (task) => {
          statusDuringExecution = agent.getStatus();
          return { done: true };
        }
      });

      await agent.initialize();
      await agent.execute({ id: 'task-1', type: 'render', payload: {} });

      expect(statusDuringExecution).toBe(AGENT_STATUS.RUNNING);
    });

    test('任务失败应进入 ERROR 状态并记录错误', async () => {
      const agent = createAgentBase({
        id: 'fox-agent',
        capabilities: ['render'],
        bus,
        executor: async () => { throw new Error('渲染失败'); }
      });

      await agent.initialize();

      await expect(agent.execute({
        id: 'task-1',
        type: 'render',
        payload: {}
      })).rejects.toThrow('渲染失败');

      expect(agent.getStatus()).toBe(AGENT_STATUS.ERROR);
      expect(agent.getLastError().message).toBe('渲染失败');
    });
  });

  describe('消息处理', () => {
    test('应接收并处理广播消息', async () => {
      const received = [];
      const agent = createAgentBase({
        id: 'fox-agent',
        capabilities: ['render'],
        bus,
        onMessage: (msg) => received.push(msg)
      });

      await agent.initialize();

      bus.publish({
        from: 'coordinator',
        to: 'broadcast',
        type: MESSAGE_TYPES.STATE_SYNC,
        payload: { phase: 'start' }
      });

      expect(received).toHaveLength(1);
      expect(received[0].payload.phase).toBe('start');
    });

    test('应接收定向消息', async () => {
      const received = [];
      const agent = createAgentBase({
        id: 'fox-agent',
        capabilities: ['render'],
        bus,
        onMessage: (msg) => received.push(msg)
      });

      await agent.initialize();

      bus.publish({
        from: 'coordinator',
        to: 'fox-agent',
        type: MESSAGE_TYPES.TASK_ASSIGNED,
        payload: { task: 'build-fox' }
      });

      expect(received).toHaveLength(1);
    });

    test('应通过消息总线报告任务完成', async () => {
      const coordinatorMessages = [];
      bus.subscribe('coordinator', (msg) => coordinatorMessages.push(msg));

      const agent = createAgentBase({
        id: 'fox-agent',
        capabilities: ['render'],
        bus,
        executor: async () => ({ component: 'fox', status: 'built' })
      });

      await agent.initialize();
      await agent.execute({
        id: 'task-1',
        type: 'render',
        payload: {}
      });

      expect(coordinatorMessages).toHaveLength(1);
      expect(coordinatorMessages[0].type).toBe(MESSAGE_TYPES.TASK_COMPLETED);
      expect(coordinatorMessages[0].from).toBe('fox-agent');
      expect(coordinatorMessages[0].to).toBe('coordinator');
    });

    test('应通过消息总线报告任务失败', async () => {
      const coordinatorMessages = [];
      bus.subscribe('coordinator', (msg) => coordinatorMessages.push(msg));

      const agent = createAgentBase({
        id: 'fox-agent',
        capabilities: ['render'],
        bus,
        executor: async () => { throw new Error('失败'); }
      });

      await agent.initialize();

      try {
        await agent.execute({ id: 'task-1', type: 'render', payload: {} });
      } catch (e) {
        // 预期错误
      }

      expect(coordinatorMessages).toHaveLength(1);
      expect(coordinatorMessages[0].type).toBe(MESSAGE_TYPES.TASK_FAILED);
      expect(coordinatorMessages[0].payload.error).toBe('失败');
    });
  });

  describe('结果管理', () => {
    test('应累积所有已完成的任务结果', async () => {
      const agent = createAgentBase({
        id: 'fox-agent',
        capabilities: ['render'],
        bus,
        executor: async (task) => ({ output: task.payload.value * 2 })
      });

      await agent.initialize();
      await agent.execute({ id: 'task-1', type: 'render', payload: { value: 5 } });
      await agent.execute({ id: 'task-2', type: 'render', payload: { value: 10 } });

      const results = agent.getResults();
      expect(results).toHaveLength(2);
      expect(results[0].output).toBe(10);
      expect(results[1].output).toBe(20);
    });
  });
});
