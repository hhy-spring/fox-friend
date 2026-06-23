/**
 * 借分契约台词生成测试 - Issue #9 借分契约机制
 *
 * 参考PRD §4.3 借分契约机制
 *
 * 当孩子连续3次不愿推进(叛逆/无聊状态),第4次触发借分对赌。
 * 本模块负责生成借分契约各阶段台词,语气活泼可爱,适合4-7岁儿童。
 */
const {
  createContractDialogue,
  CONTRACT_DIALOGUE_TYPES
} = require('../../src/dialog/contract-dialogue');

describe('借分契约台词生成 - Issue #9', () => {
  describe('getProposalLine - 借分提案台词', () => {
    test('返回包含"10个聪明分"的字符串', () => {
      const dialogue = createContractDialogue();
      const line = dialogue.getProposalLine();
      expect(typeof line).toBe('string');
      expect(line).toContain('10个聪明分');
    });
  });

  describe('getAcceptLine - 接受对赌台词', () => {
    test('返回接受对赌后的台词,包含击掌表情', () => {
      const dialogue = createContractDialogue();
      const line = dialogue.getAcceptLine();
      expect(typeof line).toBe('string');
      expect(line).toBe('太好了!那我们击掌!🤚 准备好了吗?');
    });
  });

  describe('getRejectLine - 拒绝对赌台词', () => {
    test('返回温柔收尾的拒绝对赌台词,强调陪伴', () => {
      const dialogue = createContractDialogue();
      const line = dialogue.getRejectLine();
      expect(typeof line).toBe('string');
      expect(line).toBe('没关系,我们下次再玩!你想做什么我都陪你!');
    });
  });

  describe('getChangedMindLine - 孩子改变主意台词', () => {
    test('返回孩子愿意学了之后的退出台词', () => {
      const dialogue = createContractDialogue();
      const line = dialogue.getChangedMindLine();
      expect(typeof line).toBe('string');
      expect(line).toBe('太好了!那我们继续学吧!你真棒!');
    });
  });

  describe('getWinLine - 赢了对赌台词', () => {
    test('返回赢了对赌的台词,包含20个聪明分和庆祝表情', () => {
      const dialogue = createContractDialogue();
      const line = dialogue.getWinLine();
      expect(typeof line).toBe('string');
      expect(line).toBe('哇!你做到了!20个聪明分归你啦!我还给你解锁了一个新故事!🎉');
    });
  });

  describe('getLoseLine - 输了对赌台词', () => {
    test('返回输了对赌的台词,强调陪伴而非惩罚', () => {
      const dialogue = createContractDialogue();
      const line = dialogue.getLoseLine();
      expect(typeof line).toBe('string');
      expect(line).toBe('哎呀,我输啦!那我陪你做一件搞笑的事吧!');
      // 确保不包含惩罚性语言
      expect(line).not.toMatch(/惩罚|罚|扣分|批评/);
    });
  });

  describe('getBorrowPointsLine - 借分点数台词', () => {
    test('返回借分点数台词"10个聪明分"', () => {
      const dialogue = createContractDialogue();
      const line = dialogue.getBorrowPointsLine();
      expect(typeof line).toBe('string');
      expect(line).toBe('10个聪明分');
    });
  });

  describe('getWinPointsLine - 赢分点数台词', () => {
    test('返回赢分点数台词"20个聪明分"', () => {
      const dialogue = createContractDialogue();
      const line = dialogue.getWinPointsLine();
      expect(typeof line).toBe('string');
      expect(line).toBe('20个聪明分');
    });
  });

  describe('自定义点数配置', () => {
    test('传入自定义 borrowPoints 和 winPoints 后,点数台词随之变化', () => {
      const dialogue = createContractDialogue({ borrowPoints: 5, winPoints: 15 });
      expect(dialogue.getBorrowPointsLine()).toBe('5个聪明分');
      expect(dialogue.getWinPointsLine()).toBe('15个聪明分');
    });

    test('自定义点数后,提案台词和赢了对赌台词使用自定义点数', () => {
      const dialogue = createContractDialogue({ borrowPoints: 5, winPoints: 15 });
      expect(dialogue.getProposalLine()).toContain('5个聪明分');
      expect(dialogue.getProposalLine()).toContain('15分');
      expect(dialogue.getWinLine()).toContain('15个聪明分');
    });

    test('不传点数时使用默认值 10/20', () => {
      const dialogue = createContractDialogue();
      expect(dialogue.getBorrowPointsLine()).toBe('10个聪明分');
      expect(dialogue.getWinPointsLine()).toBe('20个聪明分');
    });
  });

  describe('CONTRACT_DIALOGUE_TYPES - 台词类型常量', () => {
    test('导出包含所有借分契约台词类型的常量对象', () => {
      expect(CONTRACT_DIALOGUE_TYPES).toBeDefined();
      expect(typeof CONTRACT_DIALOGUE_TYPES).toBe('object');
      expect(CONTRACT_DIALOGUE_TYPES.PROPOSAL).toBe('PROPOSAL');
      expect(CONTRACT_DIALOGUE_TYPES.ACCEPT).toBe('ACCEPT');
      expect(CONTRACT_DIALOGUE_TYPES.REJECT).toBe('REJECT');
      expect(CONTRACT_DIALOGUE_TYPES.CHANGED_MIND).toBe('CHANGED_MIND');
      expect(CONTRACT_DIALOGUE_TYPES.WIN).toBe('WIN');
      expect(CONTRACT_DIALOGUE_TYPES.LOSE).toBe('LOSE');
    });
  });
});
