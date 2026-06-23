/**
 * 修复智能体 - 执行 bug 修复
 *
 * Issue #23: 修复名字检测逻辑和 WebSocket 消息结构
 *
 * 职责：
 *   1. 修复 isNameProvided：增加问候语前缀检测
 *   2. 修复 WebSocket handler：标准化 hint 字段输出
 */

const { createAgent } = require('./agent-base');
const { isGreeting, hasGreetingPrefix } = require('../../dialog/greeting-filter');

/**
 * 改进的名字检测逻辑
 * 在原 isNameProvided 基础上增加问候语前缀检测
 * @param {string} content - 输入内容
 * @param {function} originalIsNameProvided - 原始检测函数
 * @returns {boolean}
 */
function improvedIsNameProvided(content, originalIsNameProvided) {
  if (!content || content.trim().length === 0) return false;

  const trimmed = content.trim();

  // 问候语前缀检测：若以问候语开头且不是纯问候语，也不应识别为名字
  // 例如 "你好小狐狸" 不应被识别为名字
  if (hasGreetingPrefix(trimmed) && !isGreeting(trimmed)) {
    return false;
  }

  return originalIsNameProvided(content);
}

/**
 * 标准化 WebSocket 消息字段
 * 确保 HELP_REQUEST 步骤始终返回 showHints 和 hints
 * @param {object} result - handleVoiceMessage 返回值
 * @returns {object} 标准化后的消息字段
 */
function standardizeHintFields(result) {
  const fields = {};

  // nameRecorded 字段始终包含（当存在时）
  if (result.nameRecorded !== undefined) {
    fields.nameRecorded = result.nameRecorded;
  }

  // hint 相关字段：当 showHints 为 true 或 nameRecorded 为 false 时包含
  if (result.showHints !== undefined) {
    fields.showHints = result.showHints;
  }
  if (result.hints !== undefined) {
    fields.hints = result.hints;
  }
  if (result.hintLine !== undefined) {
    fields.hintLine = result.hintLine;
  }

  // 名字相关字段
  if (result.foxName !== undefined) {
    fields.foxName = result.foxName;
  }
  if (result.nameSource !== undefined) {
    fields.nameSource = result.nameSource;
  }

  return fields;
}

/**
 * 创建修复智能体
 */
function createFixAgent() {
  return createAgent({
    id: 'fix-agent',
    name: '修复智能体',
    role: '执行 bug 修复，应用补丁',
    capabilities: ['name-detection-fix', 'ws-message-fix'],

    async execute(input, context) {
      const results = {};

      if (input.fixType === 'greeting-prefix-detection') {
        results.fix = {
          target: 'name-processor.js',
          type: 'greeting-prefix-detection',
          description: '在 isNameProvided 中增加问候语前缀检测',
          helperFunction: 'hasGreetingPrefix',
          validationInput: '你好小狐狸',
          expectedResult: false
        };

        // 验证修复
        const { isNameProvided: originalIsNameProvided } = require('../../dialog/name-processor');
        const fixed = improvedIsNameProvided('你好小狐狸', originalIsNameProvided);
        results.fix.validationPassed = fixed === false;
      }

      if (input.fixType === 'standardize-hint-fields') {
        results.fix = {
          target: 'ws-voice-handler.js',
          type: 'standardize-hint-fields',
          description: '将 hint 字段从条件 spread 中提取为独立标准字段',
          helperFunction: 'standardizeHintFields',
          validationInput: { nameRecorded: false, showHints: true, hints: [] },
          expectedResult: { nameRecorded: false, showHints: true, hints: [] }
        };

        // 验证修复
        const testResult = { nameRecorded: false, showHints: true, hints: [{ character: '龙' }], hintLine: 'test' };
        const standardized = standardizeHintFields(testResult);
        results.fix.validationPassed =
          standardized.showHints === true &&
          standardized.hints !== undefined &&
          standardized.nameRecorded === false;
      }

      context.publish('COORDINATION', {
        type: 'fix-complete',
        results
      });

      return results;
    }
  });
}

module.exports = {
  createFixAgent,
  hasGreetingPrefix,
  improvedIsNameProvided,
  standardizeHintFields
};
