/**
 * 多智能体系统补充测试 - 提升覆盖率
 *
 * Issue #23: 步骤2求助台词和暗示选项消息结构修复
 * 补充测试覆盖 message-bus、diagnostic-agent、agent-base、validation-agent
 */

const { createMessageBus, MESSAGE_TYPES } = require('../../src/multi-agent/message-bus');
const { createAgent } = require('../../src/multi-agent/agents/agent-base');
const { createDiagnosticAgent, diagnoseNameDetection, diagnoseWSMessageStructure } = require('../../src/multi-agent/agents/diagnostic-agent');
const { createFixAgent, hasGreetingPrefix, improvedIsNameProvided, standardizeHintFields } = require('../../src/multi-agent/agents/fix-agent');
const { createValidationAgent, runBenchmark } = require('../../src/multi-agent/agents/validation-agent');
const { createCoordinator, TASK_STATES } = require('../../src/multi-agent/coordinator');

describe('多智能体系统补充测试', () => {
  describe('MessageBus 完整覆盖', () => {
    test('广播消息被所有订阅者接收', () => {
      const bus = createMessageBus();
      const received = [];

      bus.subscribe('agent-a', (msg) => received.push({ agent: 'a', msg }));
      bus.subscribe('agent-b', (msg) => received.push({ agent: 'b', msg }));

      bus.publish({
        type: MESSAGE_TYPES.STATE_SYNC,
        from: 'coordinator',
        to: '*',
        payload: { state: 'RUNNING' }
      });

      expect(received.length).toBe(2);
      expect(received[0].agent).toBe('a');
      expect(received[1].agent).toBe('b');
    });

    test('publishError 发送错误消息', () => {
      const bus = createMessageBus();
      let errorReceived = null;

      // 添加 error 事件监听器，避免 Node.js EventEmitter 未处理 error 事件
      bus.on('error', () => {});

      bus.subscribe('coordinator', (msg) => {
        errorReceived = msg;
      });

      const error = new Error('测试错误');
      error.name = 'TestError';
      bus.publishError('agent-a', 'coordinator', error, 'corr-123');

      expect(errorReceived).not.toBeNull();
      expect(errorReceived.type).toBe(MESSAGE_TYPES.TASK_ERROR);
      expect(errorReceived.error.message).toBe('测试错误');
      expect(errorReceived.error.name).toBe('TestError');
      expect(errorReceived.correlationId).toBe('corr-123');
    });

    test('消息总线事件发射器', (done) => {
      const bus = createMessageBus();
      bus.subscribe('test', () => {});

      bus.on('message', (msg) => {
        expect(msg.type).toBe(MESSAGE_TYPES.TASK_ASSIGN);
        done();
      });

      bus.publish({
        type: MESSAGE_TYPES.TASK_ASSIGN,
        from: 'coordinator',
        to: 'test',
        payload: {}
      });
    });

    test('定向消息只发给指定订阅者', () => {
      const bus = createMessageBus();
      let agentAReceived = false;
      let agentBReceived = false;

      bus.subscribe('agent-a', () => { agentAReceived = true; });
      bus.subscribe('agent-b', () => { agentBReceived = true; });

      bus.publish({
        type: MESSAGE_TYPES.TASK_ASSIGN,
        from: 'coordinator',
        to: 'agent-a',
        payload: {}
      });

      expect(agentAReceived).toBe(true);
      expect(agentBReceived).toBe(false);
    });

    test('消息日志按时间顺序记录', () => {
      const bus = createMessageBus();
      bus.subscribe('a', () => {});

      bus.publish({ type: MESSAGE_TYPES.STATE_SYNC, from: 'c1', to: 'a', payload: {} });
      bus.publish({ type: MESSAGE_TYPES.TASK_RESULT, from: 'c2', to: 'a', payload: {} });

      const log = bus.getMessageLog();
      expect(log.length).toBe(2);
      expect(log[0].from).toBe('c1');
      expect(log[1].from).toBe('c2');
      expect(log[1].timestamp).toBeGreaterThanOrEqual(log[0].timestamp);
    });
  });

  describe('AgentBase 完整覆盖', () => {
    test('智能体执行成功并返回结果', async () => {
      const agent = createAgent({
        id: 'test-agent',
        name: '测试智能体',
        role: '测试',
        async execute(input) {
          return { processed: input.value * 2 };
        }
      });

      const publishedMessages = [];
      const result = await agent.execute({ value: 21 }, {
        publish: (type, payload) => publishedMessages.push({ type, payload }),
        getState: () => ({})
      });

      expect(result.success).toBe(true);
      expect(result.result.processed).toBe(42);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      // 应发布 RUNNING 和 COMPLETED 状态
      expect(publishedMessages.length).toBeGreaterThanOrEqual(2);
    });

    test('智能体执行失败时抛出错误', async () => {
      const agent = createAgent({
        id: 'failing-agent',
        name: '失败智能体',
        role: '测试错误处理',
        async execute() {
          throw new Error('执行失败');
        }
      });

      const publishedMessages = [];
      await expect(agent.execute({}, {
        publish: (type, payload) => publishedMessages.push({ type, payload }),
        getState: () => ({})
      })).rejects.toThrow('执行失败');
    });
  });

  describe('DiagnosticAgent 完整覆盖', () => {
    test('diagnoseNameDetection 对正常名字不报根因', () => {
      const diagnosis = diagnoseNameDetection('闪电');
      expect(diagnosis.isNameProvided).toBe(true);
      expect(diagnosis.isGreeting).toBe(false);
      // 正常名字不应有 rootCause
      expect(diagnosis.rootCause).toBeNull();
      expect(diagnosis.fixSuggestion).toBeNull();
    });

    test('diagnoseNameDetection 对纯问候语', () => {
      const diagnosis = diagnoseNameDetection('你好');
      expect(diagnosis.isGreeting).toBe(true);
      expect(diagnosis.isNameProvided).toBe(false);
    });

    test('diagnoseNameDetection 对短词但非名字', () => {
      const diagnosis = diagnoseNameDetection('不知道');
      expect(diagnosis.isNameProvided).toBe(false);
    });

    test('diagnoseWSMessageStructure 返回正确诊断', () => {
      const diagnosis = diagnoseWSMessageStructure({
        expectedFields: ['showHints', 'hints'],
        step: 'HELP_REQUEST'
      });

      expect(diagnosis.target).toBe('ws-voice-handler.js');
      expect(diagnosis.step).toBe('HELP_REQUEST');
      expect(diagnosis.expectedFields).toContain('showHints');
      expect(diagnosis.rootCause).toBeDefined();
      expect(diagnosis.fixSuggestion).toBeDefined();
    });

    test('诊断智能体处理 WebSocket 诊断任务', async () => {
      const agent = createDiagnosticAgent();
      const result = await agent.execute({
        target: 'ws-voice-handler.js',
        expectedFields: ['showHints', 'hints'],
        step: 'HELP_REQUEST'
      }, {
        publish: () => {},
        getState: () => ({})
      });

      expect(result.success).toBe(true);
      expect(result.result.diagnosis.target).toBe('ws-voice-handler.js');
    });

    test('诊断智能体处理未知目标返回空结果', async () => {
      const agent = createDiagnosticAgent();
      const result = await agent.execute({
        target: 'unknown-file.js',
        testInput: 'test'
      }, {
        publish: () => {},
        getState: () => ({})
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({});
    });
  });

  describe('FixAgent 完整覆盖', () => {
    test('hasGreetingPrefix 处理空输入', () => {
      expect(hasGreetingPrefix('')).toBe(false);
      expect(hasGreetingPrefix(null)).toBe(false);
      expect(hasGreetingPrefix(undefined)).toBe(false);
      expect(hasGreetingPrefix('   ')).toBe(false);
    });

    test('hasGreetingPrefix 处理各种问候语前缀', () => {
      expect(hasGreetingPrefix('早上好小狐狸')).toBe(true);
      expect(hasGreetingPrefix('下午好')).toBe(true);
      expect(hasGreetingPrefix('晚上好狐狸')).toBe(true);
      expect(hasGreetingPrefix('早安狐狸')).toBe(true);
      expect(hasGreetingPrefix('晚安狐狸')).toBe(true);
    });

    test('improvedIsNameProvided 处理空输入', () => {
      expect(improvedIsNameProvided('', () => true)).toBe(false);
      expect(improvedIsNameProvided(null, () => true)).toBe(false);
    });

    test('improvedIsNameProvided 对问候语前缀返回 false', () => {
      const { isNameProvided } = require('../../src/dialog/name-processor');
      expect(improvedIsNameProvided('你好小狐狸', isNameProvided)).toBe(false);
      expect(improvedIsNameProvided('嗨小狐狸', isNameProvided)).toBe(false);
    });

    test('standardizeHintFields 处理空对象', () => {
      const result = standardizeHintFields({});
      expect(result).toEqual({});
    });

    test('standardizeHintFields 处理 nameSource 字段', () => {
      const result = standardizeHintFields({
        nameRecorded: true,
        foxName: '闪电',
        nameSource: 'child_choice'
      });
      expect(result.nameSource).toBe('child_choice');
    });

    test('修复智能体处理未知修复类型', async () => {
      const agent = createFixAgent();
      const result = await agent.execute({
        target: 'unknown.js',
        fixType: 'unknown-fix'
      }, {
        publish: () => {},
        getState: () => ({})
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({});
    });
  });

  describe('ValidationAgent 基准测试', () => {
    test('runBenchmark 返回性能指标', () => {
      const benchmark = runBenchmark();

      expect(benchmark).toHaveProperty('singleAgentMs');
      expect(benchmark).toHaveProperty('multiAgentMs');
      expect(benchmark).toHaveProperty('iterations');
      expect(benchmark).toHaveProperty('inputCount');
      expect(typeof benchmark.singleAgentMs).toBe('number');
      expect(typeof benchmark.multiAgentMs).toBe('number');
    });

    test('验证智能体执行基准测试', async () => {
      const agent = createValidationAgent();
      const result = await agent.execute({
        coverageThreshold: 80
      }, {
        publish: () => {},
        getState: () => ({})
      });

      expect(result.success).toBe(true);
      expect(result.result.benchmark).toBeDefined();
      expect(result.result.coverageThreshold).toBe(80);
    });
  });

  describe('Coordinator 完整覆盖', () => {
    test('协调器集成结果', () => {
      const coordinator = createCoordinator();
      coordinator.registerAgent(createDiagnosticAgent());
      coordinator.registerAgent(createFixAgent());

      const subtasks = coordinator.decomposeTask({ testInput: '你好小狐狸' });
      const mockExecutionResult = {
        totalDurationMs: 100,
        executionLog: [{ priority: 1, taskCount: 2, durationMs: 50, results: [] }],
        results: { 'diagnose-name-detection': { success: true } },
        messageLog: []
      };

      const integrated = coordinator.integrateResults(mockExecutionResult);
      expect(integrated.success).toBe(true);
      expect(integrated.totalDurationMs).toBe(100);
      expect(integrated.taskCount).toBe(1);
    });

    test('协调器获取共享状态', () => {
      const coordinator = createCoordinator();
      const state = coordinator.getSharedState();
      expect(state).toHaveProperty('tasks');
      expect(state).toHaveProperty('results');
      expect(state).toHaveProperty('snapshots');
    });

    test('协调器执行完整任务图', async () => {
      const coordinator = createCoordinator({ maxConcurrency: 2 });
      coordinator.registerAgent(createDiagnosticAgent());
      coordinator.registerAgent(createFixAgent());

      const subtasks = coordinator.decomposeTask({ testInput: '你好小狐狸' });
      // 仅执行诊断阶段
      const diagnoseTasks = subtasks.filter(t => t.priority === 1);

      const result = await coordinator.executeTaskGraph(diagnoseTasks);

      expect(result).toHaveProperty('totalDurationMs');
      expect(result).toHaveProperty('executionLog');
      expect(result.executionLog.length).toBe(1);
    });
  });
});
