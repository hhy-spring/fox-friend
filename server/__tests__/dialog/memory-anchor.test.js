/**
 * 回忆锚点生成器测试 - Issue #7 每日见面开场
 *
 * 参考PRD §4.5.3 变化一: 开场方式
 *   开场包含回忆锚点，引用上一次会话的关键事件：
 *   - Session 2: 「闪电闪电！上次你教我念的『龙』字，恐龙国的恐龙们高兴坏了！...」
 *   - Session 5: 「闪电！还记得我们帮三角龙找回的『大』字吗？...」
 *   - Session 10: 「闪电！恐龙国今天给我发了一个奖牌...」
 *
 * 测试覆盖：
 *   - 无前次会话（首次见面）→ 无锚点
 *   - items_learned 锚点（引用最近学习项）
 *   - child_spontaneous_remarks 锚点（引用关键事件）
 *   - 个性化文本（昵称、狐狸名）
 *   - 兴趣分型主题语言（dinosaur/princess/speed/generic）
 *   - 返回结构完整性
 *   - 边界情况（缺失 childProfile 等）
 */

const {
  createMemoryAnchorGenerator,
  ANCHOR_TYPES
} = require('../../src/dialog/memory-anchor');

describe('MemoryAnchorGenerator - 回忆锚点生成器 (Issue #7)', () => {
  let generator;

  beforeEach(() => {
    generator = createMemoryAnchorGenerator();
  });

  describe('generateAnchor - 无前次会话（首次见面）', () => {
    test('previousSession 为 null → hasAnchor: false, anchorType: none', () => {
      const result = generator.generateAnchor(null, {
        nickname: '闪电',
        foxName: '恐龙蛋'
      });
      expect(result.hasAnchor).toBe(false);
      expect(result.anchorType).toBe(ANCHOR_TYPES.NONE);
      expect(result.anchorText).toBe('');
      expect(result.referencedItems).toEqual([]);
    });

    test('previousSession 为 undefined → hasAnchor: false', () => {
      const result = generator.generateAnchor(undefined, {
        nickname: '闪电',
        foxName: '恐龙蛋'
      });
      expect(result.hasAnchor).toBe(false);
      expect(result.anchorType).toBe('none');
    });
  });

  describe('generateAnchor - items_learned 锚点', () => {
    test('items_learned [龙] → hasAnchor: true, 引用 龙', () => {
      const previousSession = { items_learned: ['龙'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '闪电',
        foxName: '恐龙蛋'
      });
      expect(result.hasAnchor).toBe(true);
      expect(result.referencedItems).toContain('龙');
      expect(result.anchorType).toBe(ANCHOR_TYPES.ITEMS_LEARNED);
    });

    test('items_learned [a, o] → 引用其中之一', () => {
      const previousSession = { items_learned: ['a', 'o'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '小明',
        foxName: '小白'
      });
      expect(result.hasAnchor).toBe(true);
      expect(['a', 'o']).toContain(result.referencedItems[0]);
    });

    test('items_learned 为空数组 → hasAnchor: false', () => {
      const previousSession = { items_learned: [] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '小明',
        foxName: '小白'
      });
      expect(result.hasAnchor).toBe(false);
      expect(result.anchorType).toBe('none');
    });

    test('多个 items_learned → 引用最后一个（最近学习的）', () => {
      const previousSession = { items_learned: ['a', 'o', 'e'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '小明',
        foxName: '小白'
      });
      expect(result.referencedItems).toContain('e');
    });

    test('anchorType 为 items_learned 当引用学习项时', () => {
      const previousSession = { items_learned: ['大'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '闪电',
        foxName: '恐龙蛋'
      });
      expect(result.anchorType).toBe('items_learned');
    });
  });

  describe('generateAnchor - child_spontaneous_remarks 锚点', () => {
    test('有 child_spontaneous_remarks → 可以引用它们', () => {
      const previousSession = {
        items_learned: [],
        child_spontaneous_remarks: ['今天好开心']
      };
      const result = generator.generateAnchor(previousSession, {
        nickname: '小明',
        foxName: '小白'
      });
      expect(result.hasAnchor).toBe(true);
      expect(result.referencedItems).toContain('今天好开心');
    });

    test('anchorType 为 key_event 当引用自发话语时', () => {
      const previousSession = {
        items_learned: [],
        child_spontaneous_remarks: ['恐龙好酷']
      };
      const result = generator.generateAnchor(previousSession, {
        nickname: '小明',
        foxName: '小白'
      });
      expect(result.anchorType).toBe('key_event');
    });
  });

  describe('generateAnchor - 个性化文本', () => {
    test('锚点文本包含孩子昵称', () => {
      const previousSession = { items_learned: ['龙'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '闪电',
        foxName: '恐龙蛋'
      });
      expect(result.anchorText).toContain('闪电');
    });

    test('锚点文本包含狐狸名字', () => {
      const previousSession = { items_learned: ['龙'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '闪电',
        foxName: '恐龙蛋'
      });
      expect(result.anchorText).toContain('恐龙蛋');
    });
  });

  describe('generateAnchor - 兴趣分型主题语言', () => {
    test('dinosaur 兴趣 → 锚点文本含恐龙主题词', () => {
      const previousSession = { items_learned: ['龙'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '闪电',
        foxName: '恐龙蛋'
      });
      expect(result.anchorText).toMatch(/恐龙/);
    });

    test('princess 兴趣 → 锚点文本含魔法主题词', () => {
      const previousSession = { items_learned: ['花'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '小美',
        foxName: '艾莎'
      });
      expect(result.anchorText).toMatch(/魔法/);
    });

    test('speed 兴趣 → 锚点文本含速度主题词', () => {
      const previousSession = { items_learned: ['风'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '小快',
        foxName: '闪电'
      });
      expect(result.anchorText).toMatch(/赛车|飞驰|速度/);
    });

    test('generic 兴趣 → 锚点文本使用中性语言', () => {
      const previousSession = { items_learned: ['山'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '小明',
        foxName: '小白'
      });
      expect(result.anchorText).not.toMatch(/恐龙/);
      expect(result.anchorText).not.toMatch(/魔法/);
      expect(result.anchorText).not.toMatch(/赛车/);
    });
  });

  describe('generateAnchor - 返回结构', () => {
    test('referencedItems 包含锚点中引用的项', () => {
      const previousSession = { items_learned: ['龙'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '闪电',
        foxName: '恐龙蛋'
      });
      expect(Array.isArray(result.referencedItems)).toBe(true);
      expect(result.referencedItems.length).toBeGreaterThan(0);
    });

    test('hasAnchor 为 true 时 anchorText 非空', () => {
      const previousSession = { items_learned: ['龙'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '闪电',
        foxName: '恐龙蛋'
      });
      expect(result.hasAnchor).toBe(true);
      expect(result.anchorText.length).toBeGreaterThan(0);
    });

    test('返回对象包含所有必需字段', () => {
      const previousSession = { items_learned: ['龙'] };
      const result = generator.generateAnchor(previousSession, {
        nickname: '闪电',
        foxName: '恐龙蛋'
      });
      expect(result).toHaveProperty('hasAnchor');
      expect(result).toHaveProperty('anchorText');
      expect(result).toHaveProperty('referencedItems');
      expect(result).toHaveProperty('anchorType');
    });
  });

  describe('generateAnchor - 边界情况', () => {
    test('childProfile 缺失时优雅处理（使用默认值）', () => {
      const previousSession = { items_learned: ['龙'] };
      const result = generator.generateAnchor(previousSession, null);
      expect(result.hasAnchor).toBe(true);
      expect(result.anchorText.length).toBeGreaterThan(0);
    });

    test('childProfile 为 undefined 时优雅处理', () => {
      const previousSession = { items_learned: ['龙'] };
      const result = generator.generateAnchor(previousSession, undefined);
      expect(result.hasAnchor).toBe(true);
      expect(result.anchorType).toBe('items_learned');
    });
  });
});
