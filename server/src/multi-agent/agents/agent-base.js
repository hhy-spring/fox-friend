/**
 * 智能体基类 - 定义标准化智能体接口
 *
 * 参考技术架构执行摘要§三「对话引擎架构」
 * 所有智能体必须实现 execute 方法，接受输入和上下文
 */

/**
 * 创建智能体基类
 * @param {object} config
 * @param {string} config.id - 智能体唯一标识
 * @param {string} config.name - 智能体名称
 * @param {string} config.role - 智能体角色描述
 * @param {function} config.execute - 执行函数
 * @returns {object} 智能体实例
 */
function createAgent(config) {
  return {
    id: config.id,
    name: config.name,
    role: config.role,
    capabilities: config.capabilities || [],

    /**
     * 执行任务
     * @param {object} input - 任务输入
     * @param {object} context - 执行上下文 { publish, getState }
     * @returns {Promise<object>} 执行结果
     */
    async execute(input, context) {
      const startTime = Date.now();
      try {
        // 发布开始状态
        context.publish('STATE_SYNC', {
          agentId: config.id,
          state: 'RUNNING',
          input
        });

        const result = await config.execute(input, context);

        const durationMs = Date.now() - startTime;

        // 发布完成状态
        context.publish('STATE_SYNC', {
          agentId: config.id,
          state: 'COMPLETED',
          result,
          durationMs
        });

        return { success: true, result, durationMs };
      } catch (error) {
        const durationMs = Date.now() - startTime;
        context.publish('TASK_ERROR', {
          agentId: config.id,
          error: error.message,
          durationMs
        });
        throw error;
      }
    }
  };
}

module.exports = { createAgent };
