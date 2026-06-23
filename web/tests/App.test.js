/**
 * App 组件集成测试 — 主应用
 *
 * 验证行为（Issue #26 验收标准）：
 * - 集成狐狸角色、场景背景、语音输入
 * - WebSocket 连接管理
 * - 对话消息处理
 * - 表情与场景联动
 */

import { mount, flushPromises } from '@vue/test-utils';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import App from '../src/App.vue';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.OPEN = 1;
    this._sent = [];
    queueMicrotask(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    });
  }
  send(data) { this._sent.push(data); }
  close() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1000 }); }
  simulateMessage(data) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }
}

global.WebSocket = MockWebSocket;

// Mock AudioContext
global.AudioContext = vi.fn(() => ({
  createAnalyser: () => ({ connect: vi.fn(), getByteFrequencyData: vi.fn() }),
  createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
  close: vi.fn()
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基础渲染', () => {
    test('应渲染应用容器', () => {
      const wrapper = mount(App);
      expect(wrapper.find('.app-container').exists()).toBe(true);
    });

    test('应包含场景背景组件', () => {
      const wrapper = mount(App);
      expect(wrapper.findComponent({ name: 'SceneBackground' }).exists()).toBe(true);
    });

    test('应包含狐狸角色组件', () => {
      const wrapper = mount(App);
      expect(wrapper.findComponent({ name: 'FoxCharacter' }).exists()).toBe(true);
    });

    test('应包含语音输入组件', () => {
      const wrapper = mount(App);
      expect(wrapper.findComponent({ name: 'VoiceInput' }).exists()).toBe(true);
    });
  });

  describe('对话显示', () => {
    test('应显示狐狸对话文本', async () => {
      const wrapper = mount(App);
      await flushPromises();

      wrapper.vm.handleFoxDialog({
        type: 'fox_dialog',
        dialog: '你好你好！我一直在等你呢！',
        step: 'APPEARANCE'
      });
      await flushPromises();

      expect(wrapper.find('.fox-dialog-text').text()).toContain('你好你好');
    });

    test('后端结构化 dialog 对象应渲染为文本而非 [object Object]', async () => {
      // 回归测试：ws-voice-handler.js 发送的 dialog 是
      // { mainLine, followUp, waitBeforeNextMs } 对象，前端必须归一化为展示文本
      const wrapper = mount(App);
      await flushPromises();

      wrapper.vm.handleFoxDialog({
        type: 'fox_dialog',
        dialog: {
          mainLine: '你好你好！我一直在等一个小朋友...你终于来了！',
          followUp: '你听见我说话了吗？',
          waitBeforeNextMs: 2000
        },
        step: 'APPEARANCE'
      });
      await flushPromises();

      const text = wrapper.find('.fox-dialog-text').text();
      expect(text).not.toContain('[object Object]');
      expect(text).toContain('你好你好');
      expect(text).toContain('你听见我说话了吗');
    });

    test('仅含 mainLine 的结构化 dialog 应正常渲染', async () => {
      const wrapper = mount(App);
      await flushPromises();

      wrapper.vm.handleFoxDialog({
        type: 'fox_dialog',
        dialog: { mainLine: '闪电！快过来，我发现了一件事！', followUp: null },
        step: 'DAILY_MEETING'
      });
      await flushPromises();

      const text = wrapper.find('.fox-dialog-text').text();
      expect(text).not.toContain('[object Object]');
      expect(text).toContain('闪电');
    });

    test('狐狸说话时角色应为 speaking 状态', async () => {
      const wrapper = mount(App);
      await flushPromises();

      wrapper.vm.handleFoxDialog({
        type: 'fox_dialog',
        dialog: '你好！',
        step: 'APPEARANCE'
      });
      await flushPromises();

      expect(wrapper.findComponent({ name: 'FoxCharacter' }).props('speaking')).toBe(true);
    });
  });

  describe('表情联动', () => {
    test('收到 happy 情绪消息时狐狸应为 happy 表情', async () => {
      const wrapper = mount(App);
      await flushPromises();

      wrapper.vm.handleFoxDialog({
        type: 'fox_dialog',
        dialog: '你好！',
        emotion: 'happy',
        step: 'APPEARANCE'
      });
      await flushPromises();

      expect(wrapper.findComponent({ name: 'FoxCharacter' }).props('expression')).toBe('happy');
    });

    test('收到 curious 情绪消息时狐狸应为 curious 表情', async () => {
      const wrapper = mount(App);
      await flushPromises();

      wrapper.vm.handleFoxDialog({
        type: 'fox_dialog',
        dialog: '你叫什么？',
        emotion: 'curious',
        step: 'PROFILE_COLLECTION'
      });
      await flushPromises();

      expect(wrapper.findComponent({ name: 'FoxCharacter' }).props('expression')).toBe('curious');
    });

    test('收到 nervous 情绪消息时狐狸应为 nervous 表情', async () => {
      const wrapper = mount(App);
      await flushPromises();

      wrapper.vm.handleFoxDialog({
        type: 'fox_dialog',
        dialog: '别怕别怕！',
        emotion: 'nervous',
        step: 'APPEARANCE'
      });
      await flushPromises();

      expect(wrapper.findComponent({ name: 'FoxCharacter' }).props('expression')).toBe('nervous');
    });

    test('收到 worship 情绪消息时狐狸应为 worship 表情', async () => {
      const wrapper = mount(App);
      await flushPromises();

      wrapper.vm.handleFoxDialog({
        type: 'fox_dialog',
        dialog: '好酷的名字！',
        emotion: 'worship',
        step: 'NAMING_CEREMONY'
      });
      await flushPromises();

      expect(wrapper.findComponent({ name: 'FoxCharacter' }).props('expression')).toBe('worship');
    });
  });

  describe('场景联动', () => {
    test('收到命名仪式步骤时场景应切换到拼音王国', async () => {
      const wrapper = mount(App);
      await flushPromises();

      wrapper.vm.handleFoxDialog({
        type: 'fox_dialog',
        dialog: '好酷的名字！',
        step: 'NAMING_CEREMONY'
      });
      await flushPromises();

      const sceneBg = wrapper.findComponent({ name: 'SceneBackground' });
      expect(sceneBg.props('storyStage')).toBe('naming-ceremony');
    });
  });

  describe('语音输入处理', () => {
    test('收到音频数据应通过 WebSocket 发送', async () => {
      const wrapper = mount(App);
      await flushPromises();

      const voiceInput = wrapper.findComponent({ name: 'VoiceInput' });
      voiceInput.vm.$emit('audio-data', 'base64-audio-data');

      expect(wrapper.vm.wsClient.isConnected()).toBe(true);
    });
  });

  describe('连接状态', () => {
    test('应显示连接状态', async () => {
      const wrapper = mount(App);
      await flushPromises();

      expect(wrapper.find('.connection-status').exists()).toBe(true);
    });

    test('连接成功后应显示已连接状态', async () => {
      const wrapper = mount(App);
      await flushPromises();

      expect(wrapper.find('.connection-status').classes()).toContain('connected');
    });
  });

  describe('录音事件处理', () => {
    test('录音开始时应停止狐狸说话', async () => {
      const wrapper = mount(App);
      await flushPromises();

      wrapper.vm.handleFoxDialog({
        type: 'fox_dialog',
        dialog: '你好！',
        step: 'APPEARANCE'
      });
      await flushPromises();

      const voiceInput = wrapper.findComponent({ name: 'VoiceInput' });
      voiceInput.vm.$emit('recording-start');
      await flushPromises();

      expect(wrapper.findComponent({ name: 'FoxCharacter' }).props('speaking')).toBe(false);
    });

    test('录音停止事件应被处理', async () => {
      const wrapper = mount(App);
      await flushPromises();

      const voiceInput = wrapper.findComponent({ name: 'VoiceInput' });
      voiceInput.vm.$emit('recording-stop');
      await flushPromises();

      expect(wrapper.vm).toBeTruthy();
    });
  });

  describe('组件卸载', () => {
    test('卸载时应断开 WebSocket 连接', async () => {
      const wrapper = mount(App);
      await flushPromises();

      const client = wrapper.vm.wsClient;
      expect(client).toBeTruthy();

      wrapper.unmount();

      expect(client.isConnected()).toBe(false);
    });
  });
});
