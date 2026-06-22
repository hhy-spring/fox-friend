const {
  createAgent,
  createMessage,
  MESSAGE_TYPES
} = require('../../src/dialog/agent-base');

describe('MESSAGE_TYPES', () => {
  test('defines the 4 standard communication message types', () => {
    expect(MESSAGE_TYPES.TASK_REQUEST).toBe('TASK_REQUEST');
    expect(MESSAGE_TYPES.TASK_RESPONSE).toBe('TASK_RESPONSE');
    expect(MESSAGE_TYPES.TASK_ERROR).toBe('TASK_ERROR');
    expect(MESSAGE_TYPES.STATUS_UPDATE).toBe('STATUS_UPDATE');
  });

  test('exposes exactly 4 message types', () => {
    expect(Object.keys(MESSAGE_TYPES)).toHaveLength(4);
  });
});

describe('createMessage', () => {
  test('returns a message with id, type, agentName, payload and timestamp', () => {
    const msg = createMessage(MESSAGE_TYPES.TASK_REQUEST, 'StoryStageAgent', { topic: 'dinosaur' });

    expect(msg).toHaveProperty('id');
    expect(msg).toHaveProperty('type', MESSAGE_TYPES.TASK_REQUEST);
    expect(msg).toHaveProperty('agentName', 'StoryStageAgent');
    expect(msg).toHaveProperty('payload');
    expect(msg.payload).toEqual({ topic: 'dinosaur' });
    expect(msg).toHaveProperty('timestamp');
  });

  test('generates a unique id for each call', () => {
    const a = createMessage(MESSAGE_TYPES.TASK_REQUEST, 'A', {});
    const b = createMessage(MESSAGE_TYPES.TASK_REQUEST, 'A', {});

    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  test('produces a numeric timestamp', () => {
    const msg = createMessage(MESSAGE_TYPES.STATUS_UPDATE, 'Agent', { ok: true });

    expect(typeof msg.timestamp).toBe('number');
    expect(Number.isFinite(msg.timestamp)).toBe(true);
  });
});

describe('createAgent', () => {
  test('returns an object exposing execute, getInfo and reset methods', () => {
    const agent = createAgent({ name: 'StoryStageAgent', taskHandler: async () => ({}) });

    expect(typeof agent.execute).toBe('function');
    expect(typeof agent.getInfo).toBe('function');
    expect(typeof agent.reset).toBe('function');
  });

  test('execute invokes the taskHandler with the provided input', async () => {
    const taskHandler = jest.fn(async (input) => ({ echoed: input }));
    const agent = createAgent({ name: 'EchoAgent', taskHandler });

    await agent.execute({ say: 'hi' });

    expect(taskHandler).toHaveBeenCalledTimes(1);
    expect(taskHandler).toHaveBeenCalledWith({ say: 'hi' });
  });

  test('execute returns success status when the handler succeeds', async () => {
    const agent = createAgent({ name: 'OkAgent', taskHandler: async () => ({ done: true }) });

    const result = await agent.execute({});

    expect(result.status).toBe('success');
    expect(result.agentName).toBe('OkAgent');
    expect(result.error).toBeNull();
  });

  test('execute returns error status when the handler throws', async () => {
    const agent = createAgent({
      name: 'BrokenAgent',
      taskHandler: async () => { throw new Error('boom'); }
    });

    const result = await agent.execute({});

    expect(result.status).toBe('error');
    expect(result.agentName).toBe('BrokenAgent');
  });

  test('execute reports a duration in milliseconds', async () => {
    const agent = createAgent({ name: 'TimedAgent', taskHandler: async () => ({}) });

    const result = await agent.execute({});

    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test('execute includes the output returned by the handler', async () => {
    const payload = { stage: 'intro', items: ['egg', 'dino'] };
    const agent = createAgent({ name: 'OutAgent', taskHandler: async () => payload });

    const result = await agent.execute({});

    expect(result.output).toEqual(payload);
  });

  test('execute includes the error message when the handler fails', async () => {
    const agent = createAgent({
      name: 'ErrAgent',
      taskHandler: async () => { throw new Error('something broke'); }
    });

    const result = await agent.execute({});

    expect(result.error).not.toBeNull();
    expect(String(result.error)).toContain('something broke');
  });

  test('execute returns a taskId for each invocation', async () => {
    const agent = createAgent({ name: 'IdAgent', taskHandler: async () => ({}) });

    const r1 = await agent.execute({});
    const r2 = await agent.execute({});

    expect(r1.taskId).toBeTruthy();
    expect(r2.taskId).toBeTruthy();
    expect(r1.taskId).not.toBe(r2.taskId);
  });

  test('handles async task handlers correctly', async () => {
    const agent = createAgent({
      name: 'AsyncAgent',
      taskHandler: async (input) => {
        return new Promise((resolve) => setTimeout(() => resolve({ doubled: input.n * 2 }), 10));
      }
    });

    const result = await agent.execute({ n: 21 });

    expect(result.status).toBe('success');
    expect(result.output).toEqual({ doubled: 42 });
  });

  test('handles handlers that return null or undefined', async () => {
    const nullAgent = createAgent({ name: 'NullAgent', taskHandler: async () => null });
    const undefAgent = createAgent({ name: 'UndefAgent', taskHandler: async () => undefined });

    const nullResult = await nullAgent.execute({});
    const undefResult = await undefAgent.execute({});

    expect(nullResult.status).toBe('success');
    expect(nullResult.output).toBeNull();
    expect(undefResult.status).toBe('success');
    expect(undefResult.output).toBeUndefined();
  });
});

describe('agent stats tracking', () => {
  test('getInfo returns the agent name', () => {
    const agent = createAgent({ name: 'NamedAgent', taskHandler: async () => ({}) });

    expect(agent.getInfo().name).toBe('NamedAgent');
  });

  test('getInfo tracks the number of completed tasks', async () => {
    const agent = createAgent({ name: 'CountAgent', taskHandler: async () => ({}) });

    await agent.execute({});
    await agent.execute({});

    expect(agent.getInfo().tasksCompleted).toBe(2);
  });

  test('getInfo tracks the number of failed tasks', async () => {
    const agent = createAgent({
      name: 'FailAgent',
      taskHandler: async () => { throw new Error('nope'); }
    });

    await agent.execute({});
    await agent.execute({});

    expect(agent.getInfo().tasksFailed).toBe(2);
  });

  test('getInfo tracks the last error message', async () => {
    const agent = createAgent({
      name: 'LastErrorAgent',
      taskHandler: async () => { throw new Error('latest failure'); }
    });

    await agent.execute({});

    expect(agent.getInfo().lastError).not.toBeNull();
    expect(String(agent.getInfo().lastError)).toContain('latest failure');
  });

  test('getInfo reports null lastError before any failure', () => {
    const agent = createAgent({ name: 'CleanAgent', taskHandler: async () => ({}) });

    expect(agent.getInfo().lastError).toBeNull();
  });

  test('reset clears completed, failed and lastError stats', async () => {
    const agent = createAgent({
      name: 'ResetAgent',
      taskHandler: async (input) => {
        if (input.fail) throw new Error('fail');
        return {};
      }
    });

    await agent.execute({ fail: false });
    await agent.execute({ fail: true });

    expect(agent.getInfo().tasksCompleted).toBe(1);
    expect(agent.getInfo().tasksFailed).toBe(1);
    expect(agent.getInfo().lastError).not.toBeNull();

    agent.reset();

    const info = agent.getInfo();
    expect(info.tasksCompleted).toBe(0);
    expect(info.tasksFailed).toBe(0);
    expect(info.lastError).toBeNull();
  });
});
