<template>
  <div class="voice-input" :class="{ recording: isRecording, error: hasError }">
    <button
      class="mic-button"
      :disabled="hasError && !isRecording"
      @click="toggleRecording"
    >
      <svg
        v-if="!isRecording && !hasError"
        class="mic-icon"
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="18" y="6" width="12" height="22" rx="6" fill="white" />
        <path
          d="M 12 22 Q 12 36 24 36 Q 36 36 36 22"
          stroke="white"
          stroke-width="3.5"
          fill="none"
          stroke-linecap="round"
        />
        <line x1="24" y1="36" x2="24" y2="42" stroke="white" stroke-width="3.5" stroke-linecap="round" />
        <line x1="18" y1="42" x2="30" y2="42" stroke="white" stroke-width="3.5" stroke-linecap="round" />
      </svg>

      <svg
        v-else-if="isRecording"
        class="mic-icon recording-icon"
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="16" y="8" width="16" height="20" rx="8" fill="white" />
        <line x1="24" y1="32" x2="24" y2="40" stroke="white" stroke-width="3.5" stroke-linecap="round" />
      </svg>

      <svg
        v-else
        class="mic-icon error-icon"
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="18" y="6" width="12" height="22" rx="6" fill="white" />
        <line x1="10" y1="38" x2="38" y2="10" stroke="white" stroke-width="4" stroke-linecap="round" />
      </svg>
    </button>

    <div v-if="isRecording" class="voice-wave">
      <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
    </div>

    <p v-if="hasError" class="error-message">
      {{ errorMessage }}
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['audio-data', 'recording-start', 'recording-stop']);

const isRecording = ref(false);
const hasError = ref(false);
const errorMessage = ref('');

let mediaStream = null;
let mediaRecorder = null;
let audioChunks = [];

async function toggleRecording() {
  if (isRecording.value) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  hasError.value = false;
  errorMessage.value = '';

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result.split(',')[1];
        emit('audio-data', base64data);
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorder.start();
    isRecording.value = true;
    emit('recording-start');
  } catch (err) {
    hasError.value = true;
    errorMessage.value = '麦克风无法使用，请让爸爸妈妈帮忙';
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }
  isRecording.value = false;
  emit('recording-stop');
}
</script>

<style scoped>
.voice-input {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 16px;
}

.mic-button {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #ff9a56, #ff7f3f);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(255, 127, 63, 0.45),
              inset 0 -4px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
}

.mic-button:hover:not(:disabled) {
  transform: scale(1.06);
  box-shadow: 0 8px 28px rgba(255, 127, 63, 0.55),
              inset 0 -4px 8px rgba(0, 0, 0, 0.1);
}

.mic-button:active:not(:disabled) {
  transform: scale(0.94);
}

.mic-button:disabled {
  background: #ccc;
  cursor: not-allowed;
  box-shadow: none;
}

.mic-icon {
  width: 44px;
  height: 44px;
}

.recording .mic-button {
  background: linear-gradient(135deg, #ff5252, #c62828);
  animation: pulse-rec 1.2s infinite;
  box-shadow: 0 6px 24px rgba(255, 82, 82, 0.5);
}

.error .mic-button {
  background: linear-gradient(135deg, #ffa726, #ef6c00);
}

/* 录音呼吸圈 */
.recording .mic-button::before {
  content: '';
  position: absolute;
  top: -8px;
  left: -8px;
  right: -8px;
  bottom: -8px;
  border-radius: 50%;
  border: 3px solid rgba(255, 82, 82, 0.4);
  animation: ring-expand 1.5s infinite ease-out;
}

.recording .mic-button::after {
  content: '';
  position: absolute;
  top: -8px;
  left: -8px;
  right: -8px;
  bottom: -8px;
  border-radius: 50%;
  border: 3px solid rgba(255, 82, 82, 0.3);
  animation: ring-expand 1.5s infinite ease-out 0.5s;
}

.voice-wave {
  display: flex;
  gap: 5px;
  align-items: center;
  height: 36px;
}

.voice-wave span {
  display: block;
  width: 5px;
  height: 100%;
  background: linear-gradient(180deg, #ff9a56, #ff5252);
  border-radius: 3px;
  animation: wave 0.7s infinite ease-in-out;
}

.voice-wave span:nth-child(2) { animation-delay: 0.1s; }
.voice-wave span:nth-child(3) { animation-delay: 0.2s; }
.voice-wave span:nth-child(4) { animation-delay: 0.3s; }
.voice-wave span:nth-child(5) { animation-delay: 0.15s; }
.voice-wave span:nth-child(6) { animation-delay: 0.25s; }
.voice-wave span:nth-child(7) { animation-delay: 0.35s; }

.error-message {
  color: #e65100;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px 16px;
  border-radius: 12px;
}

@keyframes pulse-rec {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes ring-expand {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes wave {
  0%, 100% { transform: scaleY(0.25); }
  50% { transform: scaleY(1); }
}
</style>
