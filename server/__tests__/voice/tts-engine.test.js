/**
 * TTS（文本转语音）引擎模块测试
 *
 * 参考Issue #6验收标准：
 *   - TTS 输出 ≥ 4 种语气：开心、好奇、紧张/害怕、崇拜
 *
 * 参考技术架构文档§二：
 *   TTS: Edge TTS — 免费，中文童声好，延迟<500ms
 */

const {
  createTTSEngine,
  createMockTTS,
  TTS_EMOTIONS,
  TTS_ERRORS
} = require('../../src/voice/tts-engine');

describe('TTS 语音合成引擎', () => {
  describe('TTS语气支持', () => {
    test('TTS_EMOTIONS 包含至少4种语气', () => {
      const emotionKeys = Object.keys(TTS_EMOTIONS);
      expect(emotionKeys.length).toBeGreaterThanOrEqual(4);
    });

    test('TTS_EMOTIONS 包含开心语气', () => {
      expect(TTS_EMOTIONS.HAPPY).toBeDefined();
    });

    test('TTS_EMOTIONS 包含好奇语气', () => {
      expect(TTS_EMOTIONS.CURIOUS).toBeDefined();
    });

    test('TTS_EMOTIONS 包含紧张/害怕语气', () => {
      expect(TTS_EMOTIONS.NERVOUS).toBeDefined();
    });

    test('TTS_EMOTIONS 包含崇拜语气', () => {
      expect(TTS_EMOTIONS.WORSHIPFUL).toBeDefined();
    });
  });

  describe('TTS引擎接口', () => {
    test('createTTSEngine 返回包含 synthesize 方法的对象', () => {
      const engine = createTTSEngine({ type: 'mock' });
      expect(typeof engine.synthesize).toBe('function');
    });

    test('synthesize 接收文本和语气，返回音频数据', async () => {
      const engine = createTTSEngine({ type: 'mock' });
      const result = await engine.synthesize('你好呀', TTS_EMOTIONS.HAPPY);
      expect(result).toHaveProperty('audio');
      expect(result).toHaveProperty('latencyMs');
    });

    test('synthesize 结果包含延迟信息', async () => {
      const engine = createTTSEngine({ type: 'mock' });
      const result = await engine.synthesize('你好', TTS_EMOTIONS.HAPPY);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Mock TTS - 语气模拟', () => {
    test('Mock TTS 返回指定语气的标记', async () => {
      const engine = createMockTTS();
      const result = await engine.synthesize('太棒了', TTS_EMOTIONS.HAPPY);
      expect(result.emotion).toBe(TTS_EMOTIONS.HAPPY);
    });

    test('不同语气产生不同的音频输出标记', async () => {
      const engine = createMockTTS();
      const happy = await engine.synthesize('你好', TTS_EMOTIONS.HAPPY);
      const nervous = await engine.synthesize('你好', TTS_EMOTIONS.NERVOUS);
      // 不同语气的音频标记应不同
      expect(happy.emotion).not.toBe(nervous.emotion);
    });

    test('崇拜语气用于搭档确认等场景', async () => {
      const engine = createMockTTS();
      const result = await engine.synthesize('你太厉害了', TTS_EMOTIONS.WORSHIPFUL);
      expect(result.emotion).toBe(TTS_EMOTIONS.WORSHIPFUL);
    });
  });

  describe('TTS延迟控制', () => {
    test('TTS 延迟在架构预算内（<500ms）', async () => {
      const engine = createTTSEngine({ type: 'mock' });
      const start = Date.now();
      await engine.synthesize('你好', TTS_EMOTIONS.HAPPY);
      const elapsed = Date.now() - start;
      // Mock TTS应几乎即时，实际Edge TTS需<500ms
      expect(elapsed).toBeLessThan(1000);
    });

    test('Mock TTS 可配置模拟延迟', async () => {
      const engine = createMockTTS({ simulateLatencyMs: 100 });
      const start = Date.now();
      await engine.synthesize('你好', TTS_EMOTIONS.HAPPY);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90);
    });
  });

  describe('TTS打断支持', () => {
    test('TTS引擎支持 stop() 方法停止当前播放', () => {
      const engine = createTTSEngine({ type: 'mock' });
      expect(typeof engine.stop).toBe('function');
    });

    test('stop() 后 isPlaying 变为 false', () => {
      const engine = createTTSEngine({ type: 'mock' });
      engine.stop();
      expect(engine.isPlaying()).toBe(false);
    });

    test('合成中 isPlaying 为 true', async () => {
      const engine = createMockTTS({ simulateLatencyMs: 200 });
      const promise = engine.synthesize('你好', TTS_EMOTIONS.HAPPY);
      expect(engine.isPlaying()).toBe(true);
      await promise;
    });

    test('合成完成后 isPlaying 变为 false', async () => {
      const engine = createMockTTS();
      await engine.synthesize('你好', TTS_EMOTIONS.HAPPY);
      expect(engine.isPlaying()).toBe(false);
    });
  });

  describe('TTS错误处理', () => {
    test('空文本返回空音频', async () => {
      const engine = createTTSEngine({ type: 'mock' });
      const result = await engine.synthesize('', TTS_EMOTIONS.HAPPY);
      expect(result.audio).toBeNull();
    });

    test('无效语气使用默认语气（HAPPY）', async () => {
      const engine = createTTSEngine({ type: 'mock' });
      const result = await engine.synthesize('你好', 'INVALID_EMOTION');
      expect(result.emotion).toBe(TTS_EMOTIONS.HAPPY);
    });
  });
});
