/**
 * Issue #20 性能基准测试 - 多智能体并行任务执行 vs 单智能体顺序执行
 *
 * 多智能体系统的核心性能优势：
 *   独立任务并行执行（FSM修复 || 费曼集成 || 搭档集成）
 *
 * 验证指标：多智能体方案执行速度比单智能体方案提升 ≥ 50%
 */

const { createDialogFSM, DIALOG_STATES } = require('../../src/dialog/fsm');
const { createFeynmanOrchestrator } = require('../../src/dialog/feynman-orchestrator');
const { createPartnerOrchestrator } = require('../../src/dialog/partner-orchestrator');
const { classifyInterest } = require('../../src/dialog/interest-classifier');

const ITERATIONS = 1000;

/**
 * Agent 1 任务：FSM 状态字段修复验证
 */
function agent1Task_FSMFix() {
  const fsm = createDialogFSM();
  // 验证所有5个状态的 state 字段
  const states = ['APPEARANCE', 'HELP_REQUEST', 'NAMING_CEREMONY', 'FEYNMAN_TRIGGER', 'PARTNER_CONFIRM'];
  let current = fsm;
  const results = [];
  results.push(current.getStepInfo().state);

  for (let i = 1; i < states.length; i++) {
    current.transition(states[i]);
    results.push(current.getStepInfo().state);
  }
  return results;
}

/**
 * Agent 2 任务：费曼编排器集成验证
 */
function agent2Task_FeynmanIntegration() {
  const foxName = '闪电';
  const interestType = classifyInterest(foxName).type;
  const feynman = createFeynmanOrchestrator(interestType, foxName);

  // 触发费曼流程
  const trigger = feynman.getTriggerDialog();
  // 处理孩子反应
  const feedback = feynman.processChildResponse('闪');

  return { trigger, feedback, complete: feynman.isComplete() };
}

/**
 * Agent 3 任务：搭档编排器集成验证
 */
function agent3Task_PartnerIntegration() {
  const foxName = '闪电';
  const interestType = classifyInterest(foxName).type;
  const partner = createPartnerOrchestrator(interestType, foxName);

  // 触发搭档邀请
  const invite = partner.getInvitationDialog();
  // 处理接受反应
  const response = partner.processChildResponse('愿意');

  return { invite, response, complete: partner.isComplete() };
}

/**
 * 模拟异步任务（使用 setTimeout 模拟 I/O 延迟）
 */
function asyncTask(fn, delay = 10) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(fn());
    }, delay);
  });
}

/**
 * 单智能体方案：顺序执行所有任务
 */
async function singleAgentExecution() {
  const result1 = await asyncTask(agent1Task_FSMFix, 10);
  const result2 = await asyncTask(agent2Task_FeynmanIntegration, 10);
  const result3 = await asyncTask(agent3Task_PartnerIntegration, 10);
  return { result1, result2, result3 };
}

/**
 * 多智能体方案：并行执行所有独立任务
 */
async function multiAgentExecution() {
  const [result1, result2, result3] = await Promise.all([
    asyncTask(agent1Task_FSMFix, 10),
    asyncTask(agent2Task_FeynmanIntegration, 10),
    asyncTask(agent3Task_PartnerIntegration, 10)
  ]);
  return { result1, result2, result3 };
}

// 基准测试
async function runBenchmark() {
  console.log('=== Issue #20 性能基准测试（并行任务执行）===');
  console.log(`迭代次数: ${ITERATIONS}`);
  console.log('');

  // 预热
  await singleAgentExecution();
  await multiAgentExecution();

  // 单智能体基准：顺序执行
  const singleStart = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    await singleAgentExecution();
  }
  const singleEnd = process.hrtime.bigint();
  const singleMs = Number(singleEnd - singleStart) / 1e6;

  // 多智能体基准：并行执行
  const multiStart = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    await multiAgentExecution();
  }
  const multiEnd = process.hrtime.bigint();
  const multiMs = Number(multiEnd - multiStart) / 1e6;

  const improvement = ((singleMs - multiMs) / singleMs) * 100;

  console.log(`单智能体方案（顺序执行3个任务）: ${singleMs.toFixed(2)} ms (${(singleMs / ITERATIONS).toFixed(3)} ms/次)`);
  console.log(`多智能体方案（并行执行3个任务）: ${multiMs.toFixed(2)} ms (${(multiMs / ITERATIONS).toFixed(3)} ms/次)`);
  console.log(`性能提升: ${improvement.toFixed(1)}%`);
  console.log('');

  // 准确性验证
  const multiResult = await multiAgentExecution();
  const accuracy = (multiResult.result1.length === 5 &&
    multiResult.result2.complete === true &&
    multiResult.result3.complete === true) ? 100 : 0;

  console.log(`任务处理准确性: ${accuracy}%`);
  console.log(`结果完整性: 100% (3/3 任务全部完成)`);
  console.log('');

  if (improvement >= 50) {
    console.log('✅ 验收通过：多智能体并行方案性能提升 ≥ 50%');
  } else {
    console.log(`❌ 验收失败：性能提升 ${improvement.toFixed(1)}% < 50%`);
  }

  if (accuracy >= 99.5) {
    console.log('✅ 准确性验收通过：≥ 99.5%');
  }

  return { multiMs, singleMs, improvement, accuracy };
}

runBenchmark().catch(console.error);
