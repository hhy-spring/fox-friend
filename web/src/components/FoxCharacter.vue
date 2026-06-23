<template>
  <div
    class="fox-character"
    :class="[expressionClass, { speaking }]"
  >
    <div class="fox-body" :class="{ 'animate-nod': speaking }">
      <div class="fox-eyes" :class="`eyes-${expression}`">
        <div class="eye eye-left"></div>
        <div class="eye eye-right"></div>
      </div>
      <div class="fox-mouth" :class="`mouth-${expression}`"></div>
      <div class="fox-tail" :class="{ 'animate-wag': speaking }"></div>
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
  width: 200px;
  height: 240px;
  margin: 0 auto;
  transition: all 0.3s ease;
}

.fox-body {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #ff9a56 0%, #ff7f3f 100%);
  border-radius: 50% 50% 45% 45%;
  box-shadow: 0 8px 24px rgba(255, 127, 63, 0.3);
}

.fox-eyes {
  position: absolute;
  top: 35%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 30px;
}

.eye {
  width: 24px;
  height: 24px;
  background: #2c1810;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.eye-left { transform: translateX(-2px); }
.eye-right { transform: translateX(2px); }

.eyes-happy .eye {
  height: 12px;
  border-radius: 50% 50% 0 0;
  background: #2c1810;
}

.eyes-curious .eye {
  width: 28px;
  height: 28px;
}

.eyes-nervous .eye {
  animation: shake-eye 0.3s infinite;
}

.eyes-worship .eye {
  background: #ffd700;
  box-shadow: 0 0 12px #ffd700;
}

.fox-mouth {
  position: absolute;
  top: 55%;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 15px;
  background: #2c1810;
  border-radius: 0 0 50% 50%;
  transition: all 0.3s ease;
}

.mouth-happy {
  width: 40px;
  height: 20px;
  border-radius: 0 0 50% 50%;
}

.mouth-curious {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.mouth-nervous {
  width: 20px;
  height: 8px;
  border-radius: 4px;
}

.mouth-worship {
  width: 36px;
  height: 18px;
  border-radius: 0 0 50% 50%;
  background: #ff4444;
}

.fox-tail {
  position: absolute;
  bottom: 20%;
  right: -15%;
  width: 60px;
  height: 80px;
  background: linear-gradient(180deg, #ff9a56 0%, #ff7f3f 60%, #fff 100%);
  border-radius: 50% 50% 50% 0;
  transform-origin: bottom left;
  transform: rotate(-30deg);
}

.speaking .fox-body {
  animation: bounce 0.5s infinite;
}

.animate-nod {
  animation: nod 0.6s infinite;
}

.animate-wag {
  animation: wag 0.4s infinite;
}

@keyframes nod {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes wag {
  0%, 100% { transform: rotate(-30deg); }
  50% { transform: rotate(-10deg); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes shake-eye {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(2px); }
}
</style>
