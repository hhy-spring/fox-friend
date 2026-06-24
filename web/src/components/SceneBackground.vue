<template>
  <div class="scene-background" :class="sceneClass">
    <div
      class="scene-bg-layer"
      :style="bgLayerStyle"
    ></div>

    <!-- 顶部柔光渐变（增强氛围） -->
    <div class="scene-vignette"></div>

    <div class="scene-decorations">
      <!-- 太阳 / 月亮 -->
      <div v-if="hasSun" class="decoration sun"></div>
      <div v-if="hasMoon" class="decoration moon"></div>

      <!-- 云朵 -->
      <div v-if="hasClouds" class="decoration cloud cloud-1"></div>
      <div v-if="hasClouds" class="decoration cloud cloud-2"></div>
      <div v-if="hasClouds" class="decoration cloud cloud-3"></div>

      <!-- 树木 -->
      <div v-if="hasTrees" class="decoration tree tree-1"></div>
      <div v-if="hasTrees" class="decoration tree tree-2"></div>
      <div v-if="hasTrees" class="decoration tree tree-3"></div>

      <!-- 漂浮拼音字母 -->
      <div v-if="hasLetters" class="decoration letter letter-a">a</div>
      <div v-if="hasLetters" class="decoration letter letter-o">o</div>
      <div v-if="hasLetters" class="decoration letter letter-e">e</div>
      <div v-if="hasLetters" class="decoration letter letter-i">i</div>
      <div v-if="hasLetters" class="decoration letter letter-u">u</div>

      <!-- 星星 -->
      <div v-if="hasStars" class="decoration star star-1"></div>
      <div v-if="hasStars" class="decoration star star-2"></div>
      <div v-if="hasStars" class="decoration star star-3"></div>
      <div v-if="hasStars" class="decoration star star-4"></div>
      <div v-if="hasStars" class="decoration star star-5"></div>

      <!-- 魔法光点 -->
      <div v-if="hasSparkles" class="decoration sparkle sparkle-1"></div>
      <div v-if="hasSparkles" class="decoration sparkle sparkle-2"></div>
      <div v-if="hasSparkles" class="decoration sparkle sparkle-3"></div>
      <div v-if="hasSparkles" class="decoration sparkle sparkle-4"></div>

      <!-- 草地 -->
      <div v-if="hasGrass" class="decoration grass-layer"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  scene: {
    type: String,
    default: 'forest'
  },
  storyStage: {
    type: String,
    default: null
  }
});

const STORY_STAGE_TO_SCENE = {
  appearance: 'forest',
  help_request: 'forest',
  'help-request': 'forest',
  naming_ceremony: 'phonetic-kingdom',
  'naming-ceremony': 'phonetic-kingdom',
  naming: 'phonetic-kingdom',
  profile_collection: 'phonetic-kingdom',
  'profile-collection': 'phonetic-kingdom',
  feynman_trigger: 'phonetic-kingdom',
  'feynman-trigger': 'phonetic-kingdom',
  teaching: 'phonetic-kingdom',
  partner_confirmation: 'castle',
  'partner-confirmation': 'castle',
  daily_meeting: 'forest',
  'daily-meeting': 'forest'
};

const SCENE_CONFIG = {
  forest: {
    prompt: 'warm storybook forest clearing at golden hour, soft sunlight through green trees, wildflowers in meadow, gentle pastel colors, child-friendly illustration, no characters, no text',
    gradient: 'linear-gradient(180deg, #87ceeb 0%, #b4e0a8 55%, #7cc97a 100%)'
  },
  'phonetic-kingdom': {
    prompt: 'magical floating kingdom with glowing golden pinyin letter stones, warm amber sky, floating magical particles, whimsical storybook illustration, child-friendly, no characters, no text',
    gradient: 'linear-gradient(180deg, #ffe4b5 0%, #ffdab9 40%, #f4a460 100%)'
  },
  castle: {
    prompt: 'dreamy magical castle at twilight, soft purple and pink sky, glowing castle windows, twinkling stars, storybook illustration, child-friendly, no characters, no text',
    gradient: 'linear-gradient(180deg, #6a5acd 0%, #d8bfd8 50%, #dda0dd 100%)'
  },
  racetrack: {
    prompt: 'colorful fun racing track through sunny green hills, checkered flags, blue sky with fluffy clouds, vibrant storybook illustration, child-friendly, no characters, no text',
    gradient: 'linear-gradient(180deg, #4fc3f7 0%, #81c784 50%, #66bb6a 100%)'
  }
};

