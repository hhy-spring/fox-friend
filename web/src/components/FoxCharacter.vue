<template>
  <div
    class="fox-character"
    :class="[expressionClass, { speaking }]"
  >
    <div class="fox-body" :class="{ 'animate-nod': speaking }">
      <svg
        class="fox-svg"
        viewBox="0 0 240 300"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- 地面阴影 -->
        <ellipse class="fox-shadow" cx="120" cy="288" rx="65" ry="8" />

        <!-- 尾巴 -->
        <g class="fox-tail" :class="{ 'animate-wag': speaking }">
          <path
            class="tail-fur"
            d="M 168 225 Q 225 195 232 135 Q 234 98 208 100 Q 200 140 182 175 Q 172 200 168 225 Z"
          />
          <path
            class="tail-tip"
            d="M 232 135 Q 234 98 208 100 Q 216 118 224 135 Z"
          />
        </g>

        <!-- 脚 -->
        <ellipse class="fox-foot" cx="93" cy="272" rx="20" ry="11" />
        <ellipse class="fox-foot" cx="147" cy="272" rx="20" ry="11" />

        <!-- 身体 -->
        <ellipse class="fox-body-shape" cx="120" cy="222" rx="56" ry="50" />
        <!-- 肚皮 -->
        <ellipse class="fox-belly" cx="120" cy="232" rx="36" ry="33" />

        <!-- 手臂 -->
        <ellipse
          class="fox-arm"
          cx="70"
          cy="222"
          rx="14"
          ry="24"
          transform="rotate(18 70 222)"
        />
        <ellipse
          class="fox-arm"
          cx="170"
          cy="222"
          rx="14"
          ry="24"
          transform="rotate(-18 170 222)"
        />

        <!-- 头部 -->
        <ellipse class="fox-head" cx="120" cy="120" rx="66" ry="59" />

        <!-- 耳朵 -->
        <path
          class="fox-ear"
          d="M 68 88 L 52 22 L 102 72 Z"
        />
        <path
          class="fox-ear"
          d="M 172 88 L 188 22 L 138 72 Z"
        />
        <!-- 耳朵内侧 -->
        <path
          class="fox-ear-inner"
          d="M 70 82 L 62 38 L 94 68 Z"
        />
        <path
          class="fox-ear-inner"
          d="M 170 82 L 178 38 L 146 68 Z"
        />

        <!-- 面部白纹 -->
        <path
          class="fox-face-mask"
          d="M 120 74 Q 90 80 86 112 Q 88 142 106 158 Q 120 165 134 158 Q 152 142 154 112 Q 150 80 120 74 Z"
        />

        <!-- 脸颊红晕 -->
        <ellipse class="fox-cheek" cx="80" cy="132" rx="11" ry="7" />
        <ellipse class="fox-cheek" cx="160" cy="132" rx="11" ry="7" />

        <!-- 眼睛 -->
        <g class="fox-eyes" :class="`eyes-${expression}`">
          <!-- 开心：弯弯笑眼 -->
          <template v-if="expression === 'happy'">
            <path class="eye eye-left" d="M 86 110 Q 95 100 104 110" />
            <path class="eye eye-right" d="M 136 110 Q 145 100 154 110" />
          </template>
          <!-- 好奇：圆圆大眼 -->
          <template v-else-if="expression === 'curious'">
            <g class="eye eye-left">
              <circle cx="95" cy="108" r="9" />
              <circle class="eye-highlight" cx="98" cy="104" r="3.5" />
            </g>
            <g class="eye eye-right">
              <circle cx="145" cy="108" r="9" />
              <circle class="eye-highlight" cx="148" cy="104" r="3.5" />
            </g>
          </template>
          <!-- 紧张：担心小眼 -->
          <template v-else-if="expression === 'nervous'">
            <g class="eye eye-left">
              <ellipse cx="95" cy="112" rx="6" ry="5" />
              <path class="eyebrow" d="M 85 98 Q 95 101 105 99" />
            </g>
            <g class="eye eye-right">
              <ellipse cx="145" cy="112" rx="6" ry="5" />
              <path class="eyebrow" d="M 135 99 Q 145 101 155 98" />
            </g>
          </template>
          <!-- 崇拜：星星眼 -->
          <template v-else-if="expression === 'worship'">
            <path
              class="eye eye-left star-eye"
              d="M 95 98 L 98 105 L 105 107 L 98 109 L 95 116 L 92 109 L 85 107 L 92 105 Z"
            />
            <path
              class="eye eye-right star-eye"
              d="M 145 98 L 148 105 L 155 107 L 148 109 L 145 116 L 142 109 L 135 107 L 142 105 Z"
            />
          </template>
        </g>

        <!-- 鼻子 -->
        <ellipse class="fox-nose" cx="120" cy="132" rx="7" ry="5" />

        <!-- 嘴巴 -->
        <g class="fox-mouth" :class="`mouth-${expression}`">
          <!-- 开心：微笑 -->
          <template v-if="expression === 'happy'">
            <path d="M 104 142 Q 120 154 136 142" />
          </template>
          <!-- 好奇：小圆嘴 -->
          <template v-else-if="expression === 'curious'">
            <ellipse cx="120" cy="146" rx="5" ry="6" />
          </template>
          <!-- 紧张：波浪嘴 -->
          <template v-else-if="expression === 'nervous'">
            <path d="M 107 145 Q 113 140 120 145 Q 127 150 133 145" />
          </template>
          <!-- 崇拜：大笑 -->
          <template v-else-if="expression === 'worship'">
            <path d="M 100 138 Q 120 160 140 138 Q 120 150 100 138 Z" />
            <ellipse class="fox-tongue" cx="120" cy="150" rx="6" ry="4" />
          </template>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  expression: {
    type: String,
    default: 'happy',
    validator: (v) => ['happy', 'curious', 'nervous', 'worship'].includes(v)
  },
  speaking: {
    type: Boolean,
    default: false
  }
});

