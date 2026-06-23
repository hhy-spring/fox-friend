/**
 * Coordinator 测试 — 中央协调模块
 *
 * 验证行为：
 * - 任务拆解
 * - 依赖关系分析
 * - 并行执行无依赖任务
 * - 顺序执行有依赖任务
 * - 结果集成
 * - 异常处理
 * - 进度监控
 */

const { createCoordinator, TASK_STATUS } = require('../../src/multi-agent/coordinator');
const { createMessageBus, MESSAGE_TYPES } = require('../../src/multi-agent/message-bus');
const { createAgentBase, AGENT_STATUS } = require('../../src/multi-agent/agents/agent-base');

describe('Coordinator', () => {
  let bus;

  beforeEach(() => {
    bus = createMessageBus();
  });

  describe('任务拆解', () => {
    test('应将主任务拆解为子任务', () => {
      const coordinator = createCoordinator({ bus });

      const subtasks = coordinator.decompose({
        id: 'frontend',
        goal: 'build-frontend',
        components: ['fox-character', 'scene-background', 'voice-input']
      });

      expect(subtasks).toHaveLength(3);
      expect(subtasks[0].id).toBeDefined();
      expect(subtasks[0].payload.component).toBe('fox-character');
      expect(subtasks[1].payload.component).toBe('scene-background');
      expect(subtasks[2].payload.component).toBe('voice-input');
    });

    test('每个子任务应包含优先级', () => {
      const coordinator = createCoordinator({ bus });

      const subtasks = coordinator.decompose({
        id: 'frontend',
        goal: 'build-frontend',
        components: ['fox-character', 'scene-background']
      });

      subtasks.forEach(task => {
        expect(task.priority).toBeDefined();
        expect(typeof task.priority).toBe('number');
      });
    });
  });

  describe('依赖关系分析', () => {
    test('应识别无依赖任务（可并行）', () => {
      const coordinator = createCoordinator({ bus });

      const subtasks = coordinator.decompose({
        id: 'frontend',
        goal: 'build-frontend',
        components: ['fox-character', 'scene-background', 'voice-input']
      });

      const parallel = coordinator.getParallelTasks(subtasks);
      expect(parallel.length).toBeGreaterThanOrEqual(2);
    });

    test('应识别有依赖任务（需顺序执行）', () => {
      const coordinator = createCoordinator({ bus });

      const subtasks = [
        { id: 'task-a', type: 'build', payload: {}, dependencies: [], priority: 1 },
        { id: 'task-b', type: 'build', payload: {}, dependencies: ['task-a'], priority: 2 },
        { id: 'task-c', type: 'build', payload: {}, dependencies: ['task-a'], priority: 3 }
      ];

      const parallel = coordinator.getParallelTasks(subtasks);
      expect(parallel).toHaveLength(1);
      expect(parallel[0].id).toBe('task-a');
    });
  });

  describe('并行执行', () => {
    test('应并行执行无依赖任务', async () => {
      const executionOrder = [];
      const agent1 = createAgentBase({
        id: 'agent-1',
        capabilities: ['render'],
        bus,
        executor: async (task) => {
          executionOrder.push(`start-${task.id}`);
          await new Promise(r => setTimeout(r, 50));
          executionOrder.push(`end-${task.id}`);
          return { component: task.payload.component };
        }
      });
      const agent2 = createAgentBase({
        id: 'agent-2',
        capabilities: ['render'],
        bus,
        executor: async (task) => {
          executionOrder.push(`start-${task.id}`);
          await new Promise(r => setTimeout(r, 50));
          executionOrder.push(`end-${task.id}`);
          return { component: task.payload.component };
        }
      });

      await agent1.initialize();
      await agent2.initialize();

      const coordinator = createCoordinator({ bus, agents: [agent1, agent2] });

      const tasks = [
        { id: 'task-1', type: 'render', payload: { component: 'fox' }, dependencies: [], priority: 1 },
        { id: 'task-2', type: 'render', payload: { component: 'scene' }, dependencies: [], priority: 2 }
      ];

      const results = await coordinator.executeTasks(tasks);

      expect(results).toHaveLength(2);
      // 两个任务应同时开始（并行）
      expect(executionOrder[0]).toMatch(/start-/);
      expect(executionOrder[1]).toMatch(/start-/);
    });

    test('应顺序执行有依赖任务', async () => {
      const executionOrder = [];
      const agent = createAgentBase({
        id: 'agent-1',
        capabilities: ['render'],
        bus,
        executor: async (task) => {
          executionOrder.push(task.id);
          await new Promise(r => setTimeout(r, 10));
          return { done: true };
        }
      });

      await agent.initialize();

      const coordinator = createCoordinator({ bus, agents: [agent] });

      const tasks = [
        { id: 'task-a', type: 'render', payload: {}, dependencies: [], priority: 1 },
        { id: 'task-b', type: 'render', payload: {}, dependencies: ['task-a'], priority: 2 }
      ];

      const results = await coordinator.executeTasks(tasks);

      expect(results).toHaveLength(2);
      expect(executionOrder).toEqual(['task-a', 'task-b']);
    });
  });

  describe('结果集成', () => {
    test('应将所有子任务结果集成为完整结果', async () => {
      const agent1 = createAgentBase({
        id: 'agent-1',
        capabilities: ['render'],
        bus,
        executor: async (task) => ({ component: task.payload.component, html: `<div>${task.payload.component}</div>` })
      });
      const agent2 = createAgentBase({
        id: 'agent-2',
        capabilities: ['render'],
        bus,
        executor: async (task) => ({ component: task.payload.component, html: `<div>${task.payload.component}</div>` })
      });

      await agent1.initialize();
      await agent2.initialize();

      const coordinator = createCoordinator({ bus, agents: [agent1, agent2] });

      const tasks = [
        { id: 'task-1', type: 'render', payload: { component: 'fox' }, dependencies: [], priority: 1 },
        { id: 'task-2', type: 'render', payload: { component: 'scene' }, dependencies: [], priority: 2 }
      ];

      const results = await coordinator.executeTasks(tasks);
      const integrated = coordinator.integrateResults(results);

      expect(integrated.components).toHaveLength(2);
      expect(integrated.components[0].component).toBe('fox');
      expect(integrated.components[1].component).toBe('scene');
    });
  });

  describe('异常处理', () => {
    test('单个任务失败不应阻塞其他无依赖任务', async () => {
      const agent1 = createAgentBase({
        id: 'agent-1',
        capabilities: ['render'],
        bus,
        executor: async () => { throw new Error('构建失败'); }
      });
      const agent2 = createAgentBase({
        id: 'agent-2',
        capabilities: ['render'],
        bus,
        executor: async (task) => ({ component: task.payload.component })
      });

      await agent1.initialize();
      await agent2.initialize();

      const coordinator = createCoordinator({ bus, agents: [agent1, agent2] });

      const tasks = [
        { id: 'task-1', type: 'render', payload: { component: 'fox' }, dependencies: [], priority: 1 },
        { id: 'task-2', type: 'render', payload: { component: 'scene' }, dependencies: [], priority: 2 }
      ];

      const results = await coordinator.executeTasks(tasks);

      expect(results).toHaveLength(2);
      expect(results[0].error).toBeDefined();
      expect(results[1].component).toBe('scene');
    });
  });

  describe('进度监控', () => {
    test('应报告任务执行进度', async () => {
      const agent = createAgentBase({
        id: 'agent-1',
        capabilities: ['render'],
        bus,
        executor: async (task) => {
          await new Promise(r => setTimeout(r, 10));
          return { done: true };
        }
      });

      await agent.initialize();

      const coordinator = createCoordinator({ bus, agents: [agent] });

      const tasks = [
        { id: 'task-1', type: 'render', payload: {}, dependencies: [], priority: 1 },
        { id: 'task-2', type: 'render', payload: {}, dependencies: [], priority: 2 },
        { id: 'task-3', type: 'render', payload: {}, dependencies: [], priority: 3 }
      ];

      await coordinator.executeTasks(tasks);
      const progress = coordinator.getProgress();

      expect(progress.total).toBe(3);
      expect(progress.completed).toBe(3);
      expect(progress.failed).toBe(0);
    });

    test('应记录失败任务数量', async () => {
      const agent = createAgentBase({
        id: 'agent-1',
        capabilities: ['render'],
        bus,
        executor: async () => { throw new Error('失败'); }
      });

      await agent.initialize();

      const coordinator = createCoordinator({ bus, agents: [agent] });

      const tasks = [
        { id: 'task-1', type: 'render', payload: {}, dependencies: [], priority: 1 },
        { id: 'task-2', type: 'render', payload: {}, dependencies: [], priority: 2 }
      ];

      await coordinator.executeTasks(tasks);
      const progress = coordinator.getProgress();

      expect(progress.total).toBe(2);
      expect(progress.failed).toBe(2);
      expect(progress.completed).toBe(0);
    });
  });

  describe('性能基准', () => {
    test('并行执行应比顺序执行快至少 50%', async () => {
      const taskDuration = 100;

      const agent1 = createAgentBase({
        id: 'agent-1',
        capabilities: ['render'],
        bus,
        executor: async () => {
          await new Promise(r => setTimeout(r, taskDuration));
          return { done: true };
        }
      });
      const agent2 = createAgentBase({
        id: 'agent-2',
        capabilities: ['render'],
        bus,
        executor: async () => {
          await new Promise(r => setTimeout(r, taskDuration));
          return { done: true };
        }
      });

      await agent1.initialize();
      await agent2.initialize();

      const coordinator = createCoordinator({ bus, agents: [agent1, agent2] });

      const tasks = [
        { id: 'task-1', type: 'render', payload: {}, dependencies: [], priority: 1 },
        { id: 'task-2', type: 'render', payload: {}, dependencies: [], priority: 2 }
      ];

      const startParallel = Date.now();
      await coordinator.executeTasks(tasks);
      const parallelTime = Date.now() - startParallel;

      // 顺序执行时间应约为 2 * taskDuration
      // 并行执行时间应约为 taskDuration
      // 加速比应 >= 1.5（50%提升）
      const speedup = (2 * taskDuration) / parallelTime;
      expect(speedup).toBeGreaterThanOrEqual(1.5);
    });
  });
});
