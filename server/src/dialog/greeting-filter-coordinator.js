/**
 * 问候语过滤多智能体协调器 - Issue #17
 *
 * 基于技术架构文档§三「对话引擎架构」
 * 基于现有 agent-base.js 多智能体通信协议
 *
 * 多智能体系统架构：
 *   ┌─────────────────────────────────────────────────┐
 *   │           GreetingFilterCoordinator              │
 *   │           (中央协调模块)                          │
 *   ├─────────┬───────────┬───────────┬───────────────┤
 *   │ Pattern │ Filter    │ Integrat- │ Regression    │
 *   │ Agent   │ Agent     │ ion Agent │ Agent         │
 *   │ (模式)  │ (过滤)    │ (集成)    │ (回归)        │
 *   └─────────┴───────────┴───────────┴───────────────┘
 *
 * 执行策略：
 *   Phase 1 (并行): PatternAgent + RegressionAgent
 *   Phase 2 (串行): FilterAgent (依赖 PatternAgent)
 *   Phase 3 (串行): IntegrationAgent (依赖 FilterAgent)
 *
 * 性能指标：
 *   - 并行执行速度提升 > 50%（对比串行）
 *   - 准确率 >= 99.5%
 *   - 结果完整性 100%
 */

const { createAgent, extractAgentOutput } = require('./agent-base');
const { isGreeting, getGreetingPatterns } = require('./greeting-filter');
const { isNameProvided, extractName, processChildInput } = require('./name-processor');

/**
 * 创建问候语模式分析智能体
 * 负责分析儿童语音交互中的问候语模式
 */
function createPatternAgent() {
  return createAgent({
    name: 'GreetingPatternAgent',
    taskHandler: (input) => {
      const patterns = getGreetingPatterns();
      return {
        patternCount: patterns.length,
        patterns,
        categories: {
          basic: patterns.filter(p => ['你好', '嗨', '哈喽', '哈罗', '嗨喽'].includes(p)),
          timeBased: patterns.filter(p => p.includes('好') || p.includes('安')),
          colloquial: patterns.filter(p => p.includes('呀') || p.includes('啊') || p.includes('哦')),
          particles: patterns.filter(p => ['嗯', '哦', '啊', '哎', '噢', '唔'].includes(p))
        }
      };
    }
  });
}

/**
 * 创建问候语过滤智能体
 * 负责执行问候语过滤逻辑
 */
function createFilterAgent() {
  return createAgent({
    name: 'GreetingFilterAgent',
    taskHandler: (input) => {
      const { content } = input;
      return {
        content,
        isGreeting: isGreeting(content),
        filtered: isGreeting(content)
      };
    }
  });
}

/**
 * 创建集成验证智能体
 * 负责验证问候语过滤与 name-processor 的集成
 */
function createIntegrationAgent() {
  return createAgent({
    name: 'IntegrationAgent',
    taskHandler: (input) => {
      const { content } = input;
      return {
        content,
        isNameProvided: isNameProvided(content),
        extractedName: extractName(content),
        processResult: processChildInput({
          childContent: content,
          currentStep: 'HELP_REQUEST',
          fsm: { getState: () => 'HELP_REQUEST' }
        })
      };
    }
  });
}

/**
 * 创建回归测试智能体
 * 负责验证合法名字不受问候语过滤影响
 */
function createRegressionAgent() {
  return createAgent({
    name: 'RegressionAgent',
    taskHandler: (input) => {
      const { validNames } = input;
      const results = validNames.map(name => ({
        name,
        isGreeting: isGreeting(name),
        isNameProvided: isNameProvided(name),
        extracted: extractName(name)
      }));
      const allValid = results.every(r => r.isNameProvided && !r.isGreeting);
      return { results, allValid };
    }
  });
}

/**
 * 创建问候语过滤协调器
 * 中央协调模块：监控子任务执行状态、处理异常、集成结果
 *
 * @returns {{ execute: function, getMetrics: function }}
 */
function createGreetingFilterCoordinator() {
  const patternAgent = createPatternAgent();
  const filterAgent = createFilterAgent();
  const integrationAgent = createIntegrationAgent();
  const regressionAgent = createRegressionAgent();

  const metrics = {
    totalDuration: 0,
    phaseDurations: {},
    agentResults: {},
    errors: []
  };

  /**
   * 执行多智能体协调流程
   * @param {object} input - 输入 { content, validNames }
   * @returns {object} 集成结果
   */
  async function execute(input) {
    const totalStart = Date.now();

    // Phase 1: 并行执行 PatternAgent 和 RegressionAgent
    const phase1Start = Date.now();
    const [patternResult, regressionResult] = await Promise.all([
      patternAgent.execute(input),
      regressionAgent.execute({ validNames: input.validNames || ['恐龙蛋', '闪电', '艾莎'] })
    ]);
    metrics.phaseDurations.phase1 = Date.now() - phase1Start;
    metrics.agentResults.pattern = patternResult;
    metrics.agentResults.regression = regressionResult;

    // 检查回归测试是否通过
    if (!extractAgentOutput(regressionResult, { allValid: false }).allValid) {
      metrics.errors.push('RegressionAgent: 合法名字被误过滤');
    }

    // Phase 2: 串行执行 FilterAgent（依赖 PatternAgent 结果）
    const phase2Start = Date.now();
    const filterResult = await filterAgent.execute(input);
    metrics.phaseDurations.phase2 = Date.now() - phase2Start;
    metrics.agentResults.filter = filterResult;

    // Phase 3: 串行执行 IntegrationAgent（依赖 FilterAgent 结果）
    const phase3Start = Date.now();
    const integrationResult = await integrationAgent.execute(input);
    metrics.phaseDurations.phase3 = Date.now() - phase3Start;
    metrics.agentResults.integration = integrationResult;

    metrics.totalDuration = Date.now() - totalStart;

    // 集成结果
    return {
      content: input.content,
      patternAnalysis: extractAgentOutput(patternResult, null),
      greetingFilter: extractAgentOutput(filterResult, null),
      integration: extractAgentOutput(integrationResult, null),
      regression: extractAgentOutput(regressionResult, null),
      metrics: { ...metrics }
    };
  }

  /**
   * 获取执行指标
   */
  function getMetrics() {
    return { ...metrics };
  }

  return { execute, getMetrics };
}

module.exports = {
  createGreetingFilterCoordinator,
  createPatternAgent,
  createFilterAgent,
  createIntegrationAgent,
  createRegressionAgent
};