const expressionClass = computed(() => `expression-${props.expression}`);
</script>

<style scoped>
.fox-character {
  position: relative;
  width: 240px;
  height: 300px;
  margin: 0 auto;
  filter: drop-shadow(0 12px 20px rgba(255, 127, 63, 0.25));
  animation: fox-float 3.5s ease-in-out infinite;
}

.fox-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* ===== 颜色系统 ===== */
.fox-shadow {
  fill: rgba(0, 0, 0, 0.08);
  animation: shadow-pulse 3.5s ease-in-out infinite;
}

.tail-fur {
  fill: #FF8C42;
}
.tail-tip {
  fill: #FFF4E6;
}

.fox-body-shape {
  fill: #FF8C42;
}
.fox-belly {
  fill: #FFF4E6;
}

.fox-foot {
  fill: #E6731C;
}

.fox-arm {
  fill: #FF8C42;
}

.fox-head {
  fill: #FF8C42;
}

.fox-ear {
  fill: #FF8C42;
}
.fox-ear-inner {
  fill: #FFD4A8;
}

.fox-face-mask {
  fill: #FFF4E6;
}

.fox-cheek {
  fill: #FFB6A0;
  opacity: 0.55;
}

.fox-nose {
  fill: #3D2817;
}

/* ===== 眼睛样式 ===== */
.fox-eyes .eye {
  fill: none;
  stroke: #3D2817;
  stroke-width: 4;
  stroke-linecap: round;
  transform-box: fill-box;
  transform-origin: center;
  animation: blink 5s infinite;
}

.fox-eyes .eye circle {
  fill: #3D2817;
  stroke: none;
}

.eye-highlight {
  fill: #FFFFFF !important;
}

.eyebrow {
  fill: none;
  stroke: #3D2817;
  stroke-width: 3;
  stroke-linecap: round;
}

.star-eye {
  fill: #FFD700;
  stroke: #FFA500;
  stroke-width: 1.5;
  filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.6));
}

/* ===== 嘴巴样式 ===== */
.fox-mouth path {
  fill: none;
  stroke: #3D2817;
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fox-mouth ellipse {
  fill: #3D2817;
  stroke: none;
}

.fox-tongue {
  fill: #FF6B6B !important;
}

/* ===== 动画 ===== */

/* 悬浮 */
@keyframes fox-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes shadow-pulse {
  0%, 100% { transform: scale(1); opacity: 0.08; }
  50% { transform: scale(0.9); opacity: 0.06; }
}

/* 眨眼 */
@keyframes blink {
  0%, 88%, 100% { transform: scaleY(1); }
  91%, 94% { transform: scaleY(0.1); }
}

/* 说话时点头 */
.animate-nod {
  animation: fox-nod 0.55s ease-in-out infinite;
}

@keyframes fox-nod {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-3px) rotate(-1deg); }
  75% { transform: translateY(2px) rotate(1deg); }
}

/* 说话时摇尾巴 */
.fox-tail {
  transform-box: fill-box;
  transform-origin: 80% 90%;
  transition: transform 0.3s ease;
}

.animate-wag {
  animation: fox-wag 0.45s ease-in-out infinite;
}

@keyframes fox-wag {
  0%, 100% { transform: rotate(-8deg); }
  50% { transform: rotate(12deg); }
}

/* 说话时整体轻微弹跳 */
.speaking .fox-body {
  animation: fox-nod 0.55s ease-in-out infinite;
}

/* 崇拜表情特殊光效 */
.expression-worship .star-eye {
  animation: star-twinkle 0.8s ease-in-out infinite alternate;
}

@keyframes star-twinkle {
  from { filter: drop-shadow(0 0 3px rgba(255, 215, 0, 0.5)); }
  to { filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.9)); }
}

/* 紧张表情：轻微颤抖 */
.expression-nervous .fox-head {
  animation: fox-shiver 0.15s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes fox-shiver {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(1px); }
}
</style>
