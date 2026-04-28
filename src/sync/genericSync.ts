import fs from 'fs';
import path from 'path';
import { SYNC_CONFIG } from '../config/syncConfig';
import {
  readMetadata,
  updateMetadataWithHash,
  calculateDiff,
  emptyGuid,
  assignLocalFileNames,
  getLocalFileName,
  getLocalFilePath
} from '../utils/syncUtils';
import * as api from '../api/code';
import * as layout from '../api/layout';
import * as page from '../api/page';
import * as script from '../api/script';
import * as style from '../api/style';
import * as view from '../api/view';
import { useEnv, getMetadataFileName } from '../utils/useEnv';
import { Module, Metadata } from '../types';

const API_MAP = {
  getEdit: {
    Api: (id: string) => api.getEdit('Api', id),
    Code: (id: string) => api.getEdit('CodeBlock', id),
    Layout: layout.getLayout,
    Page: page.getEdit,
    Script: script.getEdit,
    Style: style.getEdit,
    View: view.getEdit
  },
  getList: {
    Api: () => api.getListByType('Api'),
    Code: () => api.getListByType('CodeBlock'),
    Layout: layout.getList,
    Page: page.getList,
    Script: script.getList,
    Style: style.getList,
    View: view.getList
  },
  create: {
    Api: ({ name, body, url }: { name: string; body: string; url?: string }) =>
      api.post({
        id: emptyGuid,
        codeType: 'Api',
        name,
        body,
        url,
        version: 0,
        scriptType: 'Module',
        enableDiffChecker: false
      }),
    Code: ({ name, body }: { name: string; body: string }) =>
      api.post({
        id: emptyGuid,
        codeType: 'CodeBlock',
        name,
        body,
        url: '',
        version: 0,
        scriptType: 'Module',
        enableDiffChecker: false
      }),
    Layout: ({ name, body }: { name: string; body: string }) =>
      layout.post({
        id: emptyGuid,
        name,
        body,
        version: 0,
        enableDiffChecker: false
      }),
    Page: ({ name, body, path: urlPath }: { name: string; body: string; path?: string }) =>
      page.post({
        id: emptyGuid,
        name,
        body,
        urlPath,
        version: 0,
        enableDiffChecker: false
      } as any),
    Script: ({ name, body }: { name: string; body: string }) =>
      script.post({
        id: emptyGuid,
        name,
        body,
        extension: 'js',
        isEmbedded: false,
        ownerObjectId: undefined,
        enableDiffChecker: false
      }),
    Style: ({ name, body }: { name: string; body: string }) =>
      style.post({
        id: emptyGuid,
        name,
        body,
        extension: 'css',
        isEmbedded: false,
        ownerObjectId: undefined,
        enableDiffChecker: false
      }),
    View: ({ name, body }: { name: string; body: string }) =>
      view.post({
        id: emptyGuid,
        name,
        body,
        enableDiffChecker: false,
        version: 0
      } as any)
  },
  update: {
    Api: ({ id, name, body, url, version }: { id: string; name: string; body: string; url?: string; version?: number }) =>
      api.post({
        id,
        codeType: 'Api',
        name,
        body,
        url,
        version,
        scriptType: 'Module',
        enableDiffChecker: false
      }),
    Code: ({ id, name, body, version }: { id: string; name: string; body: string; version?: number }) =>
      api.post({
        id,
        codeType: 'CodeBlock',
        name,
        body,
        url: '',
        version,
        scriptType: 'Module',
        enableDiffChecker: false
      }),
    Layout: ({ id, name, body, version }: { id: string; name: string; body: string; version?: number }) =>
      layout.post({
        id,
        name,
        body,
        version,
        enableDiffChecker: false
      }),
    Page: ({ id, name, body, path: urlPath, version }: { id: string; name: string; body: string; path?: string; version?: number }) =>
      page.post({
        id,
        name,
        body,
        urlPath,
        version,
        enableDiffChecker: false
      } as any),
    Script: ({ id, name, body, version }: { id: string; name: string; body: string; version?: number }) =>
      script.post({
        id,
        name,
        body,
        version,
        extension: 'js',
        isEmbedded: false,
        ownerObjectId: undefined,
        enableDiffChecker: false
      }),
    Style: ({ id, name, body, version }: { id: string; name: string; body: string; version?: number }) =>
      style.post({
        id,
        name,
        body,
        version,
        extension: 'css',
        isEmbedded: false,
        ownerObjectId: undefined,
        enableDiffChecker: false
      }),
    View: ({ id, name, body, version }: { id: string; name: string; body: string; version?: number }) =>
      view.post({
        id,
        name,
        body,
        version,
        enableDiffChecker: false
      } as any)
  },
  deletes: {
    Api: api.deletes,
    Code: api.deletes,
    Layout: layout.deletes,
    Page: page.deletes,
    Script: script.deletes,
    Style: style.deletes,
    View: view.deletes
  }
};

