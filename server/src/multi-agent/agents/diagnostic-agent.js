/**
 * 诊断智能体 - 分析 bug 根因
 *
 * Issue #23: 步骤2求助台词和暗示选项消息结构不符合预期
 *
 * 职责：
 *   1. 分析名字检测逻辑的误判
 *   2. 分析 WebSocket 消息结构缺陷
 *   3. 输出根因报告和修复建议
 */

const { createAgent } = require('./agent-base');
const { isNameProvided, isGreeting } = require('../../dialog/name-processor');
const { isGreeting: filterGreeting } = require('../../dialog/greeting-filter');

/**
 * 诊断名字检测逻辑
 * @param {string} input - 测试输入
 * @returns {object} 诊断结果
 */
function diagnoseNameDetection(input) {
  const result = {
    input,
    isGreeting: filterGreeting(input),
    isNameProvided: isNameProvided(input),
    rootCause: null,
    fixSuggestion: null
  };

  // 仅当存在误判时才设置 rootCause
  // 误判条件：不是问候语但被识别为名字，且输入包含问候语前缀
  if (!result.isGreeting && result.isNameProvided) {
    const trimmed = input.trim();
    const greetingPrefix = ['你好', '嗨', '哈喽', '哈罗', '早上好', '下午好', '晚上好', '早安', '晚安'].find(g => trimmed.startsWith(g));

    if (greetingPrefix) {
      result.rootCause = `输入 "${input}" 以问候语 "${greetingPrefix}" 开头，但后续内容未被识别为非名字内容，导致整体被误判为名字`;
      result.fixSuggestion = '在 isNameProvided 中增加问候语前缀检测：若输入以问候语开头，则不应识别为名字';
    }
    // 对于正常名字（如"闪电"），不设置 rootCause（这是正确行为）
  }

  return result;
}

/**
 * 诊断 WebSocket 消息结构
 * @param {object} params
 * @param {string[]} params.expectedFields - 期望的字段列表
 * @param {string} params.step - 期望的步骤
 * @returns {object} 诊断结果
 */
function diagnoseWSMessageStructure({ expectedFields, step }) {
  return {
    target: 'ws-voice-handler.js',
    step,
    expectedFields,
    rootCause: 'WebSocket handler 使用条件 spread (result.nameRecorded !== undefined) 包裹 hint 字段，当 nameRecorded 为 false 时虽然 spread 生效，但消息结构未标准化',
    fixSuggestion: '将 hint 相关字段从条件 spread 中提取为独立的标准字段，确保 HELP_REQUEST 步骤始终返回 showHints 和 hints'
  };
}

/**
 * 创建诊断智能体
 */
function createDiagnosticAgent() {
  return createAgent({
    id: 'diagnostic-agent',
    name: '诊断智能体',
    role: '分析 bug 根因，输出修复建议',
    capabilities: ['name-detection-analysis', 'ws-message-analysis'],

    async execute(input, context) {
      const results = {};

      if (input.target === 'name-processor.js') {
        results.diagnosis = diagnoseNameDetection(input.testInput);
      } else if (input.target === 'ws-voice-handler.js') {
        results.diagnosis = diagnoseWSMessageStructure(input);
      }

      // 发布诊断结果供其他智能体使用
      context.publish('COORDINATION', {
        type: 'diagnosis-complete',
        results
      });

      return results;
    }
  });
}

module.exports = { createDiagnosticAgent, diagnoseNameDetection, diagnoseWSMessageStructure };
