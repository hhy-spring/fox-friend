/**
 * ASR（自动语音识别）引擎模块
 *
 * 参考Issue #6验收标准：
 *   - ASR 识别准确率 ≥ 85%（儿童普通话）
 *   - 语音输入采集正常（适配 4-7 岁儿童发音特点）
 *
 * 参考技术架构文档§二：
 *   ASR: Whisper本地 — 儿童普通话识别好，延迟<300ms
 *
 * 架构设计：抽象接口 + 可插拔实现
 *   - MockASR：测试用模拟实现
 *   - WhisperASR：生产环境Whisper本地实现（后续集成）
 */

// ASR错误类型
const ASR_ERRORS = {
  TIMEOUT: 'ASR_TIMEOUT',
  NO_SPEECH: 'ASR_NO_SPEECH',
  ENGINE_ERROR: 'ASR_ENGINE_ERROR'
};

/**
 * 创建Mock ASR引擎（测试用）
 * @param {object} options
 * @param {string} options.defaultText - 默认识别文本
 * @param {Array} options.responses - 预设响应列表
 * @param {number} options.simulateLatencyMs - 模拟延迟
 * @returns {object} Mock ASR引擎
 */
function createMockASR(options = {}) {
  const defaultText = options.defaultText || '你好';
  const responses = options.responses || null;
  const simulateLatencyMs = options.simulateLatencyMs || 0;
  let responseIndex = 0;

  return {
    childMode: true,
    language: 'zh-CN',
    timeoutMs: options.timeoutMs || 5000,

    /**
     * 识别音频
     * @param {Buffer} audioBuffer - 音频数据
     * @returns {Promise<{text: string, confidence: number, latencyMs: number, childOptimized: boolean}>}
     */
    async transcribe(audioBuffer) {
      const startTime = Date.now();

      // 模拟延迟
      if (simulateLatencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, simulateLatencyMs));
      }

      // 空音频
      if (!audioBuffer || audioBuffer.length === 0) {
        return {
          text: '',
          confidence: 0,
          latencyMs: Date.now() - startTime,
          childOptimized: true
        };
      }

      // 从预设响应中获取结果
      let result;
      if (responses && responses.length > 0) {
        result = responses[responseIndex % responses.length];
        responseIndex += 1;
      } else {
        result = { text: defaultText, confidence: 0.9 };
      }

      return {
        text: result.text,
        confidence: result.confidence,
        latencyMs: Date.now() - startTime,
        childOptimized: true
      };
    }
  };
}

/**
 * 创建ASR引擎
 * @param {object} options
 * @param {string} options.type - 引擎类型：'mock' | 'whisper'
 * @param {boolean} options.childMode - 儿童模式
 * @param {string} options.language - 语言
 * @param {number} options.timeoutMs - 超时时间
 * @returns {object} ASR引擎
 */
function createASREngine(options = {}) {
  const type = options.type || 'mock';
  const childMode = options.childMode !== false;
  const language = options.language || 'zh-CN';
  const timeoutMs = options.timeoutMs || 5000;

  if (type === 'mock') {
    const engine = createMockASR(options);
    engine.childMode = childMode;
    engine.language = language;
    engine.timeoutMs = timeoutMs;
    return engine;
  }

  // Whisper本地实现（后续集成）
  if (type === 'whisper') {
    // TODO: 集成Whisper本地模型
    // 参考架构文档§二：Whisper本地，延迟<300ms
    throw new Error('Whisper ASR 尚未实现，请使用 type: "mock"');
  }

  throw new Error(`不支持的ASR引擎类型: ${type}`);
}

module.exports = { createASREngine, createMockASR, ASR_ERRORS };
