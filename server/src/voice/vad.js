/**
 * VAD（语音活动检测）模块
 *
 * 参考Issue #6验收标准：
 *   - 语音活动检测（VAD）：孩子说完 500ms 后视为结束，不再等待
 *
 * 参考技术架构文档§三「语音交互管道」：
 *   Child voice → WebAudio → WebSocket → ASR(300ms) → ...
 *   VAD负责判定"孩子说完"的时机，触发后续ASR处理
 */

const { EventEmitter } = require('events');

// VAD 状态
const VAD_STATES = {
  IDLE: 'IDLE',         // 空闲，等待语音输入
  SPEAKING: 'SPEAKING', // 检测到语音活动
  SILENCE: 'SILENCE'    // 语音结束后的静音状态
};

/**
 * 创建VAD实例
 * @param {object} options
 * @param {number} options.silenceThresholdMs - 静音判定阈值（毫秒），默认500ms
 * @param {number} options.energyThreshold - 音频能量阈值，默认10
 * @returns {object} VAD实例（EventEmitter）
 */
function createVAD(options = {}) {
  const silenceThresholdMs = options.silenceThresholdMs || 500;
  const energyThreshold = options.energyThreshold || 10;

  let state = VAD_STATES.IDLE;
  let silenceTimer = null;
  let audioChunks = [];

  const emitter = new EventEmitter();

  /**
   * 计算音频chunk的RMS能量
   * @param {Buffer} chunk - 音频数据
   * @returns {number} RMS能量值
   */
  function calculateEnergy(chunk) {
    if (!chunk || chunk.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) {
      sum += chunk[i] * chunk[i];
    }
    return Math.sqrt(sum / chunk.length);
  }

  /**
   * 判断音频chunk是否有语音活动
   * @param {Buffer} chunk - 音频数据
   * @returns {boolean}
   */
  function isVoiceActive(chunk) {
    return calculateEnergy(chunk) >= energyThreshold;
  }

  /**
   * 清除静音计时器
   */
  function clearSilenceTimer() {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  /**
   * 处理音频chunk
   * @param {Buffer} chunk - 音频数据
   */
  function processChunk(chunk) {
    const active = isVoiceActive(chunk);

    if (active) {
      // 有语音活动
      clearSilenceTimer();

      if (state === VAD_STATES.IDLE || state === VAD_STATES.SILENCE) {
        state = VAD_STATES.SPEAKING;
      }

      // 收集音频数据
      audioChunks.push(chunk);
    } else {
      // 静音
      if (state === VAD_STATES.SPEAKING) {
        // 仍在收集，但开始静音计时
        audioChunks.push(chunk);

        clearSilenceTimer();
        silenceTimer = setTimeout(() => {
          // 静音持续超过阈值 → 语音结束
          state = VAD_STATES.SILENCE;

          // 合并音频缓冲区
          const totalLength = audioChunks.reduce((sum, c) => sum + c.length, 0);
          const audioBuffer = Buffer.concat(audioChunks, totalLength);

          emitter.emit('speech_end', audioBuffer);

          // 清空缓冲区
          audioChunks = [];
          silenceTimer = null;
        }, silenceThresholdMs);
        // 允许Node.js进程在只有此定时器时正常退出
        if (silenceTimer.unref) silenceTimer.unref();
      }
    }
  }

  /**
   * 重置VAD状态
   */
  function reset() {
    clearSilenceTimer();
    state = VAD_STATES.IDLE;
    audioChunks = [];
  }

  return Object.assign(emitter, {
    processChunk,
    isVoiceActive,
    getState: () => state,
    reset
  });
}

module.exports = { createVAD, VAD_STATES };
