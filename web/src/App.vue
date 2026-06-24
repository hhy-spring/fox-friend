<template>
  <div class="app-container">
    <SceneBackground :story-stage="currentStoryStage" />

    <div class="fox-stage">
      <FoxCharacter
        :expression="foxExpression"
        :speaking="foxSpeaking"
      />

      <transition name="bubble">
        <div v-if="dialogText" class="fox-dialog-bubble" :key="dialogText">
          <p class="fox-dialog-text">{{ dialogText }}</p>
        </div>
      </transition>
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
      <span class="status-text">{{ connectionLabel }}</span>
    </div>

    <!-- 诊断面板：帮助定位 WebSocket 连接问题 -->
    <div v-if="showDiagnostics" class="diagnostics-panel">
      <button class="diag-close" @click="showDiagnostics = false">×</button>
      <h4>连接诊断</h4>
      <pre>{{ diagnosticsInfo }}</pre>
    </div>
    <button v-else class="diag-toggle" @click="showDiagnostics = true">诊断</button>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted } from 'vue';
import FoxCharacter from './components/FoxCharacter.vue';
import SceneBackground from './components/SceneBackground.vue';
import VoiceInput from './components/VoiceInput.vue';
import { createWebSocketClient } from './services/websocket-client.js';
import { createHttpVoiceClient } from './services/http-voice-client.js';

const foxExpression = ref('happy');
const foxSpeaking = ref(false);
const dialogText = ref('');
const currentStoryStage = ref('appearance');
const isConnected = ref(false);
const connectionLabel = ref('连接中...');
const transportMode = ref('ws');
const showDiagnostics = ref(false);
const diagnosticsInfo = ref('收集中...');

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

// 语音管道回复（audio 消息的响应）：展示文本 + 切换表情
function handleVoiceReply(message) {
  if (message.replyText) {
    dialogText.value = message.replyText;
  }
  const emotion = message.emotion || 'happy';
  if (EMOTION_TO_EXPRESSION[emotion]) {
    foxExpression.value = EMOTION_TO_EXPRESSION[emotion];
  }
  foxSpeaking.value = true;
  if (speakingTimer) clearTimeout(speakingTimer);
  const speakDuration = Math.max(2000, (message.replyText || '').length * 150);
  speakingTimer = setTimeout(() => { foxSpeaking.value = false; }, speakDuration);
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

  // 收集诊断信息
  const updateDiagnostics = (extra = {}) => {
    const info = {
      pageUrl: location.href,
      pageHost: location.host,
      pageProtocol: location.protocol,
      mode: transportMode.value,
      wsUrl,
      wsReadyState: wsClient.value?._ws?.readyState ?? 'N/A',
      wsReadyStateLabel: ['CONNECTING','OPEN','CLOSING','CLOSED'][wsClient.value?._ws?.readyState] ?? 'N/A',
      isConnected: isConnected.value,
      ...extra
    };
    diagnosticsInfo.value = JSON.stringify(info, null, 2);
  };

  // 统一的消息处理器（WebSocket 和 HTTP 共用）
  function setupHandlers(client) {
    client.onConnected(() => {
      isConnected.value = true;
      connectionLabel.value = '已连接';
      updateDiagnostics({ event: 'onConnected' });
    });

    client.onDisconnected(() => {
      isConnected.value = false;
      if (transportMode.value === 'ws') {
        connectionLabel.value = '重连中...';
      }
      updateDiagnostics({ event: 'onDisconnected' });
    });

    client.onError((error) => {
      updateDiagnostics({ event: 'onError', error: String(error) });
    });

    client.onMessage((message) => {
      if (message.type === 'fox_dialog') {
        handleFoxDialog(message);
      } else if (message.type === 'voice_reply') {
        handleVoiceReply(message);
      } else if (message.type === 'session_start') {
        isConnected.value = true;
        connectionLabel.value = '已连接';
      } else if (message.type === 'error') {
        console.warn('服务器错误:', message.message);
        updateDiagnostics({ event: 'server_error', serverMessage: message.message });
        dialogText.value = message.message || '出了点小问题，再试一次吧';
        foxExpression.value = 'nervous';
        foxSpeaking.value = true;
        if (speakingTimer) clearTimeout(speakingTimer);
        speakingTimer = setTimeout(() => { foxSpeaking.value = false; }, 3000);
      }
    });
  }

  // 策略：先尝试 WebSocket，3 秒内未连接成功则降级到 HTTP 轮询
  transportMode.value = 'ws';
  connectionLabel.value = '连接中...';
  wsClient.value = createWebSocketClient(wsUrl);
  setupHandlers(wsClient.value);

  // 3 秒降级检测
  const downgradeTimer = setTimeout(() => {
    if (!isConnected.value && transportMode.value === 'ws') {
      console.log('WebSocket 3 秒内未连接，降级到 HTTP 轮询模式');
      transportMode.value = 'http';
      connectionLabel.value = '连接中...';
      // 断开 WebSocket
      wsClient.value?.disconnect();
      // 创建 HTTP 客户端
      wsClient.value = createHttpVoiceClient();
      setupHandlers(wsClient.value);
      updateDiagnostics({ event: 'downgrade_to_http' });
    }
  }, 3000);

  // 初始诊断
  updateDiagnostics({ event: 'mounted' });
  // 每 2 秒更新 readyState
  setInterval(updateDiagnostics, 2000);
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
  padding-bottom: 0;
}

/* ===== 对话气泡 ===== */
.fox-dialog-bubble {
  position: relative;
  margin-top: 20px;
  padding: 20px 28px;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12),
              0 2px 8px rgba(0, 0, 0, 0.08);
  max-width: 80%;
  border: 3px solid rgba(255, 140, 66, 0.2);
}

/* 气泡小尾巴 */
.fox-dialog-bubble::before {
  content: '';
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 14px solid transparent;
  border-right: 14px solid transparent;
  border-bottom: 16px solid rgba(255, 255, 255, 0.96);
  filter: drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.04));
}

.fox-dialog-text {
  font-size: 22px;
  font-weight: 600;
  color: #4a3728;
  line-height: 1.7;
  text-align: center;
  letter-spacing: 0.5px;
}

/* ===== 交互区 ===== */
.interaction-area {
  position: relative;
  z-index: 2;
  padding: 12px 16px 24px;
  display: flex;
  justify-content: center;
}

/* ===== 连接状态 ===== */
.connection-status {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: #999;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.connection-status.connected {
  color: #4caf50;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
  transition: background 0.3s ease;
}

.connection-status.connected .status-dot {
  background: #4caf50;
  box-shadow: 0 0 6px rgba(76, 175, 80, 0.6);
}

/* ===== 诊断面板 ===== */
.diag-toggle {
  position: absolute;
  bottom: 14px;
  left: 14px;
  z-index: 10;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 11px;
  cursor: pointer;
}

.diagnostics-panel {
  position: absolute;
  bottom: 14px;
  left: 14px;
  z-index: 20;
  width: 420px;
  max-height: 60vh;
  overflow: auto;
  padding: 14px 16px 16px;
  background: rgba(0, 0, 0, 0.88);
  color: #0f0;
  border-radius: 12px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.5;
}

.diagnostics-panel h4 {
  margin: 0 0 8px;
  color: #fff;
  font-size: 13px;
}

.diagnostics-panel pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.diag-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

/* ===== 气泡过渡动画 ===== */
.bubble-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.bubble-leave-active {
  transition: all 0.2s ease;
}

.bubble-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.9);
}

.bubble-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
</style>
