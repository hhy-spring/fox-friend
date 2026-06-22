/**
 * 故事阶段管理器测试 - Issue #7 每日见面开场
 *
 * 参考PRD §4.2 骨架层：命运主线故事
 * 4个阶段：字母石(拼音) → 门牌(识字) → 灯(数学) → 小鸟(英语)
 */

const {
  STORY_STAGES,
  createStoryStageManager
} = require('../../src/dialog/story-stage-manager');

describe('StoryStageManager - 命运主线4阶段管理', () => {
  describe('故事阶段定义', () => {
    test('应定义4个故事阶段，按正确顺序排列', () => {
      expect(STORY_STAGES).toHaveLength(4);
      expect(STORY_STAGES[0].id).toBe('letter_stone');
      expect(STORY_STAGES[1].id).toBe('door_sign');
      expect(STORY_STAGES[2].id).toBe('star_lamp');
      expect(STORY_STAGES[3].id).toBe('distant_bird');
    });

    test('每个阶段应包含学科映射和描述', () => {
      STORY_STAGES.forEach(stage => {
        expect(stage).toHaveProperty('id');
        expect(stage).toHaveProperty('name');
        expect(stage).toHaveProperty('subject');
        expect(stage).toHaveProperty('description');
      });
    });

    test('字母石阶段映射到拼音学科', () => {
      expect(STORY_STAGES[0].subject).toBe('pinyin');
    });

    test('门牌阶段映射到识字学科', () => {
      expect(STORY_STAGES[1].subject).toBe('literacy');
    });

    test('灯阶段映射到数学学科', () => {
      expect(STORY_STAGES[2].subject).toBe('math');
    });

    test('小鸟阶段映射到英语学科', () => {
      expect(STORY_STAGES[3].subject).toBe('english');
    });
  });

  describe('阶段初始化', () => {
    test('新孩子应从第1阶段（字母石）开始', () => {
      const manager = createStoryStageManager('child_001');
      expect(manager.getCurrentStage().id).toBe('letter_stone');
      expect(manager.getStageIndex()).toBe(0);
    });

    test('应支持从指定阶段开始（恢复场景）', () => {
      const manager = createStoryStageManager('child_001', {
        initialStageIndex: 2
      });
      expect(manager.getCurrentStage().id).toBe('star_lamp');
    });
  });

  describe('阶段自动推进', () => {
    test('应能推进到下一阶段', () => {
      const manager = createStoryStageManager('child_001');
      const result = manager.advanceToNextStage();
      expect(result.success).toBe(true);
      expect(manager.getCurrentStage().id).toBe('door_sign');
    });

    test('连续推进应按顺序遍历所有阶段', () => {
      const manager = createStoryStageManager('child_001');
      manager.advanceToNextStage();
      manager.advanceToNextStage();
      manager.advanceToNextStage();
      expect(manager.getCurrentStage().id).toBe('distant_bird');
    });

    test('最后一个阶段再推进应保持在最后阶段（不循环）', () => {
      const manager = createStoryStageManager('child_001', {
        initialStageIndex: 3
      });
      const result = manager.advanceToNextStage();
      expect(result.success).toBe(false);
      expect(manager.getStageIndex()).toBe(3);
    });
  });

  describe('悬念衔接', () => {
    test('阶段切换时应生成悬念衔接台词', () => {
      const manager = createStoryStageManager('child_001');
      const transition = manager.getStageTransition();
      expect(transition).toHaveProperty('fromStage');
      expect(transition).toHaveProperty('toStage');
      expect(transition).toHaveProperty('suspenseLine');
      expect(typeof transition.suspenseLine).toBe('string');
      expect(transition.suspenseLine.length).toBeGreaterThan(0);
    });

    test('推进后悬念衔接应反映新阶段', () => {
      const manager = createStoryStageManager('child_001');
      manager.advanceToNextStage();
      const transition = manager.getStageTransition();
      expect(transition.toStage.id).toBe('door_sign');
    });
  });

  describe('阶段状态序列化', () => {
    test('应能序列化为JSON用于持久化', () => {
      const manager = createStoryStageManager('child_001');
      manager.advanceToNextStage();
      const json = manager.toJSON();
      expect(json).toHaveProperty('childId', 'child_001');
      expect(json).toHaveProperty('currentStageIndex', 1);
      expect(json).toHaveProperty('currentStageId', 'door_sign');
    });

    test('应能从JSON恢复状态', () => {
      const manager = createStoryStageManager('child_001');
      const saved = {
        childId: 'child_001',
        currentStageIndex: 2,
        currentStageId: 'star_lamp'
      };
      manager.fromJSON(saved);
      expect(manager.getCurrentStage().id).toBe('star_lamp');
    });
  });

  describe('辅助方法', () => {
    test('getAllStages 返回所有4个阶段', () => {
      const manager = createStoryStageManager('child_001');
      const stages = manager.getAllStages();
      expect(stages).toHaveLength(4);
      expect(stages[0].id).toBe('letter_stone');
      expect(stages[3].id).toBe('distant_bird');
    });

    test('getAllStages 返回副本，修改不影响原数据', () => {
      const manager = createStoryStageManager('child_001');
      const stages = manager.getAllStages();
      stages.push({ id: 'fake' });
      expect(manager.getAllStages()).toHaveLength(4);
    });

    test('isLastStage 在第一阶段返回 false', () => {
      const manager = createStoryStageManager('child_001');
      expect(manager.isLastStage()).toBe(false);
    });

    test('isLastStage 在最后阶段返回 true', () => {
      const manager = createStoryStageManager('child_001', { initialStageIndex: 3 });
      expect(manager.isLastStage()).toBe(true);
    });

    test('setStageIndex 正确跳转到指定阶段', () => {
      const manager = createStoryStageManager('child_001');
      manager.setStageIndex(2);
      expect(manager.getStageIndex()).toBe(2);
      expect(manager.getCurrentStage().id).toBe('star_lamp');
    });

    test('setStageIndex 超出范围抛出错误', () => {
      const manager = createStoryStageManager('child_001');
      expect(() => manager.setStageIndex(5)).toThrow();
    });

    test('setStageIndex 负数抛出错误', () => {
      const manager = createStoryStageManager('child_001');
      expect(() => manager.setStageIndex(-1)).toThrow();
    });
  });

  describe('边界条件', () => {
    test('initialStageIndex 超出上界时应限制到最后阶段', () => {
      const manager = createStoryStageManager('child_001', { initialStageIndex: 99 });
      expect(manager.getStageIndex()).toBe(3);
      expect(manager.getCurrentStage().id).toBe('distant_bird');
    });

    test('initialStageIndex 为负数时应从第一阶段开始', () => {
      const manager = createStoryStageManager('child_001', { initialStageIndex: -5 });
      expect(manager.getStageIndex()).toBe(0);
    });
  });
});
