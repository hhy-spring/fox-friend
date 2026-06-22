/**
 * 语气渐变弧线管理器测试 - Issue #7 每日见面开场
 *
 * 参考PRD §4.5.3 变化四: 语气的渐变弧线
 *   第1次见面：紧张试探 → 脆弱 → 被接纳后惊喜
 *   第2-3次：  熟悉 + 依赖 → 「你是我唯一的搭档」
 *   第4-7次：  默契 → 可以开玩笑、打赌
 *   第8次+：   老夫老妻 → 偶尔不示弱直接推进、偶尔惊喜打破惯性
 */

const {
  TONE_PHASES,
  createToneEvolutionManager
} = require('../../src/dialog/tone-evolution');

describe('ToneEvolutionManager - 语气渐变弧线管理', () => {
  describe('TONE_PHASES 常量', () => {
    test('应定义4个语气阶段', () => {
      expect(TONE_PHASES).toHaveProperty('FIRST_MEETING');
      expect(TONE_PHASES).toHaveProperty('FAMILIAR');
      expect(TONE_PHASES).toHaveProperty('TACIT');
      expect(TONE_PHASES).toHaveProperty('OLD_PARTNERS');
      expect(Object.keys(TONE_PHASES)).toHaveLength(4);
    });

    test('阶段常量值应为小写下划线字符串', () => {
      expect(TONE_PHASES.FIRST_MEETING).toBe('first_meeting');
      expect(TONE_PHASES.FAMILIAR).toBe('familiar');
      expect(TONE_PHASES.TACIT).toBe('tacit');
      expect(TONE_PHASES.OLD_PARTNERS).toBe('old_partners');
    });
  });

  describe('getTonePhase - 根据见面次数返回阶段', () => {
    test('第1次见面应返回 FIRST_MEETING 阶段', () => {
      const manager = createToneEvolutionManager();
      const phase = manager.getTonePhase(1);
      expect(phase.phase).toBe(TONE_PHASES.FIRST_MEETING);
    });

    test('第2次见面应返回 FAMILIAR 阶段', () => {
      const manager = createToneEvolutionManager();
      const phase = manager.getTonePhase(2);
      expect(phase.phase).toBe(TONE_PHASES.FAMILIAR);
    });

    test('第3次见面应返回 FAMILIAR 阶段', () => {
      const manager = createToneEvolutionManager();
      const phase = manager.getTonePhase(3);
      expect(phase.phase).toBe(TONE_PHASES.FAMILIAR);
    });

    test('第4次见面应返回 TACIT 阶段', () => {
      const manager = createToneEvolutionManager();
      const phase = manager.getTonePhase(4);
      expect(phase.phase).toBe(TONE_PHASES.TACIT);
    });

    test('第7次见面应返回 TACIT 阶段', () => {
      const manager = createToneEvolutionManager();
      const phase = manager.getTonePhase(7);
      expect(phase.phase).toBe(TONE_PHASES.TACIT);
    });

    test('第8次见面应返回 OLD_PARTNERS 阶段', () => {
      const manager = createToneEvolutionManager();
      const phase = manager.getTonePhase(8);
      expect(phase.phase).toBe(TONE_PHASES.OLD_PARTNERS);
    });

    test('第20次见面应返回 OLD_PARTNERS 阶段', () => {
      const manager = createToneEvolutionManager();
      const phase = manager.getTonePhase(20);
      expect(phase.phase).toBe(TONE_PHASES.OLD_PARTNERS);
    });
  });

  describe('getVulnerabilityLevel - 脆弱程度', () => {
    test('第1次见面脆弱程度应为 high', () => {
      const manager = createToneEvolutionManager();
      expect(manager.getVulnerabilityLevel(1)).toBe('high');
    });

    test('第2次见面脆弱程度应为 moderate', () => {
      const manager = createToneEvolutionManager();
      expect(manager.getVulnerabilityLevel(2)).toBe('moderate');
    });

    test('第5次见面脆弱程度应为 low', () => {
      const manager = createToneEvolutionManager();
      expect(manager.getVulnerabilityLevel(5)).toBe('low');
    });

    test('第10次见面脆弱程度应为 minimal', () => {
      const manager = createToneEvolutionManager();
      expect(manager.getVulnerabilityLevel(10)).toBe('minimal');
    });
  });

  describe('getToneModifiers - 语气修饰符', () => {
    test('FIRST_MEETING 阶段不能开玩笑、不能打赌', () => {
      const manager = createToneEvolutionManager();
      const modifiers = manager.getToneModifiers(1);
      expect(modifiers.canJoke).toBe(false);
      expect(modifiers.canBet).toBe(false);
    });

    test('TACIT 阶段可以开玩笑、可以打赌', () => {
      const manager = createToneEvolutionManager();
      const modifiers = manager.getToneModifiers(5);
      expect(modifiers.canJoke).toBe(true);
      expect(modifiers.canBet).toBe(true);
    });

    test('OLD_PARTNERS 阶段可以跳过示弱、可以制造惊喜', () => {
      const manager = createToneEvolutionManager();
      const modifiers = manager.getToneModifiers(10);
      expect(modifiers.canSkipVulnerability).toBe(true);
      expect(modifiers.canSurprise).toBe(true);
    });

    test('语气修饰符应包含全部4个字段', () => {
      const manager = createToneEvolutionManager();
      const modifiers = manager.getToneModifiers(1);
      expect(modifiers).toHaveProperty('canJoke');
      expect(modifiers).toHaveProperty('canBet');
      expect(modifiers).toHaveProperty('canSkipVulnerability');
      expect(modifiers).toHaveProperty('canSurprise');
    });
  });

  describe('getToneDescription - 语气描述', () => {
    test('每个阶段应返回非空描述字符串', () => {
      const manager = createToneEvolutionManager();
      [1, 2, 4, 8].forEach(sessionCount => {
        const description = manager.getToneDescription(sessionCount);
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('阶段对象结构', () => {
    test('每个语气阶段对象应包含 phase, phaseName, vulnerabilityLevel, description 字段', () => {
      const manager = createToneEvolutionManager();
      [1, 2, 4, 8].forEach(sessionCount => {
        const phaseObj = manager.getTonePhase(sessionCount);
        expect(phaseObj).toHaveProperty('phase');
        expect(phaseObj).toHaveProperty('phaseName');
        expect(phaseObj).toHaveProperty('vulnerabilityLevel');
        expect(phaseObj).toHaveProperty('description');
      });
    });
  });
});
