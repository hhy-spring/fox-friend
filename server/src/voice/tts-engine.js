/**
 * TTS（文本转语音）引擎模块
 *
 * 参考Issue #6验收标准：
 *   - TTS 输出 ≥ 4 种语气：开心、好奇、紧张/害怕、崇拜
 *
 * 参考技术架构文档§二：
 *   TTS: Edge TTS — 免费，中文童声好，延迟<500ms
 *
 * 架构设计：抽象接口 + 可插拔实现
 *   - MockTTS：测试用模拟实现
 *   - EdgeTTS：生产环境Edge TTS实现（后续集成）
 */

// TTS语气类型 — 对应Issue #6验收标准
const TTS_EMOTIONS = {
  HAPPY: 'happy',           // 开心 — 出场、命名仪式、搭档确认
  CURIOUS: 'curious',       // 好奇 — 求助、画像采集追问
  NERVOUS: 'nervous',       // 紧张/害怕 — 出场害羞、脆弱分享
  WORSHIPFUL: 'worshipful'  // 崇拜 — 费曼触发、搭档确认崇拜
};

// TTS错误类型
const TTS_ERRORS = {
  SYNTHESIS_FAILED: 'TTS_SYNTHESIS_FAILED',
  INTERRUPTED: 'TTS_INTERRUPTED',
  TIMEOUT: 'TTS_TIMEOUT'
};

/**
 * 创建Mock TTS引擎（测试用）
 * @param {object} options
 * @param {number} options.simulateLatencyMs - 模拟延迟
 * @returns {object} Mock TTS引擎
 */
function createMockTTS(options = {}) {
  const simulateLatencyMs = options.simulateLatencyMs || 0;
  let playing = false;

  return {
    /**
     * 合成语音
     * @param {string} text - 要合成的文本
     * @param {string} emotion - 语气类型
     * @returns {Promise<{audio: Buffer|null, latencyMs: number, emotion: string}>}
     */
    async synthesize(text, emotion) {
      playing = true;
      const startTime = Date.now();

      // 模拟延迟
      if (simulateLatencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, simulateLatencyMs));
      }

      // 空文本
      if (!text || text.trim().length === 0) {
        playing = false;
        return {
          audio: null,
          latencyMs: Date.now() - startTime,
          emotion: emotion || TTS_EMOTIONS.HAPPY
        };
      }

      // 无效语气 → 使用默认HAPPY
      const validEmotion = Object.values(TTS_EMOTIONS).includes(emotion)
        ? emotion
        : TTS_EMOTIONS.HAPPY;

      // 生成模拟音频数据
      const audioBuffer = Buffer.from(`tts:${validEmotion}:${text}`);

      playing = false;
      return {
        audio: audioBuffer,
        latencyMs: Date.now() - startTime,
        emotion: validEmotion
      };
    },

    /**
     * 停止当前播放
     */
    stop() {
      playing = false;
    },

    /**
     * 是否正在播放
     * @returns {boolean}
     */
    isPlaying() {
      return playing;
    }
  };
}

/**
 * 创建TTS引擎
 * @param {object} options
 * @param {string} options.type - 引擎类型：'mock' | 'edge'
 * @returns {object} TTS引擎
 */
function createTTSEngine(options = {}) {
  const type = options.type || 'mock';

  if (type === 'mock') {
    return createMockTTS(options);
  }

  // Edge TTS实现（后续集成）
  if (type === 'edge') {
    // TODO: 集成Edge TTS
    // 参考架构文档§二：Edge TTS，延迟<500ms
    throw new Error('Edge TTS 尚未实现，请使用 type: "mock"');
  }

  throw new Error(`不支持的TTS引擎类型: ${type}`);
}

module.exports = { createTTSEngine, createMockTTS, TTS_EMOTIONS, TTS_ERRORS };
