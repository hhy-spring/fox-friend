/**
 * 语音管道编排器
 *
 * 参考Issue #6验收标准：
 *   - 回复延迟 P50 < 2 秒，P95 < 2.5 秒
 *   - 打断机制：检测到孩子声音 → 立即停止当前 TTS 播放 → 进入新一轮对话
 *   - 降级方案：网络超时 3 秒 → 小狐狸缓冲台词（如「让我想想...」）
 *
 * 参考技术架构文档§三「语音交互管道」：
 *   Child voice → WebAudio → WebSocket → ASR(300ms) → LLM(800ms) → TTS(500ms) → WebSocket → Playback
 *   端到端P95: ~1800ms ✅
 */

const { EventEmitter } = require('events');

// 管道事件
const PIPELINE_EVENTS = {
  INTERRUPTED: 'interrupted',
  FALLBACK: 'fallback',
  PROCESSING_COMPLETE: 'processing_complete',
  ERROR: 'error'
};

// 降级缓冲台词
const FALLBACK_LINES = [
  '让我想想...',
  '嗯...我需要想一想...',
  '等一下哦，我在想...'
];

// 延迟历史最大记录数，超出时移除最早记录（防止内存泄漏）
const MAX_LATENCY_HISTORY = 1000;

// 管道状态
const PIPELINE_STATES = {
  IDLE: 'IDLE',
  PROCESSING: 'PROCESSING'
};

/**
 * 创建语音管道
 * @param {object} options
 * @param {object} options.asr - ASR引擎实例
 * @param {object} options.tts - TTS引擎实例
 * @param {object} options.vad - VAD实例
 * @param {function} options.dialogHandler - 对话处理函数 async (text) => {replyText, emotion}
 * @param {number} options.timeoutMs - 超时时间（毫秒），默认3000
 * @returns {object} 语音管道实例（EventEmitter）
 */
function createVoicePipeline(options = {}) {
  const asr = options.asr;
  const tts = options.tts;
  const vad = options.vad;
  const dialogHandler = options.dialogHandler;
  const timeoutMs = options.timeoutMs || 3000;

  let state = PIPELINE_STATES.IDLE;
  let interrupted = false;
  const latencyHistory = [];

  const emitter = new EventEmitter();

  /**
   * 处理音频输入
   * @param {Buffer} audioBuffer - 音频数据
   * @returns {Promise<object>} 处理结果
   */
  async function processAudio(audioBuffer) {
    // 空音频
    if (!audioBuffer || audioBuffer.length === 0) {
      return {
        replyAudio: null,
        replyText: '',
        emotion: null,
        latencyMs: 0,
        latencyBreakdown: { asrMs: 0, dialogMs: 0, ttsMs: 0 }
      };
    }

    state = PIPELINE_STATES.PROCESSING;
    interrupted = false;
    const pipelineStart = Date.now();

    try {
      // 阶段1：ASR识别
      const asrStart = Date.now();
      const asrResult = await asr.transcribe(audioBuffer);
      const asrMs = Date.now() - asrStart;

      // 检查是否被打断
      if (interrupted) {
        state = PIPELINE_STATES.IDLE;
        return {
          replyAudio: null,
          replyText: '',
          emotion: null,
          latencyMs: Date.now() - pipelineStart,
          latencyBreakdown: { asrMs, dialogMs: 0, ttsMs: 0 },
          interrupted: true
        };
      }

      // 阶段2：对话处理（含超时降级）
      const dialogStart = Date.now();
      let dialogResult;
      let fallback = false;

      try {
        dialogResult = await Promise.race([
          dialogHandler(asrResult.text),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DIALOG_TIMEOUT')), timeoutMs)
          )
        ]);
      } catch (err) {
        if (err.message === 'DIALOG_TIMEOUT') {
          // 降级：返回缓冲台词
          fallback = true;
          const fallbackLine = FALLBACK_LINES[Math.floor(Math.random() * FALLBACK_LINES.length)];
          dialogResult = {
            replyText: fallbackLine,
            emotion: 'nervous'
          };
          emitter.emit(PIPELINE_EVENTS.FALLBACK, { fallbackLine });
        } else {
          throw err;
        }
      }

      const dialogMs = Date.now() - dialogStart;

      // 检查是否被打断
      if (interrupted) {
        state = PIPELINE_STATES.IDLE;
        return {
          replyAudio: null,
          replyText: '',
          emotion: null,
          latencyMs: Date.now() - pipelineStart,
          latencyBreakdown: { asrMs, dialogMs, ttsMs: 0 },
          interrupted: true
        };
      }

      // 阶段3：TTS合成
      const ttsStart = Date.now();
      const ttsResult = await tts.synthesize(dialogResult.replyText, dialogResult.emotion);
      const ttsMs = Date.now() - ttsStart;

      const totalLatencyMs = Date.now() - pipelineStart;

      // 记录延迟（限制最大长度，防止内存泄漏）
      latencyHistory.push(totalLatencyMs);
      if (latencyHistory.length > MAX_LATENCY_HISTORY) {
        latencyHistory.shift();
      }

      state = PIPELINE_STATES.IDLE;

      const result = {
        replyAudio: ttsResult.audio,
        replyText: dialogResult.replyText,
        emotion: ttsResult.emotion,
        latencyMs: totalLatencyMs,
        latencyBreakdown: { asrMs, dialogMs, ttsMs },
        interrupted: false
      };

      if (fallback) {
        result.fallback = true;
      }

      emitter.emit(PIPELINE_EVENTS.PROCESSING_COMPLETE, result);
      return result;

    } catch (err) {
      state = PIPELINE_STATES.IDLE;
      emitter.emit(PIPELINE_EVENTS.ERROR, err);
      throw err;
    }
  }

  /**
   * 打断当前处理
   */
  function interrupt() {
    interrupted = true;
    state = PIPELINE_STATES.IDLE;
    tts.stop();
    emitter.emit(PIPELINE_EVENTS.INTERRUPTED);
  }

  /**
   * 获取延迟统计
   * @returns {{p50: number, p95: number, count: number}}
   */
  function getLatencyStats() {
    if (latencyHistory.length === 0) {
      return { p50: 0, p95: 0, count: 0 };
    }

    const sorted = [...latencyHistory].sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      p50: sorted[p50Index],
      p95: sorted[Math.min(p95Index, sorted.length - 1)],
      count: sorted.length
    };
  }

  /**
   * 获取管道状态
   * @returns {string}
   */
  function getState() {
    return state;
  }

  return Object.assign(emitter, {
    processAudio,
    interrupt,
    getLatencyStats,
    getState
  });
}

module.exports = { createVoicePipeline, PIPELINE_EVENTS, FALLBACK_LINES, PIPELINE_STATES };