function summarizeUnexpectedPayload(payload: unknown) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (Array.isArray(payload)) {
    const text = payload
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join(', ');

    if (text) {
      return text;
    }
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    for (const key of ['message', 'error', 'detail', 'title']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function isMetadataItem(item: unknown): item is Metadata {
  return Boolean(
    item &&
    typeof item === 'object' &&
    typeof (item as Metadata).id === 'string' &&
    typeof (item as Metadata).name === 'string'
  );
}

function assertMetadataList(moduleName: Module, payload: unknown): Metadata[] {
  if (!Array.isArray(payload)) {
    throw new Error(`${moduleName} 列表接口返回格式异常: ${summarizeUnexpectedPayload(payload)}`);
  }

  if (!payload.every(isMetadataItem)) {
    throw new Error(`${moduleName} 列表接口返回格式异常: ${summarizeUnexpectedPayload(payload)}`);
  }

  return payload;
}

function getEditBody(moduleName: Module, itemName: string, payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${moduleName}/${itemName} 内容接口返回格式异常: ${summarizeUnexpectedPayload(payload)}`);
  }

  const body = (payload as { body?: unknown }).body;
  if (body === undefined || body === null) {
    return '';
  }

  if (typeof body !== 'string') {
    throw new Error(`${moduleName}/${itemName} 内容字段格式异常`);
  }

  return body;
}

export async function pull(moduleName: Module, force = false) {
  const { KOOBOO_DIR } = useEnv();
  const config = SYNC_CONFIG[moduleName];
  const modulePath = path.join(KOOBOO_DIR, moduleName);

  if (!fs.existsSync(modulePath)) {
    fs.mkdirSync(modulePath);
  }

  const metadataPath = path.join(modulePath, getMetadataFileName());
  const localMetadata = assignLocalFileNames(
    readMetadata<Metadata>(metadataPath),
    config.fileExtension
  );
  const remoteData = assignLocalFileNames(
    assertMetadataList(moduleName, await API_MAP.getList[moduleName]()),
    config.fileExtension,
    localMetadata
  );

  const diff = calculateDiff(localMetadata, remoteData, {
    modulePath,
    fileExtension: config.fileExtension
  });

  if (diff.added.length > 0 || diff.removed.length > 0 || diff.updated.length > 0) {
    console.log(`${moduleName} 模块差异:`);
    if (diff.added.length > 0) console.log(`新增: ${diff.added.map(item => item.name).join(', ')}`);
    if (diff.removed.length > 0) console.log(`删除: ${diff.removed.map(item => item.name).join(', ')}`);
    if (diff.updated.length > 0) console.log(`更新: ${diff.updated.map(item => item.name).join(', ')}`);
    if (force && diff.unchanged.length > 0) console.log(`覆盖: ${diff.unchanged.map(item => item.name).join(', ')}`);
  } else {
    console.log(`${moduleName} 模块无变化`);
  }

  for (const item of diff.removed) {
    const localFileName = getLocalFileName(item, config.fileExtension);
    const filePath = getLocalFilePath(modulePath, item, config.fileExtension);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`删除本地文件: ${localFileName}`);
    } else {
      console.log(`跳过删除不存在的文件: ${localFileName}`);
    }
  }

  for (const item of diff.updated) {
    const code = await API_MAP.getEdit[moduleName](item.id);
    const content = getEditBody(moduleName, item.name, code);
    fs.writeFileSync(getLocalFilePath(modulePath, item, config.fileExtension), content);
  }

  for (const item of diff.added) {
    const code = await API_MAP.getEdit[moduleName](item.id);
    const content = getEditBody(moduleName, item.name, code);
    fs.writeFileSync(getLocalFilePath(modulePath, item, config.fileExtension), content);
  }

  if (force) {
    for (const item of diff.unchanged) {
      const code = await API_MAP.getEdit[moduleName](item.id);
      const content = getEditBody(moduleName, item.name, code);
      fs.writeFileSync(getLocalFilePath(modulePath, item, config.fileExtension), content);
    }
  }

  const localFiles = fs.readdirSync(modulePath)
    .filter(file => !file.startsWith('__metadata.') && !file.endsWith('.json') && (config.fileExtension ? file.endsWith(config.fileExtension) : true));
  const koobooFiles = new Set(remoteData.map(item => getLocalFileName(item, config.fileExtension)));

  for (const file of localFiles) {
    if (!koobooFiles.has(file)) {
      const filePath = path.join(modulePath, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`删除本地多余文件: ${file}`);
      } else {
        console.log(`跳过删除不存在的文件: ${file}`);
      }
    }
  }

  const updatedData = updateMetadataWithHash(remoteData, modulePath, config.fileExtension);
  fs.writeFileSync(metadataPath, JSON.stringify(updatedData, null, 2));

  console.log(`${moduleName} 模块拉取完成`);
}

export async function push(moduleName: Module, force = false) {
  const { KOOBOO_DIR } = useEnv();
  const config = SYNC_CONFIG[moduleName];
  const modulePath = path.join(KOOBOO_DIR, moduleName);
  const metadataPath = path.join(modulePath, getMetadataFileName());

  const localMetadata = assignLocalFileNames(
    readMetadata<Metadata>(metadataPath),
    config.fileExtension
  );
  const remoteData = assignLocalFileNames(
    assertMetadataList(moduleName, await API_MAP.getList[moduleName]()),
    config.fileExtension,
    localMetadata
  );

  const diff = calculateDiff(remoteData, localMetadata, {
    modulePath,
    fileExtension: config.fileExtension
  });

  if (diff.added.length > 0 || diff.removed.length > 0 || diff.updated.length > 0) {
    console.log(`${moduleName} 模块差异:`);
    if (diff.added.length > 0) console.log(`新增: ${diff.added.map(item => item.name).join(', ')}`);
    if (diff.removed.length > 0) console.log(`删除: ${diff.removed.map(item => item.name).join(', ')}`);
    if (diff.updated.length > 0) console.log(`更新: ${diff.updated.map(item => item.name).join(', ')}`);
    if (force && diff.unchanged.length > 0) console.log(`覆盖: ${diff.unchanged.map(item => item.name).join(', ')}`);
  } else {
    console.log(`${moduleName} 模块无变化`);
  }

  for (const item of diff.removed) {
    await API_MAP.deletes[moduleName]([item.id]);
    console.log(`删除远程文件 ${moduleName}/${item.name}${config.fileExtension}`);
  }

  for (const item of diff.updated) {
    const filePath = getLocalFilePath(modulePath, item, config.fileExtension);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      await API_MAP.update[moduleName]({
        ...item,
        body: content
      } as any);
      console.log(`更新远程文件 ${moduleName}/${item.name}${config.fileExtension}`);
    }
  }

  for (const item of diff.added) {
    const filePath = getLocalFilePath(modulePath, item, config.fileExtension);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      await API_MAP.create[moduleName]({
        name: item.name,
        body: content,
        url: item.url,
        path: item.path
      } as any);
      console.log(`新增文件 ${moduleName}/${item.name}${config.fileExtension} 到远程`);
    }
  }

  if (force) {
    for (const item of diff.unchanged) {
      const filePath = getLocalFilePath(modulePath, item, config.fileExtension);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        await API_MAP.update[moduleName]({
          ...item,
          body: content
        } as any);
        console.log(`覆盖远程文件 ${moduleName}/${item.name}${config.fileExtension}`);
      }
    }
  }

  const updatedRemoteData = assignLocalFileNames(
    assertMetadataList(moduleName, await API_MAP.getList[moduleName]()),
    config.fileExtension,
    localMetadata
  );
  const updatedMetadata = updateMetadataWithHash(updatedRemoteData, modulePath, config.fileExtension);
  fs.writeFileSync(metadataPath, JSON.stringify(updatedMetadata, null, 2));
  console.log(`${moduleName} 模块推送完成`);
}

export function checkLocalRoutes(): { valid: boolean; errors: string[] } {
  const { KOOBOO_DIR } = useEnv();
  const modules = [Module.Api, Module.Page];
  const metadataFileName = getMetadataFileName();

  for (const moduleName of modules) {
    const metadataPath = path.join(KOOBOO_DIR, moduleName, metadataFileName);
    if (!fs.existsSync(metadataPath)) {
      return { valid: false, errors: [`${moduleName} 模块的 ${metadataFileName} 文件不存在`] };
    }
  }

  const apiMetadata = readMetadata<Metadata>(path.join(KOOBOO_DIR, Module.Api, metadataFileName));
  const pageMetadata = readMetadata<Metadata>(path.join(KOOBOO_DIR, Module.Page, metadataFileName));
  const errors: string[] = [];
  const routeSet = new Set<string>();

  for (const item of apiMetadata) {
    const route = item.url;
    if (!route) {
      errors.push(`Api ${item.name} 缺少 url 字段`);
    } else if (routeSet.has(route)) {
      errors.push(`Api ${item.name} 的路由 "${route}" 与其他路由重复`);
    } else {
      routeSet.add(route);
    }
  }

  for (const item of pageMetadata) {
    const route = item.path;
    if (!route) {
      errors.push(`Page ${item.name} 缺少 path 字段`);
    } else if (routeSet.has(route)) {
      errors.push(`Page ${item.name} 的路由 "${route}" 与其他路由重复`);
    } else {
      routeSet.add(route);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function checkLocalCode(moduleName: Module): { valid: boolean; errors: string[] } {
  const { KOOBOO_DIR } = useEnv();
  const config = SYNC_CONFIG[moduleName];
  const modulePath = path.join(KOOBOO_DIR, moduleName);
  const metadataFileName = getMetadataFileName();
  const metadataPath = path.join(modulePath, metadataFileName);

  if (!fs.existsSync(metadataPath)) {
    return { valid: false, errors: [`${metadataFileName} 文件不存在`] };
  }

  const metadata = assignLocalFileNames(
    readMetadata<Metadata>(metadataPath),
    config.fileExtension
  );
  const errors: string[] = [];
  const nameSet = new Set<string>();
  const localFileNameSet = new Set<string>();

  for (const item of metadata) {
    if (nameSet.has(item.name)) {
      errors.push(`名称 ${item.name} 冲突`);
    } else {
      nameSet.add(item.name);
    }
  }

  for (const item of metadata) {
    const localFileName = getLocalFileName(item, config.fileExtension);
    const localFileNameKey = localFileName.toLowerCase();
    if (localFileNameSet.has(localFileNameKey)) {
      errors.push(`本地文件名 ${localFileName} 冲突`);
    } else {
      localFileNameSet.add(localFileNameKey);
    }

    const filePath = getLocalFilePath(modulePath, item, config.fileExtension);
    if (!fs.existsSync(filePath)) {
      errors.push(`文件 ${localFileName} 不存在`);
    }
  }

  const localFiles = fs.readdirSync(modulePath)
    .filter(file => !file.startsWith('__metadata.') && !file.endsWith('.json') && (config.fileExtension ? file.endsWith(config.fileExtension) : true));
  const metadataFiles = new Set(metadata.map(item => getLocalFileName(item, config.fileExtension)));

  for (const file of localFiles) {
    if (!metadataFiles.has(file)) {
      errors.push(`文件 ${file} 未记录在 ${metadataFileName} 中`);
    }
  }

  if (moduleName === Module.Api) {
    const routeSet = new Set<string>();
    for (const item of metadata) {
      if (!item.url) {
        errors.push(`Api ${item.name} 缺少 url 字段`);
      } else if (routeSet.has(item.url)) {
        errors.push(`Api ${item.name} 的路由 "${item.url}" 与其他路由重复`);
      } else {
        routeSet.add(item.url);
      }
    }
  }

  if (moduleName === Module.Page) {
    const routeSet = new Set<string>();
    for (const item of metadata) {
      if (!item.path) {
        errors.push(`Page ${item.name} 缺少 path 字段`);
      } else if (routeSet.has(item.path)) {
        errors.push(`Page ${item.name} 的路由 "${item.path}" 与其他路由重复`);
      } else {
        routeSet.add(item.path);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function fixLocalCode(moduleName: Module) {
  const { KOOBOO_DIR } = useEnv();
  const config = SYNC_CONFIG[moduleName];
  const modulePath = path.join(KOOBOO_DIR, moduleName);
  const metadataFileName = getMetadataFileName();
  const metadataPath = path.join(modulePath, metadataFileName);

  if (!fs.existsSync(modulePath)) {
    fs.mkdirSync(modulePath);
  }

  const localFiles = fs.readdirSync(modulePath)
    .filter(file => !file.startsWith('__metadata.') && !file.endsWith('.json') && (config.fileExtension ? file.endsWith(config.fileExtension) : true));

  let metadata: Metadata[] = [];
  if (fs.existsSync(metadataPath)) {
    metadata = assignLocalFileNames(
      readMetadata<Metadata>(metadataPath),
      config.fileExtension
    );
  }

  const metadataFiles = new Set(metadata.map(item => getLocalFileName(item, config.fileExtension)));

  metadata = metadata.filter(item => {
    const localFileName = getLocalFileName(item, config.fileExtension);
    const filePath = getLocalFilePath(modulePath, item, config.fileExtension);
    const exists = Boolean(item.name) && fs.existsSync(filePath);
    if (!exists) {
      console.log(`移除metadata记录: ${moduleName}/${localFileName}`);
    }
    return exists;
  });

  for (const file of localFiles) {
    if (!metadataFiles.has(file)) {
      const name = (config.fileExtension && file.endsWith(config.fileExtension))
        ? file.slice(0, -config.fileExtension.length)
        : file;

      const newItem: Metadata = {
        id: emptyGuid,
        name,
        version: 0,
        lastModified: new Date().toISOString()
      };

      if (moduleName === Module.Api) {
        newItem.url = `/${name}`;
      } else if (moduleName === Module.Page) {
        newItem.path = `/${name}`;
      }

      metadata.push(newItem);
      console.log(`新增文件 ${moduleName}/${file} 到 metadata`);
    }
  }

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}
