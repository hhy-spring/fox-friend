/**
 * 开场一句话模板生成器测试 - Issue #7 每日见面开场
 *
 * 参考PRD §4.5.3 变化一: 开场方式
 *   每日见面开场必须在同一句话中结合三个元素：
 *     1. 点名叫人（call child by name）
 *     2. 回忆锚点（memory anchor referencing last session）
 *     3. 引出新任务（introduce new task）
 *
 * PRD 示例：
 *   - Session 2: 「闪电闪电！上次你教我念的『龙』字，恐龙国的恐龙们高兴坏了！但是今天又有新麻烦了……你快来！」
 *   - Session 5: 「闪电！还记得我们帮三角龙找回的『大』字吗？今天霸王龙也来求助了——它的字母石被人拿走了！」
 *   - Session 10: 「闪电！恐龙国今天给我发了一个奖牌——你看！上面写着：最佳恐龙搭档——闪电和恐龙蛋！但是奖牌上有个字我不认识…」
 *
 * 测试覆盖：
 *   - 返回结构完整性
 *   - 点名叫人（FAMILIAR 重复两次，TACIT/OLD_PARTNERS 叫一次）
 *   - 回忆锚点嵌入（hasAnchor true/false）
 *   - 新任务引用故事阶段
 *   - 兴趣分型主题语言（dinosaur/princess/speed/generic）
 *   - 语气修饰符（canJoke/canSurprise）
 *   - 三组件组合
 *   - 边界情况（null previousSession、缺失 childProfile 字段）
 */

const {
  createOpeningTemplateGenerator
} = require('../../src/dialog/opening-templates');
const {
  STORY_STAGES
} = require('../../src/dialog/story-stage-manager');
const {
  TONE_PHASES,
  createToneEvolutionManager
} = require('../../src/dialog/tone-evolution');
const {
  createMemoryAnchorGenerator
} = require('../../src/dialog/memory-anchor');
const {
  INTEREST_TYPES
} = require('../../src/dialog/interest-classifier');

