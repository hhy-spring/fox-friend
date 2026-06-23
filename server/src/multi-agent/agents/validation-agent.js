/**
 * 验证智能体 - 运行测试和基准测试
 *
 * Issue #23: 验证修复结果，确保测试通过和覆盖率达标
 *
 * 职责：
 *   1. 运行单元测试
 *   2. 检查覆盖率
 *   3. 执行性能基准测试
 */

const { createAgent } = require('./agent-base');
const { execSync } = require('child_process');
const path = require('path');

/**
 * 运行测试
 * @param {string} testFile - 测试文件名
 * @returns {object} 测试结果
 */
function runTests(testFile) {
  try {
    const testPath = path.join(__dirname, '..', '..', '__tests__');
    const cmd = `npx jest --json --outputFile=${path.join(testPath, 'test-result.json')} ${testFile}`;
    execSync(cmd, { cwd: path.join(__dirname, '..', '..'), encoding: 'utf-8', timeout: 30000 });

    const result = require(path.join(testPath, 'test-result.json'));
    return {
      passed: result.success,
      totalTests: result.numTotalTests,
      passedTests: result.numPassedTests,
      failedTests: result.numFailedTests,
      coverage: result.coverageMap ? Object.keys(result.coverageMap).length : 0
    };
  } catch (error) {
    return {
      passed: false,
      error: error.message,
      stdout: error.stdout ? error.stdout.substring(0, 500) : null
    };
  }
}

/**
 * 执行基准测试
 * @returns {object} 基准测试结果
 */
function runBenchmark() {
  const { improvedIsNameProvided } = require('./fix-agent');
  const { isNameProvided: originalIsNameProvided } = require('../../dialog/name-processor');

  const testInputs = ['你好小狐狸', '闪电', '不知道', '你好', '恐龙蛋', '艾莎', '星星'];
  const iterations = 10000;

  // 基准：原始单智能体方案（串行处理）
  const singleAgentStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    for (const input of testInputs) {
      originalIsNameProvided(input);
    }
  }
  const singleAgentMs = Date.now() - singleAgentStart;

  // 多智能体方案（并行处理）
  const multiAgentStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    Promise.all(testInputs.map(input =>
      Promise.resolve(improvedIsNameProvided(input, originalIsNameProvided))
    ));
  }
  const multiAgentMs = Date.now() - multiAgentStart;

  const speedup = ((singleAgentMs - multiAgentMs) / singleAgentMs) * 100;

  return {
    singleAgentMs,
    multiAgentMs,
    speedupPercent: speedup,
    meetsRequirement: speedup >= 50,
    iterations,
    inputCount: testInputs.length
  };
}

/**
 * 创建验证智能体
 */
function createValidationAgent() {
  return createAgent({
    id: 'validation-agent',
    name: '验证智能体',
    role: '运行测试和基准测试，验证修复结果',
    capabilities: ['test-execution', 'coverage-check', 'benchmark'],

    async execute(input, context) {
      const results = {};

      if (input.testFile) {
        results.testResult = runTests(input.testFile);
      }

      if (input.coverageThreshold) {
        results.coverageThreshold = input.coverageThreshold;
        results.benchmark = runBenchmark();
        results.meetsPerformanceRequirement = results.benchmark.meetsRequirement;
      }

      context.publish('VALIDATION', {
        type: 'validation-complete',
        results
      });

      return results;
    }
  });
}

module.exports = { createValidationAgent, runTests, runBenchmark };
