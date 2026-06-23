<template>
  <div class="voice-input" :class="{ recording: isRecording, error: hasError }">
    <button
      class="mic-button"
      :disabled="hasError && !isRecording"
      @click="toggleRecording"
    >
      <span v-if="!isRecording && !hasError" class="mic-icon">🎤</span>
      <span v-else-if="isRecording" class="mic-icon recording-icon">⏹</span>
      <span v-else class="mic-icon error-icon">⚠</span>
    </button>

    <div v-if="isRecording" class="voice-wave">
      <span></span><span></span><span></span><span></span><span></span>
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
  gap: 12px;
  padding: 16px;
}

.mic-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #ff9a56, #ff7f3f);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(255, 127, 63, 0.4);
  transition: all 0.3s ease;
}

.mic-button:hover {
  transform: scale(1.05);
}

.mic-button:active {
  transform: scale(0.95);
}

.mic-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.mic-icon {
  font-size: 32px;
}

.recording .mic-button {
  background: linear-gradient(135deg, #ff4444, #cc0000);
  animation: pulse 1s infinite;
}

.error .mic-button {
  background: linear-gradient(135deg, #ffaa00, #ff8800);
}

.voice-wave {
  display: flex;
  gap: 4px;
  align-items: center;
  height: 30px;
}

.voice-wave span {
  display: block;
  width: 4px;
  height: 100%;
  background: #ff7f3f;
  border-radius: 2px;
  animation: wave 0.6s infinite ease-in-out;
}

.voice-wave span:nth-child(2) { animation-delay: 0.1s; }
.voice-wave span:nth-child(3) { animation-delay: 0.2s; }
.voice-wave span:nth-child(4) { animation-delay: 0.3s; }
.voice-wave span:nth-child(5) { animation-delay: 0.4s; }

.error-message {
  color: #ff4444;
  font-size: 14px;
  text-align: center;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 4px 16px rgba(255, 68, 68, 0.4); }
  50% { box-shadow: 0 4px 24px rgba(255, 68, 68, 0.8); }
}

@keyframes wave {
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
}
</style>