const effectiveScene = computed(() => {
  if (props.storyStage) {
    const normalized = props.storyStage.replace(/-/g, '_');
    return STORY_STAGE_TO_SCENE[normalized] || STORY_STAGE_TO_SCENE[props.storyStage] || props.scene;
  }
  return props.scene;
});

const sceneClass = computed(() => `scene-${effectiveScene.value}`);

const sceneConfig = computed(() => SCENE_CONFIG[effectiveScene.value] || SCENE_CONFIG.forest);

const bgLayerStyle = computed(() => ({
  backgroundImage: `url("https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(sceneConfig.value.prompt)}&image_size=landscape_16_9"), ${sceneConfig.value.gradient}`,
  backgroundColor: '#87ceeb'
}));

const hasTrees = computed(() =>
  ['forest', 'phonetic-kingdom'].includes(effectiveScene.value)
);

const hasClouds = computed(() =>
  ['forest', 'castle', 'racetrack'].includes(effectiveScene.value)
);

const hasLetters = computed(() =>
  ['phonetic-kingdom'].includes(effectiveScene.value)
);

const hasSun = computed(() =>
  ['forest', 'racetrack'].includes(effectiveScene.value)
);

const hasMoon = computed(() =>
  ['castle'].includes(effectiveScene.value)
);

const hasStars = computed(() =>
  ['castle'].includes(effectiveScene.value)
);

const hasSparkles = computed(() =>
  ['phonetic-kingdom', 'castle'].includes(effectiveScene.value)
);

const hasGrass = computed(() =>
  ['forest', 'racetrack'].includes(effectiveScene.value)
);
</script>

<style scoped>
.scene-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
}

.scene-bg-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: opacity 0.8s ease;
}

/* 场景渐变兜底（图片加载前 / 加载失败时显示） */
.scene-forest .scene-bg-layer {
  background-color: #87ceeb;
}

.scene-phonetic-kingdom .scene-bg-layer {
  background-color: #ffe4b5;
}

.scene-castle .scene-bg-layer {
  background-color: #b0c4de;
}

.scene-racetrack .scene-bg-layer {
  background-color: #4fc3f7;
}

.scene-vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.12) 100%);
  pointer-events: none;
}

