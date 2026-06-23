/**
 * 借分契约多智能体编排器测试 - Issue #9
 *
 * 测试多智能体系统的协调执行、状态管理和结果集成
 */

const {
  createBorrowContractOrchestrator
} = require('../../src/dialog/borrow-contract-orchestrator');
const { BORROW_STATES } = require('../../src/dialog/borrow-contract-state');
const { OUTCOME_TYPES } = require('../../src/dialog/contract-outcome');

describe('BorrowContractOrchestrator - 借分契约多智能体编排器', () => {
  describe('初始化', () => {
    test('应能创建编排器实例并暴露公共 API', () => {
      const orchestrator = createBorrowContractOrchestrator();
      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.processChildResponse).toBe('function');
      expect(typeof orchestrator.triggerContract).toBe('function');
      expect(typeof orchestrator.acceptContract).toBe('function');
      expect(typeof orchestrator.rejectContract).toBe('function');
      expect(typeof orchestrator.completeContract).toBe('function');
      expect(typeof orchestrator.handleChangedMind).toBe('function');
      expect(typeof orchestrator.getContractStatus).toBe('function');
      expect(typeof orchestrator.getAgentStats).toBe('function');
    });

    test('初始状态应为 IDLE,计数器为 0', () => {
      const orchestrator = createBorrowContractOrchestrator();
      const status = orchestrator.getContractStatus();
      expect(status.currentState).toBe(BORROW_STATES.IDLE);
      expect(status.refusalCount).toBe(0);
      expect(status.shouldTriggerBorrow).toBe(false);
    });
  });

  describe('处理孩子反应 - 状态分类与计数', () => {
    test('叛逆/无聊反应应递增计数器', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      const result = await orchestrator.processChildResponse('rebellious');
      expect(result.refusalCount).toBe(1);
      expect(result.currentState).toBe(BORROW_STATES.COUNTING);
      expect(result.shouldTriggerBorrow).toBe(false);
    });

    test('累了反应不应递增计数器,应标记结束会话', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      const result = await orchestrator.processChildResponse('tired');
      expect(result.refusalCount).toBe(0);
      expect(result.shouldEndSession).toBe(true);
    });

    test('畏难反应不应递增计数器,应标记降低难度', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      const result = await orchestrator.processChildResponse('difficult');
      expect(result.refusalCount).toBe(0);
      expect(result.shouldReduceDifficulty).toBe(true);
    });

    test('连续3次叛逆反应应触发借分契约', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      const result = await orchestrator.processChildResponse('rebellious');
      expect(result.refusalCount).toBe(3);
      expect(result.currentState).toBe(BORROW_STATES.TRIGGERED);
      expect(result.shouldTriggerBorrow).toBe(true);
    });
  });

  describe('触发契约与台词生成', () => {
    test('triggerContract 应返回借分契约提案台词', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');

      const result = orchestrator.triggerContract();
      expect(result.dialogue).toContain('10个聪明分');
      expect(result.dialogue).toContain('20分');
      expect(result.dialogue).toContain('搞笑');
    });

    test('未达阈值时 triggerContract 应抛出错误', () => {
      const orchestrator = createBorrowContractOrchestrator();
      expect(() => orchestrator.triggerContract()).toThrow();
    });
  });

  describe('接受/拒绝对赌', () => {
    test('acceptContract 应将状态转为 IN_PROGRESS 并返回接受台词', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      orchestrator.triggerContract();

      const result = orchestrator.acceptContract();
      expect(result.dialogue).toContain('击掌');
      expect(orchestrator.getContractStatus().currentState).toBe(BORROW_STATES.IN_PROGRESS);
    });

    test('rejectContract 应将状态重置为 IDLE 并返回拒绝台词', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      orchestrator.triggerContract();

      const result = orchestrator.rejectContract();
      expect(result.dialogue).toContain('没关系');
      expect(orchestrator.getContractStatus().currentState).toBe(BORROW_STATES.IDLE);
      expect(orchestrator.getContractStatus().refusalCount).toBe(0);
    });
  });

  describe('对赌结果处理', () => {
    test('completeContract(win) 应返回赢的结果,含新故事解锁', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      orchestrator.triggerContract();
      orchestrator.acceptContract();

      const result = await orchestrator.completeContract(OUTCOME_TYPES.WIN);
      expect(result.outcome).toBe(OUTCOME_TYPES.WIN);
      expect(result.storyUnlocked).toBe(true);
      expect(result.points).toBe(20);
      expect(result.dialogue).toBeDefined();
      expect(orchestrator.getContractStatus().currentState).toBe(BORROW_STATES.COMPLETED);
    });

    test('completeContract(lose) 应返回输的结果,含搞笑任务', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      orchestrator.triggerContract();
      orchestrator.acceptContract();

      const result = await orchestrator.completeContract(OUTCOME_TYPES.LOSE);
      expect(result.outcome).toBe(OUTCOME_TYPES.LOSE);
      expect(result.funnyTask).toBeDefined();
      expect(result.funnyTask.id).toBeDefined();
      expect(result.funnyTask.description).toBeDefined();
      expect(result.points).toBe(0);
      expect(orchestrator.getContractStatus().currentState).toBe(BORROW_STATES.COMPLETED);
    });

    test('非法 outcome 应抛出错误', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      orchestrator.triggerContract();
      orchestrator.acceptContract();

      await expect(orchestrator.completeContract('invalid')).rejects.toThrow();
    });
  });

  describe('孩子改变主意', () => {
    test('handleChangedMind 应退出对赌并重置计数器', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      orchestrator.triggerContract();
      orchestrator.acceptContract();

      const result = orchestrator.handleChangedMind();
      expect(result.outcome).toBe(OUTCOME_TYPES.CHANGED_MIND);
      expect(result.exited).toBe(true);
      expect(orchestrator.getContractStatus().currentState).toBe(BORROW_STATES.IDLE);
      expect(orchestrator.getContractStatus().refusalCount).toBe(0);
    });
  });

  describe('多智能体统计', () => {
    test('getAgentStats 应返回所有智能体的统计信息', () => {
      const orchestrator = createBorrowContractOrchestrator();
      const stats = orchestrator.getAgentStats();
      expect(stats.agents).toBeDefined();
      expect(stats.agents.BorrowStateAgent).toBeDefined();
      expect(stats.agents.FunnyTaskAgent).toBeDefined();
      expect(stats.agents.ContractOutcomeAgent).toBeDefined();
    });

    test('执行操作后智能体任务计数应增加', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      await orchestrator.processChildResponse('rebellious');
      const stats = orchestrator.getAgentStats();
      expect(stats.agents.BorrowStateAgent.tasksCompleted).toBeGreaterThan(0);
    });
  });

  describe('完整生命周期', () => {
    test('完整赢的流程: 计数→触发→接受→赢→重置', async () => {
      const orchestrator = createBorrowContractOrchestrator();

      // 3次叛逆触发
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');

      // 触发契约
      const proposal = orchestrator.triggerContract();
      expect(proposal.dialogue).toContain('聪明分');

      // 接受
      const accept = orchestrator.acceptContract();
      expect(accept.dialogue).toBeDefined();

      // 赢
      const win = await orchestrator.completeContract(OUTCOME_TYPES.WIN);
      expect(win.outcome).toBe(OUTCOME_TYPES.WIN);
      expect(win.points).toBe(20);

      // 重置
      orchestrator.reset();
      expect(orchestrator.getContractStatus().currentState).toBe(BORROW_STATES.IDLE);
    });

    test('完整输的流程: 计数→触发→接受→输→重置', async () => {
      const orchestrator = createBorrowContractOrchestrator();

      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');

      orchestrator.triggerContract();
      orchestrator.acceptContract();

      const lose = await orchestrator.completeContract(OUTCOME_TYPES.LOSE);
      expect(lose.outcome).toBe(OUTCOME_TYPES.LOSE);
      expect(lose.funnyTask).toBeDefined();

      orchestrator.reset();
      expect(orchestrator.getContractStatus().currentState).toBe(BORROW_STATES.IDLE);
    });
  });

  describe('依赖注入', () => {
    test('应支持自定义阈值', async () => {
      const orchestrator = createBorrowContractOrchestrator({ threshold: 2 });
      await orchestrator.processChildResponse('rebellious');
      const result = await orchestrator.processChildResponse('rebellious');
      expect(result.shouldTriggerBorrow).toBe(true);
      expect(result.currentState).toBe(BORROW_STATES.TRIGGERED);
    });

    test('应支持自定义模块注入', async () => {
      const mockFunnyTaskPool = {
        getRandomTask: () => ({ id: 'custom', name: '自定义', description: '测试任务', emoji: '🧪' }),
        getAllTasks: () => [],
        getTaskById: () => null,
        reset: () => {},
        getTaskCount: () => 1,
        hasUnusedTasks: () => true
      };
      const orchestrator = createBorrowContractOrchestrator({
        funnyTaskPool: mockFunnyTaskPool
      });

      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      await orchestrator.processChildResponse('rebellious');
      orchestrator.triggerContract();
      orchestrator.acceptContract();

      const result = await orchestrator.completeContract(OUTCOME_TYPES.LOSE);
      expect(result.funnyTask.id).toBe('custom');
    });
  });

  describe('并行执行性能', () => {
    test('多智能体并行执行应正常完成', async () => {
      const orchestrator = createBorrowContractOrchestrator();

      // 并行执行多次(多智能体)
      const results = await Promise.all([
        orchestrator.processChildResponse('rebellious'),
        orchestrator.processChildResponse('rebellious'),
        orchestrator.processChildResponse('rebellious')
      ]);

      // 验证所有执行都成功完成
      expect(results).toHaveLength(3);
      expect(results.every(r => r !== undefined)).toBe(true);
    });
  });

  describe('错误处理', () => {
    test('processChildResponse 在智能体出错时应优雅降级返回默认值', async () => {
      // 注入会抛错的状态机
      const faultyBorrowState = {
        recordRefusal: () => { throw new Error('状态机故障'); },
        shouldTriggerBorrow: () => false,
        getCurrentState: () => BORROW_STATES.IDLE,
        getRefusalCount: () => 0,
        getBorrowPoints: () => 10,
        getWinPoints: () => 20,
        acceptContract: () => {},
        rejectContract: () => {},
        completeContract: () => {},
        reset: () => {}
      };
      const orchestrator = createBorrowContractOrchestrator({
        borrowState: faultyBorrowState
      });

      const result = await orchestrator.processChildResponse('rebellious');
      // 智能体协议内部捕获错误,优雅降级返回默认值
      expect(result.currentState).toBe(BORROW_STATES.IDLE);
      expect(result.refusalCount).toBe(0);
      expect(result.shouldTriggerBorrow).toBe(false);
      // 智能体统计应记录失败
      const stats = orchestrator.getAgentStats();
      expect(stats.agents.BorrowStateAgent.tasksFailed).toBeGreaterThan(0);
    });

    test('reset 应重置所有智能体统计', async () => {
      const orchestrator = createBorrowContractOrchestrator();
      await orchestrator.processChildResponse('rebellious');
      expect(orchestrator.getAgentStats().agents.BorrowStateAgent.tasksCompleted).toBeGreaterThan(0);

      orchestrator.reset();
      expect(orchestrator.getAgentStats().agents.BorrowStateAgent.tasksCompleted).toBe(0);
      expect(orchestrator.getContractStatus().currentState).toBe(BORROW_STATES.IDLE);
    });
  });
});
