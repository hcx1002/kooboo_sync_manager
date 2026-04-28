import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Metadata } from '../types';

// 计算文件哈希值（仅基于文件内容）
export const calculateFileHash = (filePath: string): string => {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const hash = crypto.createHash('sha256');
  hash.update(fileContent);
  return hash.digest('hex');
};

// 读取元数据文件
export const readMetadata = <T>(metadataPath: string): T[] => {
  if (fs.existsSync(metadataPath)) {
    try {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    } catch (error) {
      console.warn(`读取元数据文件失败: ${metadataPath}`);
      console.warn(`错误详情: ${error instanceof Error ? error.message : String(error)}`);
      console.warn('将使用空数组作为初始数据');
    }
  }
  return [];
};

const invalidWindowsFileNameChars = /[<>:"/\\|?*\x00-\x1F]/g;
const invalidWindowsFileNameCharsTest = /[<>:"/\\|?*\x00-\x1F]/;
const reservedWindowsFileName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const encodeFileNameChar = (char: string) => {
  return Array.from(Buffer.from(char, 'utf-8'))
    .map(byte => {
      const hex = byte.toString(16).toUpperCase();
      return `%${hex.length === 1 ? `0${hex}` : hex}`;
    })
    .join('');
};

export const sanitizeLocalName = (name: string): string => {
  let safeName = name.replace(invalidWindowsFileNameChars, encodeFileNameChar);
  safeName = safeName.replace(/[. ]+$/g, chars => Array.from(chars).map(encodeFileNameChar).join(''));

  if (!safeName || safeName === '.' || safeName === '..') {
    safeName = '_';
  }

  if (reservedWindowsFileName.test(safeName)) {
    safeName = `%${safeName}`;
  }

  return safeName;
};

export const getLocalFileName = (item: Metadata, fileExtension = '') => {
  return item.localFileName || `${item.name}${fileExtension}`;
};

export const getLocalFilePath = (modulePath: string, item: Metadata, fileExtension = '') => {
  return path.join(modulePath, getLocalFileName(item, fileExtension));
};

const isSafeLocalFileName = (fileName: string) => {
  if (!fileName || fileName !== path.win32.basename(fileName)) {
    return false;
  }

  if (invalidWindowsFileNameCharsTest.test(fileName) || /[. ]$/.test(fileName)) {
    return false;
  }

  return !reservedWindowsFileName.test(path.win32.parse(fileName).name);
};

const buildLocalFileName = (name: string, fileExtension = '') => {
  return `${sanitizeLocalName(name)}${fileExtension}`;
};

const getCollisionToken = (item: Metadata) => {
  return crypto
    .createHash('sha1')
    .update(item.id || item.name)
    .digest('hex')
    .slice(0, 8);
};

const makeUniqueLocalFileName = (
  fileName: string,
  item: Metadata,
  usedFileNames: Set<string>,
  fileExtension = ''
) => {
  const baseName = fileExtension && fileName.endsWith(fileExtension)
    ? fileName.slice(0, -fileExtension.length)
    : fileName;
  const token = getCollisionToken(item);
  let index = 0;

  while (true) {
    const suffix = index === 0 ? token : `${token}-${index}`;
    const candidate = `${baseName}.${suffix}${fileExtension}`;

    if (!usedFileNames.has(candidate.toLowerCase())) {
      return candidate;
    }

    index += 1;
  }
};

export const assignLocalFileNames = (
  data: Metadata[],
  fileExtension = '',
  previousData: Metadata[] = []
) => {
  const previousById = new Map(previousData.map(item => [item.id, item]));
  const previousByName = new Map(previousData.map(item => [item.name, item]));
  const usedFileNames = new Set<string>();

  return data.map(item => {
    const defaultFileName = `${item.name}${fileExtension}`;
    const previousItemById = previousById.get(item.id);
    const previousItem = previousItemById?.name === item.name
      ? previousItemById
      : previousByName.get(item.name);
    const previousLocalFileName = previousItem?.localFileName;
    const preferredFileName = previousLocalFileName || item.localFileName;
    let localFileName = preferredFileName && isSafeLocalFileName(preferredFileName)
      ? preferredFileName
      : buildLocalFileName(item.name, fileExtension);

    if (usedFileNames.has(localFileName.toLowerCase())) {
      localFileName = makeUniqueLocalFileName(localFileName, item, usedFileNames, fileExtension);
    }

    usedFileNames.add(localFileName.toLowerCase());

    const normalizedItem = { ...item };
    if (localFileName !== defaultFileName || preferredFileName) {
      normalizedItem.localFileName = localFileName;
    } else {
      delete normalizedItem.localFileName;
    }

    return normalizedItem;
  });
};

// 更新元数据中的文件哈希值
export const updateMetadataWithHash = (data: Metadata[], modulePath: string, fileExtension = '') => {
  return data.map(item => {
    const filePath = getLocalFilePath(modulePath, item, fileExtension);
    if (fs.existsSync(filePath)) {
      return {
        ...item,
        fileHash: calculateFileHash(filePath)
      };
    }
    return item;
  });
};

// 计算文件差异
export const calculateDiff = (
  oldData: Metadata[], 
  newData: Metadata[],
  config?: { modulePath: string, fileExtension: string }
) => {
  const oldMap = new Map(oldData.map(item => [item.id, item]));
  const newMap = new Map(newData.map(item => [item.id, item]));

  // 处理name变化的情况，Kooboo中name是无法直接更新的
  const nameChanged = newData.filter(newItem => {
    const oldItem = oldMap.get(newItem.id);
    return oldItem && oldItem.name !== newItem.name;
  });

  const added = newData.filter(newItem => !oldMap.has(newItem.id));
  const removed = oldData.filter(oldItem => !newMap.has(oldItem.id));

  const updated = newData.filter(newItem => {
    const oldItem = oldMap.get(newItem.id);
    if (!oldItem || nameChanged.includes(newItem)) return false;

    // 检查基本属性是否变化
    const isModified = (
      oldItem.lastModified !== newItem.lastModified ||
      (newItem.url && oldItem.url !== newItem.url) ||
      (newItem.path && oldItem.path !== newItem.path)
    );

    if (isModified) return true;

    // 如果有config参数，则检查文件哈希
    if (config?.modulePath) {
      const oldFileHash = oldItem.fileHash || newItem.fileHash;
      const filePath = getLocalFilePath(config.modulePath, newItem, config.fileExtension || '');
      const fileHash = fs.existsSync(filePath) ? calculateFileHash(filePath) : '';
      return oldFileHash !== fileHash;
    }

    return false;
  });

  // unchanged = newData - added - updated - nameChanged
  const unchanged = newData.filter(newItem => 
    !added.includes(newItem) && 
    !updated.includes(newItem) && 
    !nameChanged.includes(newItem)
  );

  return {
    added: [...added, ...nameChanged],
    removed: [...removed, ...nameChanged.map(item => oldMap.get(item.id)!)],
    updated,
    unchanged
  };
};


// 生成随机GUID
export const generateRandomGuid = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const emptyGuid = '00000000-0000-0000-0000-000000000000';
