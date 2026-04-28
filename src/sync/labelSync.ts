import fs from 'fs';
import path from 'path';
import * as labelApi from '../api/label';
import { useEnv } from '../utils/useEnv';

const LABEL_FILE_NAME = 'labels.json';

interface LabelValues {
  [culture: string]: string;
}

export interface LocalLabelItem {
  id?: string;
  name?: string;
  values: LabelValues;
  lastModified?: string;
  keyHash?: string;
}

function getLabelModulePath() {
  const { KOOBOO_DIR } = useEnv();
  return path.join(KOOBOO_DIR, 'Label');
}

function getLabelFilePath() {
  return path.join(getLabelModulePath(), LABEL_FILE_NAME);
}

function ensureLabelModule() {
  const modulePath = getLabelModulePath();
  if (!fs.existsSync(modulePath)) {
    fs.mkdirSync(modulePath, { recursive: true });
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(item => typeof item === 'string')
  );
}

function normalizeValues(values: Record<string, string>) {
  const entries = Object.entries(values)
    .filter(([key, value]) => key.trim() && typeof value === 'string')
    .sort(([a], [b]) => a.localeCompare(b));

  return Object.fromEntries(entries);
}

function normalizeRemoteItem(item: labelApi.LabelItem): LocalLabelItem {
  return {
    id: item.id,
    name: item.name,
    values: normalizeValues(item.values || {}),
    lastModified: item.lastModified,
    keyHash: item.keyHash
  };
}

function normalizeLocalItem(item: unknown, index: number): LocalLabelItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Label/${LABEL_FILE_NAME} 第 ${index + 1} 项格式无效`);
  }

  const record = item as Record<string, unknown>;
  if (!isStringRecord(record.values)) {
    throw new Error(`Label/${LABEL_FILE_NAME} 第 ${index + 1} 项缺少有效的 values 字段`);
  }

  const normalized: LocalLabelItem = {
    values: normalizeValues(record.values)
  };

  if (typeof record.id === 'string' && record.id.trim()) {
    normalized.id = record.id;
  }

  if (typeof record.name === 'string' && record.name.trim()) {
    normalized.name = record.name;
  } else if (typeof record.key === 'string' && record.key.trim()) {
    // Backward compatibility for early local drafts that used "key".
    normalized.name = record.key.trim();
  }

  if (typeof record.lastModified === 'string' && record.lastModified.trim()) {
    normalized.lastModified = record.lastModified;
  }

  if (typeof record.keyHash === 'string' && record.keyHash.trim()) {
    normalized.keyHash = record.keyHash;
  }

  return normalized;
}

function readLocalLabels(): LocalLabelItem[] {
  const filePath = getLabelFilePath();
  if (!fs.existsSync(filePath)) {
    return [];
  }

  let payload: unknown;
  try {
    payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    throw new Error(`读取 Label/${LABEL_FILE_NAME} 失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!Array.isArray(payload)) {
    throw new Error(`Label/${LABEL_FILE_NAME} 必须是数组`);
  }

  return payload.map((item, index) => normalizeLocalItem(item, index));
}

function writeLocalLabels(items: LocalLabelItem[]) {
  fs.writeFileSync(getLabelFilePath(), JSON.stringify(items, null, 2));
}

function labelDisplayName(item: LocalLabelItem) {
  return item.name || item.keyHash || item.id || '(unknown)';
}

function valuesEqual(left: LabelValues, right: LabelValues) {
  return JSON.stringify(normalizeValues(left)) === JSON.stringify(normalizeValues(right));
}

function getDiff(localItems: LocalLabelItem[], remoteItems: LocalLabelItem[]) {
  const remoteMap = new Map(remoteItems.filter(item => item.id).map(item => [item.id as string, item]));
  const localKnown = localItems.filter(item => item.id && remoteMap.has(item.id));
  const localKnownIds = new Set(localKnown.map(item => item.id as string));

  const renamed = localKnown.filter(item => {
    const remoteItem = remoteMap.get(item.id as string);
    return Boolean(remoteItem) && item.name !== remoteItem.name;
  });

  const added = localItems.filter(item =>
    !item.id ||
    !remoteMap.has(item.id) ||
    renamed.includes(item)
  );
  const removed = remoteItems.filter(item => {
    if (!item.id) {
      return false;
    }

    const localItem = localKnown.find(candidate => candidate.id === item.id);
    return !localKnownIds.has(item.id) || (localItem ? localItem.name !== item.name : false);
  });
  const updated = localKnown.filter(item => {
    const remoteItem = remoteMap.get(item.id as string);
    return Boolean(remoteItem) && (
      !renamed.includes(item) &&
      !valuesEqual(item.values, remoteItem.values)
    );
  });
  const unchanged = localKnown.filter(item => !updated.includes(item));

  return { added, removed, updated, unchanged };
}

