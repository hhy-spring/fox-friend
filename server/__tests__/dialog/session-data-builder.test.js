/**
 * 会话数据构建器 - Issue #8 每日拼音教学
 *
 * 参考PRD §4.2 session_data 结构：
 *   date, story_stage, subject, items_learned, mastery_status,
 *   child_mood, chat_frequency, teaching_method_used,
 *   duration_minutes, child_spontaneous_remarks
 *
 * 测试覆盖：
 *   - buildSessionData：完整字段返回包含所有10个字段的对象
 *   - buildSessionData：date 为 ISO 字符串、items_learned 为数组等类型校验
 *   - buildSessionData：空参数返回默认值
 *   - addSpontaneousRemark / getSpontaneousRemarks：增量捕获孩子自发话语
 *   - reset：清空内部 remarks 列表
 *   - buildFromContext：合并提供字段与默认值
 *   - buildFromContext：使用内部追踪的 remarks
 *   - child_spontaneous_remarks 捕获非学习信息
 */

const { createSessionDataBuilder } = require('../../src/dialog/session-data-builder');

describe('会话数据构建器 - Issue #8 每日拼音教学', () => {
  describe('buildSessionData() - 构建完整 session_data', () => {
    test('传入所有字段时返回包含全部 10 个字段的对象', () => {
      const builder = createSessionDataBuilder();
      const sessionData = builder.buildSessionData({
        storyStage: 'letter_stone',
        subject: 'pinyin',
        itemsLearned: ['a', 'o', 'e'],
        masteryStatus: { a: 'mastered', o: 'learning', e: 'new' },
        childMood: 'energetic',
        chatFrequency: 8,
        teachingMethod: 'feynman',
        durationMinutes: 15,
        childSpontaneousRemarks: ['今天好开心']
      });

      // PRD §4.2 要求的所有 10 个字段
      expect(sessionData).toHaveProperty('date');
      expect(sessionData).toHaveProperty('story_stage');
      expect(sessionData).toHaveProperty('subject');
      expect(sessionData).toHaveProperty('items_learned');
      expect(sessionData).toHaveProperty('mastery_status');
      expect(sessionData).toHaveProperty('child_mood');
      expect(sessionData).toHaveProperty('chat_frequency');
      expect(sessionData).toHaveProperty('teaching_method_used');
      expect(sessionData).toHaveProperty('duration_minutes');
      expect(sessionData).toHaveProperty('child_spontaneous_remarks');

      // 验证字段值正确映射
      expect(sessionData.story_stage).toBe('letter_stone');
      expect(sessionData.subject).toBe('pinyin');
      expect(sessionData.items_learned).toEqual(['a', 'o', 'e']);
      expect(sessionData.mastery_status).toEqual({ a: 'mastered', o: 'learning', e: 'new' });
      expect(sessionData.child_mood).toBe('energetic');
      expect(sessionData.chat_frequency).toBe(8);
      expect(sessionData.teaching_method_used).toBe('feynman');
      expect(sessionData.duration_minutes).toBe(15);
      expect(sessionData.child_spontaneous_remarks).toEqual(['今天好开心']);
    });

    test('返回的 date 字段为 ISO 字符串格式', () => {
      const builder = createSessionDataBuilder();
      const sessionData = builder.buildSessionData({});

      // ISO 字符串应能被 Date 解析，且包含 'T' 分隔符
      expect(typeof sessionData.date).toBe('string');
      expect(sessionData.date).toContain('T');
      expect(new Date(sessionData.date).toString()).not.toBe('Invalid Date');
    });

    test('返回的 items_learned 字段为数组', () => {
      const builder = createSessionDataBuilder();
      const sessionData = builder.buildSessionData({ itemsLearned: ['a', 'o'] });

      expect(Array.isArray(sessionData.items_learned)).toBe(true);
      expect(sessionData.items_learned).toEqual(['a', 'o']);
    });

    test('返回的 mastery_status 字段为对象', () => {
      const builder = createSessionDataBuilder();
      const sessionData = builder.buildSessionData({
        masteryStatus: { a: 'mastered', o: 'learning' }
      });

      expect(typeof sessionData.mastery_status).toBe('object');
      expect(sessionData.mastery_status).not.toBeNull();
      expect(sessionData.mastery_status).toEqual({ a: 'mastered', o: 'learning' });
    });

    test('返回的 child_spontaneous_remarks 字段为数组', () => {
      const builder = createSessionDataBuilder();
      const sessionData = builder.buildSessionData({
        childSpontaneousRemarks: ['我今天吃了冰淇淋']
      });

      expect(Array.isArray(sessionData.child_spontaneous_remarks)).toBe(true);
      expect(sessionData.child_spontaneous_remarks).toEqual(['我今天吃了冰淇淋']);
    });
  });

  describe('buildSessionData() - 空参数返回默认值', () => {
    test('传入空对象时返回包含全部默认值的 session_data', () => {
      const builder = createSessionDataBuilder();
      const sessionData = builder.buildSessionData({});

      expect(sessionData.items_learned).toEqual([]);
      expect(sessionData.mastery_status).toEqual({});
      expect(sessionData.chat_frequency).toBe(0);
      expect(sessionData.teaching_method_used).toBe('direct');
      expect(sessionData.duration_minutes).toBe(0);
      expect(sessionData.child_spontaneous_remarks).toEqual([]);
    });

    test('默认 story_stage 为 letter_stone', () => {
      const builder = createSessionDataBuilder();
      const sessionData = builder.buildSessionData({});

      expect(sessionData.story_stage).toBe('letter_stone');
    });

    test('默认 subject 为 pinyin', () => {
      const builder = createSessionDataBuilder();
      const sessionData = builder.buildSessionData({});

      expect(sessionData.subject).toBe('pinyin');
    });

    test('默认 child_mood 为 neutral', () => {
      const builder = createSessionDataBuilder();
      const sessionData = builder.buildSessionData({});

      expect(sessionData.child_mood).toBe('neutral');
    });
  });

  describe('addSpontaneousRemark() / getSpontaneousRemarks() - 增量捕获孩子自发话语', () => {
    test('addSpontaneousRemark 将话语添加到内部列表', () => {
      const builder = createSessionDataBuilder();

      builder.addSpontaneousRemark('我今天吃了冰淇淋');

      const remarks = builder.getSpontaneousRemarks();
      expect(remarks).toContain('我今天吃了冰淇淋');
    });

    test('getSpontaneousRemarks 返回已捕获的话语列表', () => {
      const builder = createSessionDataBuilder();
      builder.addSpontaneousRemark('我家小狗叫旺财');

      const remarks = builder.getSpontaneousRemarks();

      expect(Array.isArray(remarks)).toBe(true);
      expect(remarks).toHaveLength(1);
      expect(remarks[0]).toBe('我家小狗叫旺财');
    });

    test('多次调用 addSpontaneousRemark 累积所有话语', () => {
      const builder = createSessionDataBuilder();

      builder.addSpontaneousRemark('我今天吃了冰淇淋');
      builder.addSpontaneousRemark('我家小狗叫旺财');
      builder.addSpontaneousRemark('昨天我去公园玩了');

      const remarks = builder.getSpontaneousRemarks();
      expect(remarks).toHaveLength(3);
      expect(remarks).toEqual([
        '我今天吃了冰淇淋',
        '我家小狗叫旺财',
        '昨天我去公园玩了'
      ]);
    });
  });

  describe('reset() - 清空内部状态', () => {
    test('reset 清空已捕获的自发话语列表', () => {
      const builder = createSessionDataBuilder();
      builder.addSpontaneousRemark('我今天吃了冰淇淋');
      builder.addSpontaneousRemark('我家小狗叫旺财');
      expect(builder.getSpontaneousRemarks()).toHaveLength(2);

      builder.reset();

      expect(builder.getSpontaneousRemarks()).toEqual([]);
    });
  });

  describe('buildFromContext() - 从上下文便捷构建 session_data', () => {
    test('合并提供的字段与默认值，未提供字段使用默认值', () => {
      const builder = createSessionDataBuilder();
      const context = {
        storyStage: 'door_sign',
        itemsLearned: ['a', 'o'],
        childMood: 'energetic'
      };

      const sessionData = builder.buildFromContext(context);

      // 提供的字段使用上下文值
      expect(sessionData.story_stage).toBe('door_sign');
      expect(sessionData.items_learned).toEqual(['a', 'o']);
      expect(sessionData.child_mood).toBe('energetic');
      // 未提供的字段使用默认值
      expect(sessionData.subject).toBe('pinyin');
      expect(sessionData.mastery_status).toEqual({});
      expect(sessionData.chat_frequency).toBe(0);
      expect(sessionData.teaching_method_used).toBe('direct');
      expect(sessionData.duration_minutes).toBe(0);
      // 包含 date 字段
      expect(sessionData).toHaveProperty('date');
    });

    test('未提供 childSpontaneousRemarks 时使用内部追踪的自发话语', () => {
      const builder = createSessionDataBuilder();
      builder.addSpontaneousRemark('我今天吃了冰淇淋');
      builder.addSpontaneousRemark('我家小狗叫旺财');

      const sessionData = builder.buildFromContext({ storyStage: 'letter_stone' });

      expect(sessionData.child_spontaneous_remarks).toEqual([
        '我今天吃了冰淇淋',
        '我家小狗叫旺财'
      ]);
    });
  });

  describe('child_spontaneous_remarks - 捕获非学习信息', () => {
    test('孩子说出的非学习信息（如「我今天吃了冰淇淋」）出现在 session_data 中', () => {
      const builder = createSessionDataBuilder();
      // 模拟教学过程中孩子说出与学习无关的话语
      builder.addSpontaneousRemark('我今天吃了冰淇淋');

      const sessionData = builder.buildFromContext({
        storyStage: 'letter_stone',
        itemsLearned: ['a']
      });

      // 非学习信息被捕获到 child_spontaneous_remarks 字段
      expect(sessionData.child_spontaneous_remarks).toContain('我今天吃了冰淇淋');
    });
  });
});
