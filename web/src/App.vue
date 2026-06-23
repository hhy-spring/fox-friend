<template>
  <div class="app-container">
    <SceneBackground :story-stage="currentStoryStage" />

    <div class="fox-stage">
      <FoxCharacter
        :expression="foxExpression"
        :speaking="foxSpeaking"
      />

      <div v-if="dialogText" class="fox-dialog-bubble">
        <p class="fox-dialog-text">{{ dialogText }}</p>
      </div>
    </div>

    <div class="interaction-area">
      <VoiceInput
        @audio-data="handleAudioData"
        @recording-start="handleRecordingStart"
        @recording-stop="handleRecordingStop"
      />
    </div>

    <div class="connection-status" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      <span class="status-text">{{ isConnected ? '已连接' : '连接中...' }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted } from 'vue';
import FoxCharacter from './components/FoxCharacter.vue';
import SceneBackground from './components/SceneBackground.vue';
import VoiceInput from './components/VoiceInput.vue';
import { createWebSocketClient } from './services/websocket-client.js';

const foxExpression = ref('happy');
const foxSpeaking = ref(false);
const dialogText = ref('');
const currentStoryStage = ref('appearance');
const isConnected = ref(false);

const wsClient = shallowRef(null);
let speakingTimer = null;

const STEP_TO_STAGE = {
  APPEARANCE: 'appearance',
  HELP_REQUEST: 'help-request',
  NAMING_CEREMONY: 'naming-ceremony',
  PROFILE_COLLECTION: 'profile-collection',
  FEYNMAN_TRIGGER: 'feynman-trigger',
  TEACHING: 'teaching',
  PARTNER_CONFIRMATION: 'partner-confirmation',
  DAILY_MEETING: 'daily-meeting'
};

const EMOTION_TO_EXPRESSION = {
  happy: 'happy',
  curious: 'curious',
  nervous: 'nervous',
  scared: 'nervous',
  worship: 'worship'
};

// 后端 fox_dialog 消息的 dialog 字段可能是字符串，也可能是结构化对象
// { mainLine, followUp, waitBeforeNextMs }（见 ws-voice-handler.js 各发送点）。
// 统一归一化为孩子能看到的展示文本，避免渲染成 [object Object]。
function normalizeDialogText(dialog) {
  if (!dialog) return null;
  if (typeof dialog === 'string') return dialog;
  if (typeof dialog === 'object') {
    const parts = [];
    if (dialog.mainLine) parts.push(dialog.mainLine);
    if (dialog.followUp) parts.push(dialog.followUp);
    return parts.length > 0 ? parts.join(' ') : null;
  }
  return String(dialog);
}

function handleFoxDialog(message) {
  const displayText = normalizeDialogText(message.dialog);
  if (displayText) {
    dialogText.value = displayText;
  }

  if (message.emotion && EMOTION_TO_EXPRESSION[message.emotion]) {
    foxExpression.value = EMOTION_TO_EXPRESSION[message.emotion];
  }

  if (message.step && STEP_TO_STAGE[message.step]) {
    currentStoryStage.value = STEP_TO_STAGE[message.step];
  }

  foxSpeaking.value = true;

  if (speakingTimer) clearTimeout(speakingTimer);
  const dialogLength = displayText ? displayText.length : 20;
  const speakDuration = Math.max(2000, dialogLength * 150);
  speakingTimer = setTimeout(() => {
    foxSpeaking.value = false;
  }, speakDuration);
}

function handleAudioData(audioBase64) {
  if (wsClient.value && wsClient.value.isConnected()) {
    wsClient.value.sendAudio(audioBase64);
  }
}

function handleRecordingStart() {
  if (speakingTimer) {
    clearTimeout(speakingTimer);
    foxSpeaking.value = false;
  }
}

function handleRecordingStop() {
  // 录音停止后的处理
}

onMounted(() => {
  const childId = 'default-child';
  const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/voice/${childId}`;

  wsClient.value = createWebSocketClient(wsUrl);

  wsClient.value.onConnected(() => {
    isConnected.value = true;
  });

  wsClient.value.onDisconnected(() => {
    isConnected.value = false;
  });

  wsClient.value.onMessage((message) => {
    if (message.type === 'fox_dialog') {
      handleFoxDialog(message);
    } else if (message.type === 'session_start') {
      isConnected.value = true;
    }
  });
});

onUnmounted(() => {
  if (wsClient.value) {
    wsClient.value.disconnect();
  }
  if (speakingTimer) {
    clearTimeout(speakingTimer);
  }
});

defineExpose({
  wsClient,
  handleFoxDialog
});
</script>

<style scoped>
.app-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.fox-stage {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.fox-dialog-bubble {
  margin-top: 24px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  max-width: 80%;
  animation: bubble-in 0.3s ease;
}

.fox-dialog-text {
  font-size: 20px;
  color: #333;
  line-height: 1.6;
  text-align: center;
}

.interaction-area {
  position: relative;
  z-index: 2;
  padding: 16px;
  display: flex;
  justify-content: center;
}

.connection-status {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  font-size: 12px;
  color: #999;
}

.connection-status.connected {
  color: #4caf50;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
}

.connection-status.connected .status-dot {
  background: #4caf50;
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