function logDiff(moduleName: string, diff: ReturnType<typeof getDiff>) {
  if (diff.added.length > 0 || diff.removed.length > 0 || diff.updated.length > 0) {
    console.log(`${moduleName} 模块差异:`);
    if (diff.added.length > 0) console.log(`新增: ${diff.added.map(labelDisplayName).join(', ')}`);
    if (diff.removed.length > 0) console.log(`删除: ${diff.removed.map(labelDisplayName).join(', ')}`);
    if (diff.updated.length > 0) console.log(`更新: ${diff.updated.map(labelDisplayName).join(', ')}`);
  } else {
    console.log(`${moduleName} 模块无变化`);
  }
}

export async function pullLabels() {
  ensureLabelModule();
  const remoteItems = (await labelApi.getList()).map(normalizeRemoteItem);
  const localItems = readLocalLabels();
  const diff = getDiff(remoteItems, localItems);
  logDiff('Label', diff);
  writeLocalLabels(remoteItems);
  console.log('Label 模块拉取完成');
}

export async function pushLabels() {
  ensureLabelModule();
  const localItems = readLocalLabels();
  const remoteItems = (await labelApi.getList()).map(normalizeRemoteItem);
  const diff = getDiff(localItems, remoteItems);
  logDiff('Label', diff);

  const remoteMap = new Map(remoteItems.filter(item => item.id).map(item => [item.id as string, item]));
  const localKnownIds = new Set(
    localItems
      .filter(item => item.id && remoteMap.has(item.id))
      .map(item => item.id as string)
  );

  for (const item of remoteItems) {
    if (item.id && !localKnownIds.has(item.id)) {
      await labelApi.deletes([item.id]);
      console.log(`删除远程 Label: ${labelDisplayName(item)}`);
    }
  }

  for (const item of localItems) {
    if (!item.id || !remoteMap.has(item.id)) {
      if (!item.name) {
        throw new Error(`新增 Label 缺少 name`);
      }

      await labelApi.create({
        key: item.name,
        values: normalizeValues(item.values)
      });
      console.log(`新增远程 Label: ${item.name}`);
      continue;
    }

    const remoteItem = remoteMap.get(item.id);
    if (!remoteItem) {
      continue;
    }

    if (!valuesEqual(item.values, remoteItem.values)) {
      await labelApi.update({
        id: item.id,
        values: normalizeValues(item.values)
      });
      console.log(`更新远程 Label: ${labelDisplayName(item)}`);
    }
  }

  const updatedRemoteItems = (await labelApi.getList()).map(normalizeRemoteItem);
  writeLocalLabels(updatedRemoteItems);
  console.log('Label 模块推送完成');
}

export function checkLocalLabels(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const filePath = getLabelFilePath();

  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [`Label/${LABEL_FILE_NAME} 文件不存在`] };
  }

  let labels: LocalLabelItem[] = [];
  try {
    labels = readLocalLabels();
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }

  const idSet = new Set<string>();
  const nameSet = new Set<string>();

  labels.forEach((item, index) => {
    const labelName = labelDisplayName(item);

    if (!item.name) {
      errors.push(`Label 第 ${index + 1} 项缺少 name`);
    }

    if (item.id) {
      if (idSet.has(item.id)) {
        errors.push(`Label 第 ${index + 1} 项 ID 冲突: ${item.id}`);
      } else {
        idSet.add(item.id);
      }
    }

    if (item.name) {
      if (nameSet.has(item.name)) {
        errors.push(`Label name 冲突: ${item.name}`);
      } else {
        nameSet.add(item.name);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export function fixLocalLabels() {
  ensureLabelModule();
  const filePath = getLabelFilePath();

  if (!fs.existsSync(filePath)) {
    writeLocalLabels([]);
    console.log(`创建 Label/${LABEL_FILE_NAME}`);
    return;
  }

  const labels = readLocalLabels();
  writeLocalLabels(labels);
}
