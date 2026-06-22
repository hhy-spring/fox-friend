/**
 * 名字暗示选项生成
 *
 * 参考技术架构文档§三「对话引擎架构」Interest Brancher（名字→兴趣分型）
 * 参考技术架构文档§八「兴趣分型映射」
 *
 * PRD §4.1 步骤2：预设3-4个带生字的选项暗示（植入教学钩子）
 * PRD §4.5.2：暗示选项对应后续兴趣分型（恐龙/公主/速度/通用）
 */

// 名字暗示选项池
// 参考技术架构文档§八：兴趣分型映射
const NAME_HINTS = [
  {
    character: '龙',
    description: "带'龙'的",
    interestType: 'dinosaur',
    example: '恐龙蛋、小恐龙、霸王龙'
  },
  {
    character: '闪',
    description: "带'闪'的",
    interestType: 'speed',
    example: '闪电、闪亮'
  },
  {
    character: '莎',
    description: "带'莎'的",
    interestType: 'princess',
    example: '艾莎、小莎'
  },
  {
    character: '星',
    description: "带'星'的",
    interestType: 'generic',
    example: '星星、小星'
  }
];

/**
 * 获取名字暗示选项
 * @returns {Array<{character: string, description: string, interestType: string, example: string}>}
 */
function getNameHints() {
  return NAME_HINTS;
}

/**
 * 生成暗示台词（整句）
 * 参考PRD §4.1 步骤2：「我特别想要一个听起来很厉害的名字，比如带'龙'的，或者带'闪'的...你觉得哪个好？」
 * @param {Array} hints - 暗示选项，默认使用全部
 * @returns {string} 暗示台词
 */
function getNameHintsLine(hints = NAME_HINTS) {
  const hintParts = hints.slice(0, 3).map(h => h.description);
  const lastHint = hintParts.pop();
  const hintStr = hintParts.length > 0
    ? `${hintParts.join('，')}，或者${lastHint}`
    : lastHint;

  return `我特别想要一个听起来很厉害的名字，比如${hintStr}...你觉得哪个好？`;
}

module.exports = { NAME_HINTS, getNameHints, getNameHintsLine };
