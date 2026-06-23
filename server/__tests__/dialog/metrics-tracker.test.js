/**
 * 情感连接指标追踪器 - Issue #28
 *
 * 参考PRD §6.3 验证指标：
 *   - 孩子主动说话次数（3分钟内 ≥3 次 = 情感连接建立）
 *   - 留存意愿（"我明天还来"等表达）
 *
 * 参考技术架构文档§五 MVP验证指标：
 *   | 情感连接建立 | 3分钟内主动说话≥3次 | #1 + #2 + #5 |
 *
 * 职责：
 *   1. 记录每会话孩子主动说话次数
 *   2. 检测并记录留存意愿
 *   3. 输出 first_meeting_reactions 结构供持久化
 */
const {
  createMetricsTracker
} = require('../../src/dialog/metrics-tracker');

describe('情感连接指标追踪器 - Issue #28', () => {
  describe('主动说话计数', () => {
    test('记录有内容的说话 → proactive_speech_count 递增', () => {
      const tracker = createMetricsTracker('session-1', 'child-1');

      tracker.recordSpeech('你好');
      tracker.recordSpeech('我叫小明');

      const metrics = tracker.getMetrics();
      expect(metrics.proactive_speech_count).toBe(2);
    });

    test('空内容或纯空白不计入主动说话', () => {
      const tracker = createMetricsTracker('session-1', 'child-1');

      tracker.recordSpeech('');
      tracker.recordSpeech('   ');
      tracker.recordSpeech('你好');

      const metrics = tracker.getMetrics();
      expect(metrics.proactive_speech_count).toBe(1);
    });

    test('初始 proactive_speech_count 为 0', () => {
      const tracker = createMetricsTracker('session-1', 'child-1');
      const metrics = tracker.getMetrics();
      expect(metrics.proactive_speech_count).toBe(0);
    });
  });

  describe('留存意愿跟踪', () => {
    test('检测到"明天还来"等留存表达 → retention_intention=true', () => {
      const tracker = createMetricsTracker('session-1', 'child-1');

      tracker.recordSpeech('你好');
      tracker.recordRetention('我明天还来');

      const metrics = tracker.getMetrics();
      expect(metrics.retention_intention).toBe(true);
    });

    test('无留存表达 → retention_intention=false', () => {
      const tracker = createMetricsTracker('session-1', 'child-1');
      tracker.recordSpeech('你好');

      const metrics = tracker.getMetrics();
      expect(metrics.retention_intention).toBe(false);
    });

    test('多种留存表达均可识别（明天见/还来/再来/找你玩）', () => {
      const phrases = ['明天见', '我还来', '再来找你玩', '明天还来找你'];
      for (const phrase of phrases) {
        const tracker = createMetricsTracker('s', 'c');
        tracker.recordRetention(phrase);
        expect(tracker.getMetrics().retention_intention).toBe(true);
      }
    });
  });

  describe('toProfileField - 输出 first_meeting_reactions 结构', () => {
    test('输出符合 PRD 定义的 first_meeting_reactions 结构', () => {
      const tracker = createMetricsTracker('session-1', 'child-1');
      tracker.recordSpeech('你好');
      tracker.recordSpeech('我叫小明');
      tracker.recordSpeech('我明天还来');

      const field = tracker.toProfileField();
      expect(field).toHaveProperty('first_meeting_reactions');
      expect(field.first_meeting_reactions).toEqual({
        proactive_speech_count: 3,
        teaching_willingness: null,
        partner_acceptance: null,
        retention_intention: true
      });
    });

    test('情感连接建立判定：3分钟内主动说话≥3次 → emotional_connection_established=true', () => {
      const tracker = createMetricsTracker('session-1', 'child-1');
      tracker.recordSpeech('你好');
      tracker.recordSpeech('我叫小明');
      tracker.recordSpeech('我喜欢恐龙');

      const metrics = tracker.getMetrics();
      expect(metrics.proactive_speech_count).toBe(3);
      expect(metrics.emotional_connection_established).toBe(true);
    });

    test('主动说话<3次 → emotional_connection_established=false', () => {
      const tracker = createMetricsTracker('session-1', 'child-1');
      tracker.recordSpeech('你好');
      tracker.recordSpeech('我叫小明');

      const metrics = tracker.getMetrics();
      expect(metrics.emotional_connection_established).toBe(false);
    });
  });
});