.scene-decorations {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.decoration {
  position: absolute;
}

/* ===== 太阳 ===== */
.sun {
  top: 8%;
  right: 12%;
  width: 70px;
  height: 70px;
  background: radial-gradient(circle, #fff9c4 0%, #ffeb3b 50%, #ffc107 100%);
  border-radius: 50%;
  box-shadow: 0 0 40px rgba(255, 235, 59, 0.6);
  animation: sun-glow 4s ease-in-out infinite alternate;
}

@keyframes sun-glow {
  from { box-shadow: 0 0 30px rgba(255, 235, 59, 0.5); }
  to { box-shadow: 0 0 50px rgba(255, 235, 59, 0.8); }
}

/* ===== 月亮 ===== */
.moon {
  top: 8%;
  right: 12%;
  width: 60px;
  height: 60px;
  background: radial-gradient(circle at 35% 35%, #fffde7 0%, #fff59d 60%, #fdd835 100%);
  border-radius: 50%;
  box-shadow: 0 0 30px rgba(255, 245, 157, 0.5);
}

/* ===== 云朵 ===== */
.cloud {
  background: rgba(255, 255, 255, 0.85);
  border-radius: 50px;
  animation: drift 25s infinite linear;
}

.cloud-1 {
  top: 10%;
  left: -10%;
  width: 120px;
  height: 40px;
  box-shadow: 20px -15px 0 -5px rgba(255, 255, 255, 0.85),
              45px -8px 0 -8px rgba(255, 255, 255, 0.85);
}

.cloud-2 {
  top: 5%;
  left: 50%;
  width: 90px;
  height: 30px;
  animation-duration: 35s;
  box-shadow: 15px -10px 0 -3px rgba(255, 255, 255, 0.85);
}

.cloud-3 {
  top: 18%;
  left: 20%;
  width: 70px;
  height: 25px;
  animation-duration: 30s;
  animation-delay: -10s;
}

/* ===== 树木 ===== */
.tree {
  bottom: 0;
  width: 70px;
  height: 130px;
  background: linear-gradient(180deg, #4caf50 0%, #388e3c 40%, #5d4037 80%, #5d4037 100%);
  border-radius: 50% 50% 8% 8%;
  box-shadow: inset -8px 0 12px rgba(0, 0, 0, 0.1);
}

.tree-1 { left: 3%; height: 110px; }
.tree-2 { right: 5%; height: 140px; width: 80px; }
.tree-3 { left: 50%; height: 100px; transform: translateX(-50%); opacity: 0.7; }

/* ===== 漂浮字母 ===== */
.letter {
  font-size: 42px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
  animation: float-letter 4s infinite ease-in-out;
}

.letter-a { top: 12%; left: 15%; }
.letter-o { top: 22%; right: 18%; animation-delay: 0.8s; }
.letter-e { top: 35%; left: 8%; animation-delay: 1.5s; }
.letter-i { top: 15%; left: 60%; animation-delay: 2s; font-size: 36px; }
.letter-u { top: 40%; right: 10%; animation-delay: 2.8s; font-size: 38px; }

/* ===== 星星 ===== */
.star {
  width: 12px;
  height: 12px;
  background: #fff9c4;
  border-radius: 50%;
  box-shadow: 0 0 8px #fff9c4;
  animation: twinkle 2s infinite ease-in-out;
}

.star-1 { top: 12%; left: 20%; }
.star-2 { top: 8%; left: 45%; animation-delay: 0.5s; }
.star-3 { top: 20%; left: 70%; animation-delay: 1s; width: 8px; height: 8px; }
.star-4 { top: 6%; left: 80%; animation-delay: 1.5s; }
.star-5 { top: 25%; left: 10%; animation-delay: 2s; width: 10px; height: 10px; }

/* ===== 魔法光点 ===== */
.sparkle {
  width: 6px;
  height: 6px;
  background: #ffd700;
  border-radius: 50%;
  box-shadow: 0 0 10px #ffd700, 0 0 20px rgba(255, 215, 0, 0.4);
  animation: sparkle-float 5s infinite ease-in-out;
}

.sparkle-1 { top: 30%; left: 25%; }
.sparkle-2 { top: 50%; left: 75%; animation-delay: 1.2s; }
.sparkle-3 { top: 65%; left: 15%; animation-delay: 2.5s; }
.sparkle-4 { top: 20%; left: 55%; animation-delay: 3.5s; }

/* ===== 草地 ===== */
.grass-layer {
  bottom: 0;
  left: 0;
  width: 100%;
  height: 80px;
  background: linear-gradient(180deg, transparent 0%, rgba(124, 201, 122, 0.4) 50%, rgba(102, 187, 106, 0.6) 100%);
}

/* ===== 动画 ===== */
@keyframes drift {
  from { transform: translateX(0); }
  to { transform: translateX(calc(100vw + 150px)); }
}

@keyframes float-letter {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
}

@keyframes twinkle {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

@keyframes sparkle-float {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
  50% { transform: translateY(-25px) scale(1.5); opacity: 1; }
}
</style>
