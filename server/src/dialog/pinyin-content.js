/**
 * 拼音教学内容 - Issue #8 每日拼音教学
 *
 * 参考PRD §4.2 骨架层：命运主线故事 - 字母石（拼音）阶段
 *   字母石碎了，找回字音国的字母石
 *
 * MVP 范围：a/o/e 三个元音的一节课
 * 每个元音包含：元音字符、示例词、教学台词（小狐狸的对话）、口型提示
 * 掌握状态：'new' / 'learning' / 'mastered'
 */

// a/o/e 三个元音教学内容
// 内容面向 4-7 岁儿童，台词为小狐狸的口吻，简单活泼
const PINYIN_VOWELS = [
  {
    vowel: 'a',
    exampleWord: '阿姨',
    teachingLine: '这块字母石上刻着「啊」！你看阿姨张嘴说话，嘴巴要张大哦，跟我一起——啊——！',
    mouthShape: '嘴巴张大'
  },
  {
    vowel: 'o',
    exampleWord: '公鸡',
    teachingLine: '这块石头上写着「哦」！公鸡早上打鸣就是哦哦哦，嘴巴圆圆的，跟我一起——哦——！',
    mouthShape: '嘴巴圆圆'
  },
  {
    vowel: 'e',
    exampleWord: '白鹅',
    teachingLine: '最后一块石头是「鹅」！白鹅在水里游泳，嘴角往两边咧开，跟我一起——鹅——！',
    mouthShape: '嘴角咧开'
  }
];

// 每个元音的课程轮次模板（1-3 轮/元音）
// 每轮为小狐狸的一段对话台词，循序渐进引导孩子发音
const LESSON_ROUND_TEMPLATES = [
  (v) => `看！这块字母石上刻着「${v.vowel}」！读的时候${v.mouthShape}，${v.teachingLine}`,
  (v) => `记住啦，「${v.exampleWord}」里就有「${v.vowel}」的音！${v.mouthShape}，再跟我念一遍——${v.exampleWord}！`
];

/**
 * 构建课程计划：每个元音 1-3 轮对话
 * @returns {Array<{vowel:string, round:number, content:string}>}
 */
function buildLessonPlan() {
  const plan = [];
  PINYIN_VOWELS.forEach(v => {
    LESSON_ROUND_TEMPLATES.forEach((template, idx) => {
      plan.push({
        vowel: v.vowel,
        round: idx + 1,
        content: template(v)
      });
    });
  });
  return plan;
}

// 课程计划（每个元音 2 轮，共 6 轮）
const LESSON_PLAN = buildLessonPlan();

/**
 * 创建拼音教学内容提供者
 * @param {object} [options] - 可选配置
 * @returns {object} 拼音教学内容提供者实例
 */
function createPinyinContentProvider(options = {}) {
  // 每个元音的掌握状态，初始为 'new'
  const masteryStatus = {};
  PINYIN_VOWELS.forEach(v => {
    masteryStatus[v.vowel] = 'new';
  });

  return {
    getVowels() {
      return PINYIN_VOWELS;
    },

    getVowel(vowelChar) {
      return PINYIN_VOWELS.find(v => v.vowel === vowelChar) || null;
    },

    getTeachingLine(vowelChar) {
      const vowel = this.getVowel(vowelChar);
      return vowel ? vowel.teachingLine : '';
    },

    getMasteryStatus(vowelChar) {
      return masteryStatus[vowelChar] || null;
    },

    updateMastery(vowelChar, status) {
      if (masteryStatus.hasOwnProperty(vowelChar)) {
        masteryStatus[vowelChar] = status;
      }
    },

    getLessonPlan() {
      return LESSON_PLAN;
    },

    isLessonComplete() {
      return PINYIN_VOWELS.every(v => masteryStatus[v.vowel] === 'mastered');
    },

    getAllMasteryStatus() {
      return { ...masteryStatus };
    }
  };
}

module.exports = {
  PINYIN_VOWELS,
  createPinyinContentProvider
};
