const { getNameHints, getNameHintsLine } = require('../../src/dialog/name-hints');

describe('名字暗示选项', () => {
  test('返回3-4个带生字的暗示选项', () => {
    const hints = getNameHints();
    expect(hints.length).toBeGreaterThanOrEqual(3);
    expect(hints.length).toBeLessThanOrEqual(4);
  });

  test('每个暗示包含生字和描述', () => {
    const hints = getNameHints();
    hints.forEach(hint => {
      expect(hint).toHaveProperty('character');
      expect(hint).toHaveProperty('description');
      expect(hint.character.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('暗示包含PRD中指定的示例生字（龙、闪等）', () => {
    const hints = getNameHints();
    const characters = hints.map(h => h.character);
    // PRD §4.1 步骤2: 带龙、带闪的暗示
    expect(characters).toContain('龙');
    expect(characters).toContain('闪');
  });

  test('暗示选项的描述格式正确', () => {
    const hints = getNameHints();
    hints.forEach(hint => {
      // 描述应包含"带'X'的"格式
      expect(hint.description).toContain(hint.character);
    });
  });

  test('生成暗示台词（整句）', () => {
    const hints = getNameHints();
    const hintLine = getNameHintsLine(hints);
    expect(hintLine).toContain('龙');
    expect(hintLine).toContain('闪');
  });
});

// 辅助函数导入测试
describe('名字暗示台词生成', () => {
  const { getNameHintsLine } = require('../../src/dialog/name-hints');

  test('生成完整的暗示台词', () => {
    const line = getNameHintsLine();
    expect(line).toContain('厉害的名字');
    expect(line).toContain('龙');
    expect(line).toContain('闪');
  });
});
