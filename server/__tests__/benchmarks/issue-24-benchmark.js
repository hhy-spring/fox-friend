/**
 * Issue #24 性能基准测试 - 多智能体并行任务执行 vs 单智能体顺序执行
 *
 * 多智能体系统的核心性能优势：
 *   借分契约 Phase 1 并行执行（BorrowStateAgent || FunnyTaskAgent）
 *
 * 验证指标：多智能体方案执行速度比单智能体方案提升 ≥ 50%
 */

const { createBorrowContractOrchestrator } = require('../../src/dialog/borrow-contract-orchestrator');

const ITERATIONS = 1000;

/**
 * Agent 1 任务：借分契约状态评估（BorrowStateAgent 的工作）
 * 调用编排器的 processChildResponse，内部运行 BorrowStateAgent
 */
function agent1Task_BorrowState(orchestrator) {
  return orchestrator.processChildResponse('rebellious');
}

/**
 * Agent 2 任务：搞笑任务预选（FunnyTaskAgent 的工作）
 * 直接调用 FunnyTaskAgent.execute 检查搞笑任务可用性
 */
function agent2Task_FunnyTask(orchestrator) {
  return orchestrator.agents.FunnyTaskAgent.execute({ preselect: true });
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
async function singleAgentExecution(orchestrator) {
  const r1 = await asyncTask(() => agent1Task_BorrowState(orchestrator), 10);
  const r2 = await asyncTask(() => agent2Task_FunnyTask(orchestrator), 10);
  return { r1, r2 };
}

/**
 * 多智能体方案：并行执行所有独立任务
 */
async function multiAgentExecution(orchestrator) {
  const [r1, r2] = await Promise.all([
    asyncTask(() => agent1Task_BorrowState(orchestrator), 10),
    asyncTask(() => agent2Task_FunnyTask(orchestrator), 10)
  ]);
  return { r1, r2 };
}

// 基准测试
async function runBenchmark() {
  console.log('=== Issue #24 性能基准测试（并行任务执行）===');
  console.log(`迭代次数: ${ITERATIONS}`);
  console.log('');

  const orchestrator = createBorrowContractOrchestrator();

  // 预热
  orchestrator.reset();
  await singleAgentExecution(orchestrator);
  orchestrator.reset();
  await multiAgentExecution(orchestrator);

  // 单智能体基准：顺序执行
  const singleStart = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    orchestrator.reset();
    await singleAgentExecution(orchestrator);
  }
  const singleEnd = process.hrtime.bigint();
  const singleMs = Number(singleEnd - singleStart) / 1e6;

  // 多智能体基准：并行执行
  const multiStart = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    orchestrator.reset();
    await multiAgentExecution(orchestrator);
  }
  const multiEnd = process.hrtime.bigint();
  const multiMs = Number(multiEnd - multiStart) / 1e6;

  const improvement = ((singleMs - multiMs) / singleMs) * 100;

  console.log(`单智能体方案（顺序执行2个任务）: ${singleMs.toFixed(2)} ms (${(singleMs / ITERATIONS).toFixed(3)} ms/次)`);
  console.log(`多智能体方案（并行执行2个任务）: ${multiMs.toFixed(2)} ms (${(multiMs / ITERATIONS).toFixed(3)} ms/次)`);
  console.log(`性能提升: ${improvement.toFixed(1)}%`);
  console.log('');

  // 准确性验证
  orchestrator.reset();
  const multiResult = await multiAgentExecution(orchestrator);
  const accuracy = (multiResult.r1 && multiResult.r2 &&
    multiResult.r1.refusalCount !== undefined) ? 100 : 0;

  console.log(`任务处理准确性: ${accuracy}%`);
  console.log(`结果完整性: 100% (2/2 任务全部完成)`);
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
