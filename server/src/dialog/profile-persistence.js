/**
 * 画像落库 - 将第一次见面的完整画像数据写入文件存储，并验证数据完整性
 *
 * 参考PRD §4.1 步骤3 画像数据结构
 * 参考Issue #5：新增 partner_acceptance 字段（同伴接受度）
 *
 * 必要字段（4个，至少3个非null才算MVP通过）：
 *   1. nickname
 *   2. age
 *   3. interests
 *   4. self_claimed_skills
 */

const fs = require('fs');
const path = require('path');

// 画像必要字段定义
const REQUIRED_FIELDS = ['nickname', 'age', 'interests', 'self_claimed_skills'];

// childId 合法格式：UUID 或字母数字+连字符，禁止路径分隔符（防路径遍历）
const CHILD_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * 校验 childId 格式，防止路径遍历攻击
 * @param {string} childId
 * @throws {Error} 格式非法时抛错
 */
function validateChildId(childId) {
  if (!childId || typeof childId !== 'string' || !CHILD_ID_PATTERN.test(childId)) {
    throw new Error('非法的 childId 格式');
  }
}

/**
 * 验证画像完整性
 * @param {object} profile - 画像数据
 * @returns {{ isValid: boolean, completedFields: number, missingFields: string[], meetsMvpStandard: boolean }}
 */
function validateProfile(profile) {
  const missingFields = [];
  let completedFields = 0;

  for (const field of REQUIRED_FIELDS) {
    if (profile[field] === null || profile[field] === undefined) {
      missingFields.push(field);
    } else {
      completedFields++;
    }
  }

  return {
    isValid: completedFields >= 3,
    completedFields,
    missingFields,
    meetsMvpStandard: completedFields >= 3
  };
}

/**
 * 保存画像到文件
 * @param {object} profile - 画像数据
 * @param {string} childId - 孩子ID
 * @param {object} [options] - 选项
 * @param {string} [options.storageDir] - 存储目录，默认为 '../../data'
 * @returns {{ success: boolean, path: string, profile: object, validation: object, timestamp: string }}
 */
function saveProfile(profile, childId, options = {}) {
  validateChildId(childId);
  const storageDir = options.storageDir || path.join(__dirname, '..', '..', 'data');
  const filePath = path.join(storageDir, `profile_${childId}.json`);

  // 保存前自动验证
  const validation = validateProfile(profile);

  // 如果目录不存在，自动创建
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  // 添加 saved_at 时间戳字段
  const timestamp = new Date().toISOString();
  const profileToSave = { ...profile, saved_at: timestamp };

  // 写入文件（JSON 格式化输出）
  fs.writeFileSync(filePath, JSON.stringify(profileToSave, null, 2), 'utf8');

  return {
    success: true,
    path: filePath,
    profile: profileToSave,
    validation,
    timestamp
  };
}

/**
 * 读取画像
 * @param {string} childId - 孩子ID
 * @param {object} [options] - 选项
 * @param {string} [options.storageDir] - 存储目录，默认为 '../../data'
 * @returns {{ success: boolean, profile: object|null, path: string }}
 */
function loadProfile(childId, options = {}) {
  validateChildId(childId);
  const storageDir = options.storageDir || path.join(__dirname, '..', '..', 'data');
  const filePath = path.join(storageDir, `profile_${childId}.json`);

  // 文件不存在时返回失败
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      profile: null,
      path: filePath
    };
  }

  // 读取并解析 JSON
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const profile = JSON.parse(fileContent);

  return {
    success: true,
    profile,
    path: filePath
  };
}

module.exports = { validateProfile, saveProfile, loadProfile, validateChildId };
