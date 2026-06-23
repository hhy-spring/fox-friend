/**
 * FoxCharacter 组件测试 — 狐狸角色
 *
 * 验证行为（Issue #26 验收标准）：
 * - 渲染狐狸角色
 * - 支持 4 种表情：happy, curious, nervous, worship
 * - 表情切换正确
 * - 说话时触发动画
 */

import { mount } from '@vue/test-utils';
import { describe, test, expect } from 'vitest';
import FoxCharacter from '../../src/components/FoxCharacter.vue';

describe('FoxCharacter', () => {
  describe('基础渲染', () => {
    test('应渲染狐狸角色容器', () => {
      const wrapper = mount(FoxCharacter);
      expect(wrapper.find('.fox-character').exists()).toBe(true);
    });

    test('默认表情应为 happy', () => {
      const wrapper = mount(FoxCharacter);
      expect(wrapper.find('.fox-character').classes()).toContain('expression-happy');
    });
  });

  describe('表情系统（PRD §5.3 要求至少 4 种表情）', () => {
    test('应支持 happy 表情', () => {
      const wrapper = mount(FoxCharacter, {
        props: { expression: 'happy' }
      });
      expect(wrapper.find('.fox-character').classes()).toContain('expression-happy');
    });

    test('应支持 curious 表情', () => {
      const wrapper = mount(FoxCharacter, {
        props: { expression: 'curious' }
      });
      expect(wrapper.find('.fox-character').classes()).toContain('expression-curious');
    });

    test('应支持 nervous 表情（紧张/害怕）', () => {
      const wrapper = mount(FoxCharacter, {
        props: { expression: 'nervous' }
      });
      expect(wrapper.find('.fox-character').classes()).toContain('expression-nervous');
    });

    test('应支持 worship 表情（崇拜式回应）', () => {
      const wrapper = mount(FoxCharacter, {
        props: { expression: 'worship' }
      });
      expect(wrapper.find('.fox-character').classes()).toContain('expression-worship');
    });

    test('表情切换时应更新 class', async () => {
      const wrapper = mount(FoxCharacter, {
        props: { expression: 'happy' }
      });

      await wrapper.setProps({ expression: 'curious' });
      expect(wrapper.find('.fox-character').classes()).toContain('expression-curious');
      expect(wrapper.find('.fox-character').classes()).not.toContain('expression-happy');
    });
  });

  describe('动画系统（PRD §5.3 要求说话时有微动作）', () => {
    test('说话时应添加 speaking 动画 class', async () => {
      const wrapper = mount(FoxCharacter, {
        props: { speaking: false }
      });

      expect(wrapper.find('.fox-character').classes()).not.toContain('speaking');

      await wrapper.setProps({ speaking: true });
      expect(wrapper.find('.fox-character').classes()).toContain('speaking');
    });

    test('说话时应显示点头动画', async () => {
      const wrapper = mount(FoxCharacter, {
        props: { speaking: true }
      });

      expect(wrapper.find('.fox-body').classes()).toContain('animate-nod');
    });

    test('未说话时不应显示动画', () => {
      const wrapper = mount(FoxCharacter, {
        props: { speaking: false }
      });

      expect(wrapper.find('.fox-body').classes()).not.toContain('animate-nod');
    });
  });

  describe('角色部件（PRD §5.3 温柔表情、好奇眼睛）', () => {
    test('应包含狐狸身体', () => {
      const wrapper = mount(FoxCharacter);
      expect(wrapper.find('.fox-body').exists()).toBe(true);
    });

    test('应包含狐狸眼睛', () => {
      const wrapper = mount(FoxCharacter);
      expect(wrapper.find('.fox-eyes').exists()).toBe(true);
    });

    test('应包含狐狸嘴巴', () => {
      const wrapper = mount(FoxCharacter);
      expect(wrapper.find('.fox-mouth').exists()).toBe(true);
    });

    test('应包含狐狸尾巴', () => {
      const wrapper = mount(FoxCharacter);
      expect(wrapper.find('.fox-tail').exists()).toBe(true);
    });
  });
});
