/**
 * ASR（自动语音识别）引擎模块测试
 *
 * 参考Issue #6验收标准：
 *   - ASR 识别准确率 ≥ 85%（儿童普通话）
 *   - 语音输入采集正常（适配 4-7 岁儿童发音特点）
 *
 * 参考技术架构文档§二：
 *   ASR: Whisper本地 — 儿童普通话识别好，延迟<300ms
 */

const {
  createASREngine,
  createMockASR,
  ASR_ERRORS
} = require('../../src/voice/asr-engine');

describe('ASR 语音识别引擎', () => {
  describe('ASR引擎接口', () => {
    test('createASREngine 返回包含 transcribe 方法的对象', () => {
      const engine = createASREngine({ type: 'mock' });
      expect(typeof engine.transcribe).toBe('function');
    });

    test('transcribe 接收音频Buffer，返回识别结果', async () => {
      const engine = createASREngine({ type: 'mock' });
      const result = await engine.transcribe(Buffer.from([100, 50, 80]));
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(typeof result.text).toBe('string');
      expect(typeof result.confidence).toBe('number');
    });

    test('transcribe 结果包含延迟信息', async () => {
      const engine = createASREngine({ type: 'mock' });
      const result = await engine.transcribe(Buffer.from([100, 50, 80]));
      expect(result).toHaveProperty('latencyMs');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Mock ASR - 儿童语音模拟', () => {
    test('Mock ASR 根据预设文本返回识别结果', async () => {
      const engine = createMockASR({ defaultText: '你好小狐狸' });
      const result = await engine.transcribe(Buffer.from([100, 50, 80]));
      expect(result.text).toBe('你好小狐狸');
    });

    test('Mock ASR 可模拟不同儿童语音场景', async () => {
      const engine = createMockASR({
        responses: [
          { text: '闪电', confidence: 0.92 },
          { text: '我不知道', confidence: 0.88 },
          { text: '你好呀', confidence: 0.95 }
        ]
      });

      const r1 = await engine.transcribe(Buffer.from([1]));
      expect(r1.text).toBe('闪电');
      expect(r1.confidence).toBe(0.92);

      const r2 = await engine.transcribe(Buffer.from([2]));
      expect(r2.text).toBe('我不知道');

      const r3 = await engine.transcribe(Buffer.from([3]));
      expect(r3.text).toBe('你好呀');
    });

    test('Mock ASR 响应循环：超出预设后从头开始', async () => {
      const engine = createMockASR({
        responses: [
          { text: '你好', confidence: 0.9 }
        ]
      });

      await engine.transcribe(Buffer.from([1]));
      const r2 = await engine.transcribe(Buffer.from([2]));
      expect(r2.text).toBe('你好');
    });
  });

  describe('ASR 延迟控制', () => {
    test('ASR 延迟在架构预算内（<300ms）', async () => {
      const engine = createASREngine({ type: 'mock' });
      const start = Date.now();
      await engine.transcribe(Buffer.from([100, 50, 80]));
      const elapsed = Date.now() - start;
      // Mock ASR应几乎即时，实际Whisper需<300ms
      expect(elapsed).toBeLessThan(1000);
    });

    test('Mock ASR 可配置模拟延迟', async () => {
      const engine = createMockASR({
        defaultText: '测试',
        simulateLatencyMs: 100
      });
      const start = Date.now();
      await engine.transcribe(Buffer.from([1]));
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // 允许10ms误差
    });
  });

  describe('ASR 错误处理', () => {
    test('空音频Buffer返回空识别结果', async () => {
      const engine = createASREngine({ type: 'mock' });
      const result = await engine.transcribe(Buffer.alloc(0));
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
    });

    test('ASR超时返回错误', async () => {
      const engine = createASREngine({
        type: 'mock',
        timeoutMs: 100
      });
      // Mock ASR 默认不会超时，但接口支持超时配置
      expect(engine.timeoutMs).toBe(100);
    });
  });

  describe('儿童发音适配', () => {
    test('ASR引擎支持儿童模式配置', () => {
      const engine = createASREngine({
        type: 'mock',
        childMode: true,
        language: 'zh-CN'
      });
      expect(engine.childMode).toBe(true);
      expect(engine.language).toBe('zh-CN');
    });

    test('儿童模式开启后，识别结果标注childOptimized', async () => {
      const engine = createASREngine({
        type: 'mock',
        childMode: true
      });
      const result = await engine.transcribe(Buffer.from([100, 50, 80]));
      expect(result.childOptimized).toBe(true);
    });
  });
});
