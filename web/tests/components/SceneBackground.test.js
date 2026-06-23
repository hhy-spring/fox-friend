/**
 * SceneBackground 组件测试 — 场景背景
 *
 * 验证行为（Issue #26 验收标准）：
 * - 渲染场景背景
 * - 支持拼音王国场景
 * - 场景随故事阶段变化
 * - 场景切换有过渡动画
 */

import { mount } from '@vue/test-utils';
import { describe, test, expect } from 'vitest';
import SceneBackground from '../../src/components/SceneBackground.vue';

describe('SceneBackground', () => {
  describe('基础渲染', () => {
    test('应渲染场景背景容器', () => {
      const wrapper = mount(SceneBackground);
      expect(wrapper.find('.scene-background').exists()).toBe(true);
    });

    test('默认场景应为 forest（森林）', () => {
      const wrapper = mount(SceneBackground);
      expect(wrapper.find('.scene-background').classes()).toContain('scene-forest');
    });
  });

  describe('拼音王国场景（PRD §5.3）', () => {
    test('应支持 forest 场景', () => {
      const wrapper = mount(SceneBackground, {
        props: { scene: 'forest' }
      });
      expect(wrapper.find('.scene-background').classes()).toContain('scene-forest');
    });

    test('应支持 phonetic-kingdom 场景', () => {
      const wrapper = mount(SceneBackground, {
        props: { scene: 'phonetic-kingdom' }
      });
      expect(wrapper.find('.scene-background').classes()).toContain('scene-phonetic-kingdom');
    });

    test('应支持 castle 场景', () => {
      const wrapper = mount(SceneBackground, {
        props: { scene: 'castle' }
      });
      expect(wrapper.find('.scene-background').classes()).toContain('scene-castle');
    });

    test('应支持 racetrack 场景', () => {
      const wrapper = mount(SceneBackground, {
        props: { scene: 'racetrack' }
      });
      expect(wrapper.find('.scene-background').classes()).toContain('scene-racetrack');
    });
  });

  describe('场景随故事阶段变化', () => {
    test('场景切换时应更新 class', async () => {
      const wrapper = mount(SceneBackground, {
        props: { scene: 'forest' }
      });

      await wrapper.setProps({ scene: 'phonetic-kingdom' });
      expect(wrapper.find('.scene-background').classes()).toContain('scene-phonetic-kingdom');
      expect(wrapper.find('.scene-background').classes()).not.toContain('scene-forest');
    });

    test('应支持通过 storyStage 自动映射场景', () => {
      const wrapper = mount(SceneBackground, {
        props: { storyStage: 'naming-ceremony' }
      });

      expect(wrapper.find('.scene-background').classes()).toContain('scene-phonetic-kingdom');
    });

    test('storyStage 变化应自动切换场景', async () => {
      const wrapper = mount(SceneBackground, {
        props: { storyStage: 'appearance' }
      });

      expect(wrapper.find('.scene-background').classes()).toContain('scene-forest');

      await wrapper.setProps({ storyStage: 'teaching' });
      expect(wrapper.find('.scene-background').classes()).toContain('scene-phonetic-kingdom');
    });
  });

  describe('场景元素', () => {
    test('应包含背景层', () => {
      const wrapper = mount(SceneBackground);
      expect(wrapper.find('.scene-bg-layer').exists()).toBe(true);
    });

    test('应包含装饰元素层', () => {
      const wrapper = mount(SceneBackground);
      expect(wrapper.find('.scene-decorations').exists()).toBe(true);
    });
  });
});
