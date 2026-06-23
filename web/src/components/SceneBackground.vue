<template>
  <div class="scene-background" :class="sceneClass">
    <div class="scene-bg-layer"></div>
    <div class="scene-decorations">
      <div v-if="hasTrees" class="decoration tree tree-1"></div>
      <div v-if="hasTrees" class="decoration tree tree-2"></div>
      <div v-if="hasTrees" class="decoration tree tree-3"></div>
      <div v-if="hasClouds" class="decoration cloud cloud-1"></div>
      <div v-if="hasClouds" class="decoration cloud cloud-2"></div>
      <div v-if="hasLetters" class="decoration letter letter-a">a</div>
      <div v-if="hasLetters" class="decoration letter letter-o">o</div>
      <div v-if="hasLetters" class="decoration letter letter-e">e</div>
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

const effectiveScene = computed(() => {
  if (props.storyStage) {
    const normalized = props.storyStage.replace(/-/g, '_');
    return STORY_STAGE_TO_SCENE[normalized] || STORY_STAGE_TO_SCENE[props.storyStage] || props.scene;
  }
  return props.scene;
});

const sceneClass = computed(() => `scene-${effectiveScene.value}`);

const hasTrees = computed(() =>
  ['forest', 'phonetic-kingdom'].includes(effectiveScene.value)
);

const hasClouds = computed(() =>
  ['forest', 'castle', 'racetrack'].includes(effectiveScene.value)
);

const hasLetters = computed(() =>
  ['phonetic-kingdom'].includes(effectiveScene.value)
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
  transition: background 0.8s ease;
  overflow: hidden;
}

.scene-bg-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition: background 0.8s ease;
}

.scene-forest .scene-bg-layer {
  background: linear-gradient(180deg, #87ceeb 0%, #98d98e 60%, #6abf69 100%);
}

.scene-phonetic-kingdom .scene-bg-layer {
  background: linear-gradient(180deg, #ffe4b5 0%, #ffdab9 40%, #f4a460 100%);
}

.scene-castle .scene-bg-layer {
  background: linear-gradient(180deg, #b0c4de 0%, #d8bfd8 50%, #dda0dd 100%);
}

.scene-racetrack .scene-bg-layer {
  background: linear-gradient(180deg, #ff6347 0%, #ff4500 50%, #8b0000 100%);
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

.tree {
  bottom: 0;
  width: 80px;
  height: 120px;
  background: linear-gradient(180deg, #228b22 0%, #8b4513 80%, #8b4513 100%);
  border-radius: 50% 50% 10% 10%;
}

.tree-1 { left: 5%; }
.tree-2 { left: 75%; height: 100px; }
.tree-3 { left: 45%; height: 140px; }

.cloud {
  top: 10%;
  width: 100px;
  height: 40px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  animation: drift 20s infinite linear;
}

.cloud-1 { left: 10%; }
.cloud-2 { left: 60%; top: 5%; }

.letter {
  font-size: 48px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.6);
  animation: float 3s infinite ease-in-out;
}

.letter-a { top: 15%; left: 20%; }
.letter-o { top: 25%; left: 60%; animation-delay: 0.5s; }
.letter-e { top: 40%; left: 35%; animation-delay: 1s; }

@keyframes drift {
  from { transform: translateX(0); }
  to { transform: translateX(100px); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}
</style>
