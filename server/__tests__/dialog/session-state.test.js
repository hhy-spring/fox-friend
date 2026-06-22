/**
 * 会话状态持久化管理器 - Issue #7 每日见面开场
 *
 * 参考PRD §4.2 session_data 结构：
 *   date, story_stage, subject, items_learned, mastery_status,
 *   child_mood, chat_frequency, teaching_method_used,
 *   duration_minutes, child_spontaneous_remarks
 *
 * 测试覆盖：
 *   - saveSession：创建文件、累加计数、添加时间戳
 *   - loadLastSession：新孩子返回失败、保存后返回最近会话、返回正确计数
 *   - getSessionCount：新孩子为0、多次保存后正确计数
 *   - loadAllSessions：新孩子空数组、按时间顺序返回
 *   - saveStoryStage / loadStoryStage：创建文件、覆盖、新孩子返回失败
 *   - 多孩子数据隔离
 *   - session_data 包含 PRD 所有必要字段
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createSessionStateManager } = require('../../src/dialog/session-state');

// 构造一份完整的 session_data（参考 PRD §4.2）
function buildFullSessionData(overrides = {}) {
  return {
    date: '2026-06-23',
    story_stage: 'letter_stone',
    subject: 'pinyin',
    items_learned: ['a', 'o', 'e'],
    mastery_status: 'learning',
    child_mood: 'happy',
    chat_frequency: 12,
    teaching_method_used: 'feynman',
    duration_minutes: 15,
    child_spontaneous_remarks: ['今天好开心'],
    ...overrides
  };
}

// 构造一份故事阶段数据
function buildStoryStageData(overrides = {}) {
  return {
    currentStageIndex: 1,
    currentStageId: 'door_sign',
    childId: 'child-001',
    ...overrides
  };
}

describe('会话状态持久化管理器 - session-state', () => {
  let tempDir;

  beforeEach(() => {
    // 每个测试使用独立的临时目录，避免相互污染
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fox-test-'));
  });

  afterEach(() => {
    // 测试后清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('createSessionStateManager() - 工厂函数', () => {
    test('返回包含所有必要方法的管理器实例', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });

      expect(typeof manager.saveSession).toBe('function');
      expect(typeof manager.loadLastSession).toBe('function');
      expect(typeof manager.getSessionCount).toBe('function');
      expect(typeof manager.loadAllSessions).toBe('function');
      expect(typeof manager.saveStoryStage).toBe('function');
      expect(typeof manager.loadStoryStage).toBe('function');
    });
  });

  describe('saveSession() - 保存会话数据', () => {
    test('保存会话时创建 sessions_{childId}.json 文件', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-001';
      const sessionData = buildFullSessionData();

      const result = manager.saveSession(childId, sessionData);

      expect(result.success).toBe(true);
      expect(result.path).toBe(path.join(tempDir, `sessions_${childId}.json`));
      expect(fs.existsSync(result.path)).toBe(true);
    });

    test('多次保存会话时，sessionCount 递增', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-002';

      const r1 = manager.saveSession(childId, buildFullSessionData({ date: '2026-06-21' }));
      const r2 = manager.saveSession(childId, buildFullSessionData({ date: '2026-06-22' }));
      const r3 = manager.saveSession(childId, buildFullSessionData({ date: '2026-06-23' }));

      expect(r1.sessionCount).toBe(1);
      expect(r2.sessionCount).toBe(2);
      expect(r3.sessionCount).toBe(3);
    });

    test('保存时为会话数据添加 saved_at 时间戳（ISO 格式）', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-003';
      const beforeTime = new Date().toISOString();

      const result = manager.saveSession(childId, buildFullSessionData());
      const afterTime = new Date().toISOString();

      // 读取文件内容验证 saved_at 字段
      const fileContent = JSON.parse(fs.readFileSync(result.path, 'utf8'));
      // 文件中保存的是数组
      expect(Array.isArray(fileContent)).toBe(true);
      expect(fileContent[0].saved_at).toBeDefined();
      expect(fileContent[0].saved_at >= beforeTime).toBe(true);
      expect(fileContent[0].saved_at <= afterTime).toBe(true);
    });

    test('保存时如果目录不存在，自动创建嵌套目录', () => {
      const nestedDir = path.join(tempDir, 'nested', 'deep', 'storage');
      const manager = createSessionStateManager({ storageDir: nestedDir });
      const childId = 'child-004';

      const result = manager.saveSession(childId, buildFullSessionData());

      expect(result.success).toBe(true);
      expect(fs.existsSync(nestedDir)).toBe(true);
      expect(fs.existsSync(result.path)).toBe(true);
    });

    test('保存的会话数据包含所有原始字段', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-005';
      const sessionData = buildFullSessionData();

      const result = manager.saveSession(childId, sessionData);
      const fileContent = JSON.parse(fs.readFileSync(result.path, 'utf8'));
      const saved = fileContent[0];

      expect(saved.date).toBe('2026-06-23');
      expect(saved.story_stage).toBe('letter_stone');
      expect(saved.subject).toBe('pinyin');
      expect(saved.items_learned).toEqual(['a', 'o', 'e']);
      expect(saved.mastery_status).toBe('learning');
      expect(saved.child_mood).toBe('happy');
      expect(saved.chat_frequency).toBe(12);
      expect(saved.teaching_method_used).toBe('feynman');
      expect(saved.duration_minutes).toBe(15);
      expect(saved.child_spontaneous_remarks).toEqual(['今天好开心']);
    });
  });

  describe('loadLastSession() - 读取最近一次会话', () => {
    test('新孩子（无历史会话）返回 success=false', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'new-child';

      const result = manager.loadLastSession(childId);

      expect(result.success).toBe(false);
    });

    test('保存一次后，loadLastSession 返回该会话数据', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-006';
      const sessionData = buildFullSessionData({ date: '2026-06-23' });

      manager.saveSession(childId, sessionData);

      const result = manager.loadLastSession(childId);

      expect(result.success).toBe(true);
      expect(result.sessionData).toBeDefined();
      expect(result.sessionData.date).toBe('2026-06-23');
      expect(result.sessionData.story_stage).toBe('letter_stone');
    });

    test('保存多次后，loadLastSession 返回最近一次（按数组末尾）', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-007';

      manager.saveSession(childId, buildFullSessionData({ date: '2026-06-21', subject: 'pinyin' }));
      manager.saveSession(childId, buildFullSessionData({ date: '2026-06-22', subject: 'literacy' }));
      manager.saveSession(childId, buildFullSessionData({ date: '2026-06-23', subject: 'math' }));

      const result = manager.loadLastSession(childId);

      expect(result.success).toBe(true);
      expect(result.sessionData.subject).toBe('math');
      expect(result.sessionData.date).toBe('2026-06-23');
    });

    test('loadLastSession 返回正确的 sessionCount', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-008';

      manager.saveSession(childId, buildFullSessionData({ date: '2026-06-21' }));
      manager.saveSession(childId, buildFullSessionData({ date: '2026-06-22' }));

      const result = manager.loadLastSession(childId);

      expect(result.success).toBe(true);
      expect(result.sessionCount).toBe(2);
    });
  });

  describe('getSessionCount() - 获取会话计数', () => {
    test('新孩子返回 0', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });

      expect(manager.getSessionCount('new-child')).toBe(0);
    });

    test('多次保存后返回正确的计数', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-009';

      manager.saveSession(childId, buildFullSessionData());
      manager.saveSession(childId, buildFullSessionData());
      manager.saveSession(childId, buildFullSessionData());

      expect(manager.getSessionCount(childId)).toBe(3);
    });
  });

  describe('loadAllSessions() - 读取所有会话', () => {
    test('新孩子返回空数组', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });

      const result = manager.loadAllSessions('new-child');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });

    test('返回的会话按保存顺序（时间顺序）排列', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-010';

      manager.saveSession(childId, buildFullSessionData({ date: '2026-06-21', subject: 'pinyin' }));
      manager.saveSession(childId, buildFullSessionData({ date: '2026-06-22', subject: 'literacy' }));
      manager.saveSession(childId, buildFullSessionData({ date: '2026-06-23', subject: 'math' }));

      const sessions = manager.loadAllSessions(childId);

      expect(sessions).toHaveLength(3);
      // 按保存顺序排列（chronological order）
      expect(sessions[0].subject).toBe('pinyin');
      expect(sessions[1].subject).toBe('literacy');
      expect(sessions[2].subject).toBe('math');
    });
  });

  describe('saveStoryStage() / loadStoryStage() - 故事阶段状态', () => {
    test('saveStoryStage 创建 story_stage_{childId}.json 文件', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-011';
      const stageData = buildStoryStageData();

      const result = manager.saveStoryStage(childId, stageData);

      expect(result.success).toBe(true);
      expect(result.path).toBe(path.join(tempDir, `story_stage_${childId}.json`));
      expect(fs.existsSync(result.path)).toBe(true);
    });

    test('saveStoryStage 覆盖之前保存的阶段数据', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-012';

      manager.saveStoryStage(childId, buildStoryStageData({ currentStageIndex: 0, currentStageId: 'letter_stone' }));
      manager.saveStoryStage(childId, buildStoryStageData({ currentStageIndex: 2, currentStageId: 'star_lamp' }));

      const result = manager.loadStoryStage(childId);

      expect(result.success).toBe(true);
      expect(result.stageData.currentStageIndex).toBe(2);
      expect(result.stageData.currentStageId).toBe('star_lamp');
    });

    test('loadStoryStage 对新孩子返回 success=false', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });

      const result = manager.loadStoryStage('new-child');

      expect(result.success).toBe(false);
    });

    test('loadStoryStage 返回已保存的阶段数据', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-013';
      const stageData = buildStoryStageData({
        currentStageIndex: 3,
        currentStageId: 'distant_bird'
      });

      manager.saveStoryStage(childId, stageData);
      const result = manager.loadStoryStage(childId);

      expect(result.success).toBe(true);
      expect(result.stageData).toBeDefined();
      expect(result.stageData.currentStageIndex).toBe(3);
      expect(result.stageData.currentStageId).toBe('distant_bird');
    });
  });

  describe('多孩子数据隔离', () => {
    test('不同孩子的会话数据相互独立', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childA = 'child-A';
      const childB = 'child-B';

      manager.saveSession(childA, buildFullSessionData({ date: '2026-06-23', subject: 'pinyin' }));
      manager.saveSession(childB, buildFullSessionData({ date: '2026-06-23', subject: 'math' }));
      manager.saveSession(childB, buildFullSessionData({ date: '2026-06-24', subject: 'english' }));

      // childA 只有 1 次会话
      expect(manager.getSessionCount(childA)).toBe(1);
      const lastA = manager.loadLastSession(childA);
      expect(lastA.sessionData.subject).toBe('pinyin');

      // childB 有 2 次会话
      expect(manager.getSessionCount(childB)).toBe(2);
      const lastB = manager.loadLastSession(childB);
      expect(lastB.sessionData.subject).toBe('english');
    });

    test('不同孩子的故事阶段数据相互独立', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childA = 'child-stage-A';
      const childB = 'child-stage-B';

      manager.saveStoryStage(childA, buildStoryStageData({ currentStageId: 'letter_stone', currentStageIndex: 0 }));
      manager.saveStoryStage(childB, buildStoryStageData({ currentStageId: 'star_lamp', currentStageIndex: 2 }));

      const resultA = manager.loadStoryStage(childA);
      const resultB = manager.loadStoryStage(childB);

      expect(resultA.stageData.currentStageId).toBe('letter_stone');
      expect(resultB.stageData.currentStageId).toBe('star_lamp');
    });
  });

  describe('PRD §4.2 session_data 字段完整性', () => {
    test('保存后读取的会话数据包含 PRD 要求的所有字段', () => {
      const manager = createSessionStateManager({ storageDir: tempDir });
      const childId = 'child-prd';
      const sessionData = buildFullSessionData();

      manager.saveSession(childId, sessionData);
      const result = manager.loadLastSession(childId);
      const saved = result.sessionData;

      // PRD §4.2 要求的所有字段
      expect(saved).toHaveProperty('date');
      expect(saved).toHaveProperty('story_stage');
      expect(saved).toHaveProperty('subject');
      expect(saved).toHaveProperty('items_learned');
      expect(saved).toHaveProperty('mastery_status');
      expect(saved).toHaveProperty('child_mood');
      expect(saved).toHaveProperty('chat_frequency');
      expect(saved).toHaveProperty('teaching_method_used');
      expect(saved).toHaveProperty('duration_minutes');
      expect(saved).toHaveProperty('child_spontaneous_remarks');
      // 持久化管理器添加的时间戳字段
      expect(saved).toHaveProperty('saved_at');
    });
  });
});
