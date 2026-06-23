/**
 * 借分契约持久化测试 - Issue #24 借分契约跨会话持久化
 *
 * 参考PRD §4.3 借分契约机制：孩子连续 3 次会议拒绝推进教学剧情 → 第 4 次会议触发借分契约
 *
 * 持久化要求：
 *   - loadState(childId) 读取已保存的拒绝计数与状态，无记录时返回 null
 *   - saveState(childId, { refusalCount, currentState }) 写入文件并返回时间戳
 *   - resetState(childId) 清除记录（删除文件），即使文件不存在也返回 success:true
 *   - 文件路径模式：borrow_state_{childId}.json
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { BORROW_STATES } = require('../../src/dialog/borrow-contract-state');
const { createBorrowContractPersistence } = require('../../src/dialog/borrow-contract-persistence');

describe('借分契约持久化 - Issue #24', () => {
  let tmpDir;

  beforeEach(() => {
    // 每个测试使用独立的临时目录，避免相互污染
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fox-friend-borrow-'));
  });

  afterEach(() => {
    // 测试后清理临时目录
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('loadState() - 读取借分契约状态', () => {
    test('未知孩子时返回 null（不抛错）', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const result = persistence.loadState('unknown-child');
      expect(result).toBeNull();
    });

    test('文件不存在时返回 null', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const result = persistence.loadState('child-no-file');
      expect(result).toBeNull();
    });
  });

  describe('saveState() - 保存借分契约状态', () => {
    test('保存成功返回 success:true、path 与 timestamp', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childId = 'child-001';

      const result = persistence.saveState(childId, {
        refusalCount: 2,
        currentState: BORROW_STATES.COUNTING
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe(path.join(tmpDir, `borrow_state_${childId}.json`));
      expect(result.timestamp).toBeDefined();
      expect(fs.existsSync(result.path)).toBe(true);
    });

    test('保存时如果目录不存在，自动创建嵌套目录', () => {
      const nestedDir = path.join(tmpDir, 'nested', 'deep', 'storage');
      const persistence = createBorrowContractPersistence({ storageDir: nestedDir });
      const childId = 'child-002';

      const result = persistence.saveState(childId, {
        refusalCount: 1,
        currentState: BORROW_STATES.COUNTING
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(nestedDir)).toBe(true);
      expect(fs.existsSync(result.path)).toBe(true);
    });

    test('保存的文件包含 lastUpdated 时间戳（ISO 格式）', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childId = 'child-003';
      const beforeTime = new Date().toISOString();

      const result = persistence.saveState(childId, {
        refusalCount: 3,
        currentState: BORROW_STATES.TRIGGERED
      });

      const afterTime = new Date().toISOString();
      expect(result.timestamp >= beforeTime).toBe(true);
      expect(result.timestamp <= afterTime).toBe(true);

      // 文件内容中也应包含 lastUpdated 字段
      const fileContent = JSON.parse(fs.readFileSync(result.path, 'utf8'));
      expect(fileContent.lastUpdated).toBeDefined();
      expect(fileContent.lastUpdated).toBe(result.timestamp);
    });
  });

  describe('saveState + loadState 往返', () => {
    test('保存后读取能还原 refusalCount 与 currentState', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childId = 'child-roundtrip-001';

      persistence.saveState(childId, {
        refusalCount: 2,
        currentState: BORROW_STATES.COUNTING
      });

      const loaded = persistence.loadState(childId);
      expect(loaded).not.toBeNull();
      expect(loaded.refusalCount).toBe(2);
      expect(loaded.currentState).toBe(BORROW_STATES.COUNTING);
      expect(loaded.lastUpdated).toBeDefined();
    });

    test('保存 TRIGGERED 状态后读取仍为 TRIGGERED', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childId = 'child-roundtrip-002';

      persistence.saveState(childId, {
        refusalCount: 3,
        currentState: BORROW_STATES.TRIGGERED
      });

      const loaded = persistence.loadState(childId);
      expect(loaded.refusalCount).toBe(3);
      expect(loaded.currentState).toBe(BORROW_STATES.TRIGGERED);
    });

    test('保存 IN_PROGRESS 状态后读取仍为 IN_PROGRESS', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childId = 'child-roundtrip-003';

      persistence.saveState(childId, {
        refusalCount: 3,
        currentState: BORROW_STATES.IN_PROGRESS
      });

      const loaded = persistence.loadState(childId);
      expect(loaded.currentState).toBe(BORROW_STATES.IN_PROGRESS);
    });

    test('保存 COMPLETED 状态后读取仍为 COMPLETED', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childId = 'child-roundtrip-004';

      persistence.saveState(childId, {
        refusalCount: 3,
        currentState: BORROW_STATES.COMPLETED
      });

      const loaded = persistence.loadState(childId);
      expect(loaded.currentState).toBe(BORROW_STATES.COMPLETED);
    });

    test('处理 refusalCount=0 与 currentState=IDLE 默认值', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childId = 'child-default-001';

      persistence.saveState(childId, {
        refusalCount: 0,
        currentState: BORROW_STATES.IDLE
      });

      const loaded = persistence.loadState(childId);
      expect(loaded).not.toBeNull();
      expect(loaded.refusalCount).toBe(0);
      expect(loaded.currentState).toBe(BORROW_STATES.IDLE);
    });

    test('覆盖保存：再次保存会更新而非追加', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childId = 'child-overwrite-001';

      persistence.saveState(childId, {
        refusalCount: 1,
        currentState: BORROW_STATES.COUNTING
      });
      persistence.saveState(childId, {
        refusalCount: 3,
        currentState: BORROW_STATES.TRIGGERED
      });

      const loaded = persistence.loadState(childId);
      expect(loaded.refusalCount).toBe(3);
      expect(loaded.currentState).toBe(BORROW_STATES.TRIGGERED);
    });
  });

  describe('resetState() - 清除借分契约状态', () => {
    test('已保存状态下 reset 后 loadState 返回 null', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childId = 'child-reset-001';

      persistence.saveState(childId, {
        refusalCount: 3,
        currentState: BORROW_STATES.TRIGGERED
      });
      expect(persistence.loadState(childId)).not.toBeNull();

      const result = persistence.resetState(childId);
      expect(result.success).toBe(true);
      expect(result.path).toBe(path.join(tmpDir, `borrow_state_${childId}.json`));
      expect(persistence.loadState(childId)).toBeNull();
    });

    test('文件不存在时 reset 也返回 success:true', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childId = 'child-reset-no-file';

      const result = persistence.resetState(childId);
      expect(result.success).toBe(true);
      expect(result.path).toBe(path.join(tmpDir, `borrow_state_${childId}.json`));
    });

    test('reset 后文件被删除', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childId = 'child-reset-delete-001';

      const saveResult = persistence.saveState(childId, {
        refusalCount: 2,
        currentState: BORROW_STATES.COUNTING
      });
      expect(fs.existsSync(saveResult.path)).toBe(true);

      persistence.resetState(childId);
      expect(fs.existsSync(saveResult.path)).toBe(false);
    });
  });

  describe('按 childId 隔离', () => {
    test('不同 childId 的状态互不影响', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childA = 'child-iso-A';
      const childB = 'child-iso-B';

      persistence.saveState(childA, {
        refusalCount: 3,
        currentState: BORROW_STATES.TRIGGERED
      });
      persistence.saveState(childB, {
        refusalCount: 1,
        currentState: BORROW_STATES.COUNTING
      });

      const loadedA = persistence.loadState(childA);
      const loadedB = persistence.loadState(childB);
      expect(loadedA.refusalCount).toBe(3);
      expect(loadedA.currentState).toBe(BORROW_STATES.TRIGGERED);
      expect(loadedB.refusalCount).toBe(1);
      expect(loadedB.currentState).toBe(BORROW_STATES.COUNTING);
    });

    test('reset 一个 childId 不影响另一个', () => {
      const persistence = createBorrowContractPersistence({ storageDir: tmpDir });
      const childA = 'child-iso-reset-A';
      const childB = 'child-iso-reset-B';

      persistence.saveState(childA, {
        refusalCount: 3,
        currentState: BORROW_STATES.TRIGGERED
      });
      persistence.saveState(childB, {
        refusalCount: 2,
        currentState: BORROW_STATES.COUNTING
      });

      persistence.resetState(childA);
      expect(persistence.loadState(childA)).toBeNull();
      // childB 不受影响
      const loadedB = persistence.loadState(childB);
      expect(loadedB).not.toBeNull();
      expect(loadedB.refusalCount).toBe(2);
      expect(loadedB.currentState).toBe(BORROW_STATES.COUNTING);
    });
  });

  describe('默认 storageDir 选项', () => {
    test('未传 storageDir 时使用默认目录（不抛错，读取未知孩子返回 null）', () => {
      // 不传 options，走默认 storageDir 分支；仅做只读读取，不写入真实 data 目录
      const persistence = createBorrowContractPersistence();
      const result = persistence.loadState('child-default-dir-no-write');
      expect(result).toBeNull();
    });
  });

  describe('自定义 storageDir 选项', () => {
    test('通过 options.storageDir 指定自定义目录', () => {
      const customDir = path.join(tmpDir, 'custom-storage');
      const persistence = createBorrowContractPersistence({ storageDir: customDir });
      const childId = 'child-custom-001';

      const result = persistence.saveState(childId, {
        refusalCount: 2,
        currentState: BORROW_STATES.COUNTING
      });

      expect(result.path).toBe(path.join(customDir, `borrow_state_${childId}.json`));
      expect(fs.existsSync(result.path)).toBe(true);

      // 同一实例读取
      const loaded = persistence.loadState(childId);
      expect(loaded.refusalCount).toBe(2);
    });

    test('不同 storageDir 的实例读取各自目录', () => {
      const dirA = path.join(tmpDir, 'dirA');
      const dirB = path.join(tmpDir, 'dirB');
      const persistenceA = createBorrowContractPersistence({ storageDir: dirA });
      const persistenceB = createBorrowContractPersistence({ storageDir: dirB });
      const childId = 'child-multi-dir-001';

      persistenceA.saveState(childId, {
        refusalCount: 1,
        currentState: BORROW_STATES.COUNTING
      });
      persistenceB.saveState(childId, {
        refusalCount: 3,
        currentState: BORROW_STATES.TRIGGERED
      });

      // 同一 childId 在不同目录下互不影响
      expect(persistenceA.loadState(childId).refusalCount).toBe(1);
      expect(persistenceB.loadState(childId).refusalCount).toBe(3);
    });
  });
});