describe('OpeningTemplateGenerator - 开场一句话模板生成器 (Issue #7)', () => {
  let generator;
  let toneMgr;
  let memGen;

  beforeEach(() => {
    generator = createOpeningTemplateGenerator();
    toneMgr = createToneEvolutionManager();
    memGen = createMemoryAnchorGenerator();
  });

  // 默认恐龙主题画像与上一次会话
  const dinoProfile = { nickname: '闪电', foxName: '恐龙蛋' };
  const dinoPrevSession = { items_learned: ['龙'] };

  // 无锚点对象（用于隔离新任务主题语言测试）
  const noAnchor = {
    hasAnchor: false,
    anchorText: '',
    referencedItems: [],
    anchorType: 'none'
  };

  /**
   * 构造 generateOpening 的入参
   * 各字段可通过 overrides 覆盖
   */
  function buildInputs(overrides = {}) {
    const sessionCount = overrides.sessionCount !== undefined ? overrides.sessionCount : 2;
    const childProfile = overrides.childProfile !== undefined ? overrides.childProfile : dinoProfile;
    const previousSession = overrides.previousSession !== undefined
      ? overrides.previousSession
      : dinoPrevSession;
    const storyStage = overrides.storyStage !== undefined ? overrides.storyStage : STORY_STAGES[0];
    const tonePhase = overrides.tonePhase !== undefined
      ? overrides.tonePhase
      : toneMgr.getTonePhase(sessionCount);
    const memoryAnchor = overrides.memoryAnchor !== undefined
      ? overrides.memoryAnchor
      : memGen.generateAnchor(previousSession, childProfile);
    return {
      childProfile,
      sessionCount,
      previousSession,
      storyStage,
      tonePhase,
      memoryAnchor
    };
  }

  describe('返回结构', () => {
    test('1. 返回对象包含 openingText, components, tonePhase, interestType', () => {
      const result = generator.generateOpening(buildInputs());
      expect(result).toHaveProperty('openingText');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('tonePhase');
      expect(result).toHaveProperty('interestType');
    });

    test('2. openingText 是非空字符串', () => {
      const result = generator.generateOpening(buildInputs());
      expect(typeof result.openingText).toBe('string');
      expect(result.openingText.length).toBeGreaterThan(0);
    });

    test('3. components 包含 nameCall, memoryAnchor, newTask', () => {
      const result = generator.generateOpening(buildInputs());
      expect(result.components).toHaveProperty('nameCall');
      expect(result.components).toHaveProperty('memoryAnchor');
      expect(result.components).toHaveProperty('newTask');
    });
  });

  describe('点名叫人', () => {
    test('4. nameCall 包含孩子昵称', () => {
      const result = generator.generateOpening(buildInputs());
      expect(result.components.nameCall).toContain('闪电');
    });

    test('5. Session 2 (FAMILIAR) → 昵称重复两次', () => {
      const inputs = buildInputs({ sessionCount: 2 });
      const result = generator.generateOpening(inputs);
      expect(result.tonePhase).toBe(TONE_PHASES.FAMILIAR);
      const occurrences = (result.components.nameCall.match(/闪电/g) || []).length;
      expect(occurrences).toBe(2);
    });

    test('6. Session 5 (TACIT) → 昵称只叫一次', () => {
      const inputs = buildInputs({ sessionCount: 5 });
      const result = generator.generateOpening(inputs);
      expect(result.tonePhase).toBe(TONE_PHASES.TACIT);
      const occurrences = (result.components.nameCall.match(/闪电/g) || []).length;
      expect(occurrences).toBe(1);
    });

    test('7. Session 10 (OLD_PARTNERS) → 昵称只叫一次', () => {
      const inputs = buildInputs({ sessionCount: 10 });
      const result = generator.generateOpening(inputs);
      expect(result.tonePhase).toBe(TONE_PHASES.OLD_PARTNERS);
      const occurrences = (result.components.nameCall.match(/闪电/g) || []).length;
      expect(occurrences).toBe(1);
    });
  });

  describe('回忆锚点', () => {
    test('8. hasAnchor 为 true 时 → memoryAnchor 组件包含锚点文本', () => {
      const memoryAnchor = {
        hasAnchor: true,
        anchorText: '上次你教我念的龙字，恐龙们都高兴坏了！',
        referencedItems: ['龙'],
        anchorType: 'items_learned'
      };
      const inputs = buildInputs({ memoryAnchor });
      const result = generator.generateOpening(inputs);
      expect(result.components.memoryAnchor.length).toBeGreaterThan(0);
      expect(result.components.memoryAnchor).toContain('龙');
    });

    test('9. hasAnchor 为 false 时 → memoryAnchor 组件为空', () => {
      const inputs = buildInputs({ memoryAnchor: noAnchor });
      const result = generator.generateOpening(inputs);
      expect(result.components.memoryAnchor).toBe('');
    });
  });

  describe('新任务', () => {
    test('10. newTask 引用故事阶段（含阶段名或 introLine 内容）', () => {
      const inputs = buildInputs({ storyStage: STORY_STAGES[0] });
      const result = generator.generateOpening(inputs);
      // 字母石阶段的 introLine 含「字母石」
      expect(result.components.newTask).toContain('字母石');
    });
  });

  describe('兴趣分型主题语言', () => {
    test('11. dinosaur 兴趣 → 开场含恐龙主题词', () => {
      const inputs = buildInputs({
        childProfile: { nickname: '闪电', foxName: '恐龙蛋' },
        memoryAnchor: noAnchor
      });
      const result = generator.generateOpening(inputs);
      expect(result.interestType).toBe(INTEREST_TYPES.DINOSAUR);
      expect(result.openingText).toMatch(/恐龙/);
    });

    test('12. princess 兴趣 → 开场含魔法主题词', () => {
      const inputs = buildInputs({
        childProfile: { nickname: '小美', foxName: '艾莎' },
        memoryAnchor: noAnchor
      });
      const result = generator.generateOpening(inputs);
      expect(result.interestType).toBe(INTEREST_TYPES.PRINCESS);
      expect(result.openingText).toMatch(/魔法/);
    });

    test('13. speed 兴趣 → 开场含速度主题词', () => {
      const inputs = buildInputs({
        childProfile: { nickname: '小快', foxName: '闪电' },
        memoryAnchor: noAnchor
      });
      const result = generator.generateOpening(inputs);
      expect(result.interestType).toBe(INTEREST_TYPES.SPEED);
      expect(result.openingText).toMatch(/赛车|速度|飞驰/);
    });

    test('14. generic 兴趣 → 开场使用中性语言', () => {
      const inputs = buildInputs({
        childProfile: { nickname: '小明', foxName: '小白' },
        memoryAnchor: noAnchor
      });
      const result = generator.generateOpening(inputs);
      expect(result.interestType).toBe(INTEREST_TYPES.GENERIC);
      expect(result.openingText).not.toMatch(/恐龙/);
      expect(result.openingText).not.toMatch(/魔法/);
      expect(result.openingText).not.toMatch(/赛车/);
    });
  });

  describe('语气修饰符', () => {
    test('15. TACIT 阶段 canJoke → 开场含玩笑元素', () => {
      const inputs = buildInputs({ sessionCount: 5 }); // TACIT
      const result = generator.generateOpening(inputs);
      expect(result.tonePhase).toBe(TONE_PHASES.TACIT);
      expect(result.openingText).toMatch(/哈哈|打赌|猜猜/);
    });

    test('16. OLD_PARTNERS 阶段 canSurprise → 开场含惊喜元素', () => {
      const inputs = buildInputs({ sessionCount: 10 }); // OLD_PARTNERS
      const result = generator.generateOpening(inputs);
      expect(result.tonePhase).toBe(TONE_PHASES.OLD_PARTNERS);
      expect(result.openingText).toMatch(/惊喜|偷偷|猜猜今天/);
    });
  });

  describe('组合与连贯性', () => {
    test('17. 完整开场结合三个组件', () => {
      const inputs = buildInputs({ sessionCount: 2 });
      const result = generator.generateOpening(inputs);
      expect(result.openingText).toContain(result.components.nameCall);
      expect(result.openingText).toContain(result.components.memoryAnchor);
      expect(result.openingText).toContain(result.components.newTask);
    });

    test('18. previousSession 为 null 时优雅处理', () => {
      const inputs = buildInputs({
        previousSession: null,
        memoryAnchor: noAnchor
      });
      expect(() => generator.generateOpening(inputs)).not.toThrow();
      const result = generator.generateOpening(inputs);
      expect(typeof result.openingText).toBe('string');
      expect(result.openingText.length).toBeGreaterThan(0);
    });

    test('19. childProfile 缺失字段时优雅处理', () => {
      const inputs = buildInputs({
        childProfile: {},
        memoryAnchor: noAnchor
      });
      expect(() => generator.generateOpening(inputs)).not.toThrow();
      const result = generator.generateOpening(inputs);
      expect(typeof result.openingText).toBe('string');
      expect(result.openingText.length).toBeGreaterThan(0);
    });

    test('20. 开场文本是单一连贯的句子/段落（无换行）', () => {
      const inputs = buildInputs({ sessionCount: 2 });
      const result = generator.generateOpening(inputs);
      expect(typeof result.openingText).toBe('string');
      expect(result.openingText).not.toContain('\n');
    });
  });
});
