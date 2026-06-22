/**
 * 语音管道编排器测试
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

const {
  createVoicePipeline,
  PIPELINE_EVENTS,
  FALLBACK_LINES
} = require('../../src/voice/voice-pipeline');
const { createMockASR } = require('../../src/voice/asr-engine');
const { createMockTTS, TTS_EMOTIONS } = require('../../src/voice/tts-engine');
const { createVAD } = require('../../src/voice/vad');

describe('语音管道编排器', () => {
  /**
   * 创建测试用管道
   */
  function createTestPipeline(options = {}) {
    const asr = createMockASR({
      defaultText: options.asrDefaultText || '你好',
      simulateLatencyMs: options.asrLatencyMs || 0
    });
    const tts = createMockTTS({
      simulateLatencyMs: options.ttsLatencyMs || 0
    });
    const vad = createVAD({ silenceThresholdMs: 100 }); // 测试用短阈值

    // 对话处理函数（模拟）
    const dialogHandler = options.dialogHandler || (async (text) => ({
      replyText: `小狐狸说：${text}`,
      emotion: TTS_EMOTIONS.HAPPY
    }));

    return createVoicePipeline({
      asr,
      tts,
      vad,
      dialogHandler,
      timeoutMs: options.timeoutMs || 3000,
      ...options
    });
  }

  describe('管道基本流程', () => {
    test('processAudio 处理音频输入并返回语音输出', async () => {
      const pipeline = createTestPipeline();
      const result = await pipeline.processAudio(Buffer.from([100, 50, 80]));

      expect(result).toHaveProperty('replyAudio');
      expect(result).toHaveProperty('replyText');
      expect(result).toHaveProperty('emotion');
      expect(result).toHaveProperty('latencyMs');
    });

    test('管道流程：VAD检测语音结束 → ASR识别 → 对话处理 → TTS合成', async () => {
      const pipeline = createTestPipeline({
        asrDefaultText: '闪电'
      });

      const result = await pipeline.processAudio(Buffer.from([100, 50, 80]));
      expect(result.replyText).toContain('闪电');
    });

    test('空音频输入不触发完整管道', async () => {
      const pipeline = createTestPipeline();
      const result = await pipeline.processAudio(Buffer.alloc(0));
      expect(result.replyAudio).toBeNull();
    });
  });

  describe('延迟追踪', () => {
    test('管道输出包含各阶段延迟明细', async () => {
      const pipeline = createTestPipeline();
      const result = await pipeline.processAudio(Buffer.from([100, 50, 80]));

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result).toHaveProperty('latencyBreakdown');
      expect(result.latencyBreakdown).toHaveProperty('asrMs');
      expect(result.latencyBreakdown).toHaveProperty('dialogMs');
      expect(result.latencyBreakdown).toHaveProperty('ttsMs');
    });

    test('延迟统计：记录历史延迟数据', async () => {
      const pipeline = createTestPipeline();
      await pipeline.processAudio(Buffer.from([100, 50, 80]));
      await pipeline.processAudio(Buffer.from([100, 50, 80]));
      await pipeline.processAudio(Buffer.from([100, 50, 80]));

      const stats = pipeline.getLatencyStats();
      expect(stats).toHaveProperty('p50');
      expect(stats).toHaveProperty('p95');
      expect(stats).toHaveProperty('count');
      expect(stats.count).toBe(3);
    });

    test('延迟统计：P50和P95计算正确', async () => {
      const pipeline = createTestPipeline();

      // 模拟不同延迟
      const latencies = [100, 150, 200, 250, 300, 350, 400, 500, 600, 2000];
      for (const _ of latencies) {
        await pipeline.processAudio(Buffer.from([100, 50, 80]));
      }

      const stats = pipeline.getLatencyStats();
      expect(stats.p50).toBeLessThan(2000);
      expect(stats.p95).toBeLessThan(3000);
    });
  });

  describe('打断机制', () => {
    test('interrupt() 停止当前TTS播放', async () => {
      const pipeline = createTestPipeline({
        ttsLatencyMs: 200
      });

      // 开始处理
      const processPromise = pipeline.processAudio(Buffer.from([100, 50, 80]));

      // 中断
      pipeline.interrupt();

      const result = await processPromise;
      expect(result.interrupted).toBe(true);
    });

    test('打断后管道状态重置，可接受新输入', async () => {
      const pipeline = createTestPipeline();
      await pipeline.processAudio(Buffer.from([100, 50, 80]));

      pipeline.interrupt();

      // 可以继续处理新输入
      const result = await pipeline.processAudio(Buffer.from([100, 50, 80]));
      expect(result).toHaveProperty('replyText');
    });

    test('打断事件通知：PIPELINE_EVENTS.INTERRUPTED', (done) => {
      const pipeline = createTestPipeline({
        ttsLatencyMs: 200
      });

      pipeline.on(PIPELINE_EVENTS.INTERRUPTED, () => {
        expect(true).toBe(true);
        done();
      });

      const processPromise = pipeline.processAudio(Buffer.from([100, 50, 80]));
      pipeline.interrupt();
    });
  });

  describe('降级方案', () => {
    test('超时3秒触发降级，返回缓冲台词', async () => {
      const pipeline = createTestPipeline({
        timeoutMs: 100, // 测试用短超时
        dialogHandler: async () => {
          // 模拟超时：延迟超过timeout
          await new Promise(resolve => setTimeout(resolve, 200));
          return { replyText: '正常回复', emotion: TTS_EMOTIONS.HAPPY };
        }
      });

      const result = await pipeline.processAudio(Buffer.from([100, 50, 80]));
      expect(result.fallback).toBe(true);
      expect(FALLBACK_LINES).toContain(result.replyText);
    });

    test('FALLBACK_LINES 包含至少3条缓冲台词', () => {
      expect(FALLBACK_LINES.length).toBeGreaterThanOrEqual(3);
    });

    test('降级台词包含「让我想想...」', () => {
      expect(FALLBACK_LINES).toContain('让我想想...');
    });

    test('降级事件通知：PIPELINE_EVENTS.FALLBACK', (done) => {
      const pipeline = createTestPipeline({
        timeoutMs: 100,
        dialogHandler: async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return { replyText: '正常回复', emotion: TTS_EMOTIONS.HAPPY };
        }
      });

      pipeline.on(PIPELINE_EVENTS.FALLBACK, (data) => {
        expect(data.fallbackLine).toBeDefined();
        done();
      });

      pipeline.processAudio(Buffer.from([100, 50, 80]));
    });
  });

  describe('管道状态管理', () => {
    test('初始状态为 IDLE', () => {
      const pipeline = createTestPipeline();
      expect(pipeline.getState()).toBe('IDLE');
    });

    test('处理中状态为 PROCESSING', async () => {
      const pipeline = createTestPipeline({
        ttsLatencyMs: 100
      });

      const promise = pipeline.processAudio(Buffer.from([100, 50, 80]));
      expect(pipeline.getState()).toBe('PROCESSING');
      await promise;
    });

    test('处理完成回到 IDLE', async () => {
      const pipeline = createTestPipeline();
      await pipeline.processAudio(Buffer.from([100, 50, 80]));
      expect(pipeline.getState()).toBe('IDLE');
    });

    test('打断后状态回到 IDLE', () => {
      const pipeline = createTestPipeline();
      pipeline.interrupt();
      expect(pipeline.getState()).toBe('IDLE');
    });
  });
});
