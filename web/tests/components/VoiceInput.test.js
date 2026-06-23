/**
 * VoiceInput 组件测试 — 语音输入
 *
 * 验证行为（Issue #26 验收标准）：
 * - 孩子说话，无需打字
 * - 语音输入采集正常
 * - 录音状态可视化
 * - 错误处理
 */

import { mount, flushPromises } from '@vue/test-utils';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import VoiceInput from '../../src/components/VoiceInput.vue';

// Mock Web Audio API
const mockAnalyser = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  getByteFrequencyData: vi.fn()
};

const mockMediaStream = {
  getTracks: () => [{ stop: vi.fn() }]
};

const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstop: null
};

global.navigator.mediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue(mockMediaStream)
};

global.MediaRecorder = vi.fn(() => mockMediaRecorder);

global.AudioContext = vi.fn(() => ({
  createAnalyser: () => mockAnalyser,
  createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
  close: vi.fn()
}));

// Mock FileReader
global.FileReader = vi.fn(() => {
  const instance = {
    result: 'data:audio/webm;base64,ZmFrZS1hdWRpby1kYXRh',
    onloadend: null,
    readAsDataURL: vi.fn(() => {
      if (instance.onloadend) {
        instance.onloadend();
      }
    })
  };
  return instance;
});

describe('VoiceInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaRecorder.state = 'inactive';
  });

  describe('基础渲染', () => {
    test('应渲染语音输入容器', () => {
      const wrapper = mount(VoiceInput);
      expect(wrapper.find('.voice-input').exists()).toBe(true);
    });

    test('应显示麦克风按钮', () => {
      const wrapper = mount(VoiceInput);
      expect(wrapper.find('.mic-button').exists()).toBe(true);
    });

    test('默认状态应为未录音', () => {
      const wrapper = mount(VoiceInput);
      expect(wrapper.find('.voice-input').classes()).not.toContain('recording');
    });
  });

  describe('录音控制（PRD §5.2 无菜单界面，孩子说话）', () => {
    test('点击麦克风按钮应请求麦克风权限', async () => {
      const wrapper = mount(VoiceInput);
      await wrapper.find('.mic-button').trigger('click');
      await flushPromises();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    test('录音开始后应显示 recording 状态', async () => {
      const wrapper = mount(VoiceInput);
      await wrapper.find('.mic-button').trigger('click');
      await flushPromises();

      expect(wrapper.find('.voice-input').classes()).toContain('recording');
    });

    test('录音中再次点击应停止录音', async () => {
      const wrapper = mount(VoiceInput);
      await wrapper.find('.mic-button').trigger('click');
      await flushPromises();
      expect(wrapper.find('.voice-input').classes()).toContain('recording');

      await wrapper.find('.mic-button').trigger('click');
      await flushPromises();
      expect(wrapper.find('.voice-input').classes()).not.toContain('recording');
    });

    test('录音停止后应触发 audio-data 事件', async () => {
      const wrapper = mount(VoiceInput);
      await wrapper.find('.mic-button').trigger('click');
      await flushPromises();
      await wrapper.find('.mic-button').trigger('click');
      await flushPromises();

      // 触发 MediaRecorder stop 事件
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop();
      }
      await flushPromises();

      expect(wrapper.emitted('audio-data')).toBeTruthy();
    });
  });

  describe('错误处理', () => {
    test('麦克风权限被拒绝应显示错误状态', async () => {
      navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

      const wrapper = mount(VoiceInput);
      await wrapper.find('.mic-button').trigger('click');
      await flushPromises();

      expect(wrapper.find('.voice-input').classes()).toContain('error');
      expect(wrapper.find('.error-message').exists()).toBe(true);
    });
  });

  describe('可视化反馈（适合 4-7 岁儿童）', () => {
    test('录音中应显示音波动画', async () => {
      const wrapper = mount(VoiceInput);
      await wrapper.find('.mic-button').trigger('click');
      await flushPromises();

      expect(wrapper.find('.voice-wave').exists()).toBe(true);
    });

    test('未录音时不应显示音波动画', () => {
      const wrapper = mount(VoiceInput);
      expect(wrapper.find('.voice-wave').exists()).toBe(false);
    });
  });
});
