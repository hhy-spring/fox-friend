/**
 * VAD（语音活动检测）模块测试
 *
 * 参考Issue #6验收标准：
 *   - 语音活动检测（VAD）：孩子说完 500ms 后视为结束，不再等待
 *
 * 参考技术架构文档§三「语音交互管道」：
 *   Child voice → WebAudio → WebSocket → ASR(300ms) → ...
 *   VAD负责判定"孩子说完"的时机
 */

const { createVAD } = require('../../src/voice/vad');

describe('VAD 语音活动检测', () => {
  describe('静音检测 - 500ms阈值', () => {
    test('静音持续500ms后触发 speech_end 事件', (done) => {
      const vad = createVAD({ silenceThresholdMs: 500 });

      vad.on('speech_end', (audioBuffer) => {
        expect(audioBuffer).toBeDefined();
        done();
      });

      // 模拟：先有语音活动，然后静音
      vad.processChunk(Buffer.from([100, 50, 80]));  // 有语音
      vad.processChunk(Buffer.from([0, 0, 0]));       // 开始静音

      // 500ms后应触发 speech_end
      setTimeout(() => {
        vad.processChunk(Buffer.from([0, 0, 0]));     // 仍静音，应触发
      }, 550);
    });

    test('静音不足500ms不触发 speech_end', (done) => {
      const vad = createVAD({ silenceThresholdMs: 500 });
      let speechEndFired = false;

      vad.on('speech_end', () => {
        speechEndFired = true;
      });

      vad.processChunk(Buffer.from([100, 50, 80]));  // 有语音
      vad.processChunk(Buffer.from([0, 0, 0]));       // 开始静音

      // 300ms后检查，不应触发
      setTimeout(() => {
        expect(speechEndFired).toBe(false);
        done();
      }, 300);
    });

    test('静音中有新语音活动则重置静音计时', (done) => {
      const vad = createVAD({ silenceThresholdMs: 500 });
      let speechEndCount = 0;

      vad.on('speech_end', () => {
        speechEndCount += 1;
      });

      vad.processChunk(Buffer.from([100, 50, 80]));  // 有语音
      vad.processChunk(Buffer.from([0, 0, 0]));       // 开始静音

      // 300ms后又有语音，重置静音计时
      setTimeout(() => {
        vad.processChunk(Buffer.from([100, 60, 90]));  // 新语音
      }, 300);

      // 再过400ms，不应触发（因为静音计时被重置了）
      setTimeout(() => {
        expect(speechEndCount).toBe(0);
        done();
      }, 700);
    });
  });

  describe('语音活动判定', () => {
    test('音频能量高于阈值判定为有语音', () => {
      const vad = createVAD({ silenceThresholdMs: 500, energyThreshold: 10 });
      const result = vad.isVoiceActive(Buffer.from([100, 50, 80]));
      expect(result).toBe(true);
    });

    test('音频能量低于阈值判定为静音', () => {
      const vad = createVAD({ silenceThresholdMs: 500, energyThreshold: 10 });
      const result = vad.isVoiceActive(Buffer.from([0, 0, 0]));
      expect(result).toBe(false);
    });

    test('儿童发音特点：低能量但有效的短促发音仍判定为有语音', () => {
      const vad = createVAD({ silenceThresholdMs: 500, energyThreshold: 10 });
      // 儿童发音可能能量较低但仍有信号
      const result = vad.isVoiceActive(Buffer.from([15, 12, 18]));
      expect(result).toBe(true);
    });
  });

  describe('VAD状态管理', () => {
    test('初始状态为 IDLE', () => {
      const vad = createVAD({ silenceThresholdMs: 500 });
      expect(vad.getState()).toBe('IDLE');
    });

    test('检测到语音后状态变为 SPEAKING', () => {
      const vad = createVAD({ silenceThresholdMs: 500 });
      vad.processChunk(Buffer.from([100, 50, 80]));
      expect(vad.getState()).toBe('SPEAKING');
    });

    test('语音结束后状态变为 SILENCE', (done) => {
      const vad = createVAD({ silenceThresholdMs: 500 });

      vad.on('speech_end', () => {
        expect(vad.getState()).toBe('SILENCE');
        done();
      });

      vad.processChunk(Buffer.from([100, 50, 80]));
      vad.processChunk(Buffer.from([0, 0, 0]));

      setTimeout(() => {
        vad.processChunk(Buffer.from([0, 0, 0]));
      }, 550);
    });

    test('reset()重置VAD到IDLE状态', () => {
      const vad = createVAD({ silenceThresholdMs: 500 });
      vad.processChunk(Buffer.from([100, 50, 80]));
      expect(vad.getState()).toBe('SPEAKING');

      vad.reset();
      expect(vad.getState()).toBe('IDLE');
    });
  });

  describe('音频缓冲区收集', () => {
    test('speech_end 事件携带完整音频缓冲区', (done) => {
      const vad = createVAD({ silenceThresholdMs: 500 });

      vad.on('speech_end', (audioBuffer) => {
        // 缓冲区应包含所有语音chunk
        expect(audioBuffer.length).toBeGreaterThan(0);
        done();
      });

      vad.processChunk(Buffer.from([100, 50, 80]));
      vad.processChunk(Buffer.from([120, 60, 90]));
      vad.processChunk(Buffer.from([0, 0, 0]));

      setTimeout(() => {
        vad.processChunk(Buffer.from([0, 0, 0]));
      }, 550);
    });
  });
});
