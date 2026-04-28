import path from 'path';
import { Module } from '../types';

interface EnvConfig {
  API_BASE_URL: string;
  BASIC_AUTH_USER_NAME: string;
  BASIC_AUTH_PASSWORD: string;
  SITE_ID: string;
  SYNC_MODULES: Module[];
  KOOBOO_DIR: string;
}

// 全局变量存储当前环境
let currentEnvironment: string = 'dev';

// 记录是否已经加载过配置，避免重复日志
let configLoaded = false;

// Electron 注入的配置
let externalConfig: any = null;

/**
 * 设置外部配置
 * @param config - 外部配置对象
 */
export const setExternalConfig = (config: any) => {
  externalConfig = config;
  configLoaded = false;
};

/**
 * 设置当前运行环境
 * @param env - 环境名称 (dev, acc, prod, 或自定义环境)
 */
export const setEnvironment = (env: string) => {
  currentEnvironment = env.toLowerCase();
  // 重置配置加载标志，以便显示新环境的信息
  configLoaded = false;
};

/**
 * 获取当前环境
 */
export const getEnvironment = (): string => {
  return currentEnvironment;
};

/**
 * 获取元数据文件名
 */
export const getMetadataFileName = (): string => {
  return '__metadata.json';
};

export const useEnv = (): EnvConfig => {
  if (!externalConfig) {
    throw new Error('Missing environment config. Electron must call setExternalConfig() before running sync tasks.');
  }

  const {
    API_BASE_URL,
    BASIC_AUTH_USER_NAME,
    BASIC_AUTH_PASSWORD,
    SITE_ID,
    SYNC_MODULES,
    FOLDER_NAME
  } = externalConfig;

  // 只在首次加载时显示环境信息
  if (!configLoaded) {
    console.log(`🌍 当前环境: ${currentEnvironment}`);
    
    // 如果 FOLDER_NAME 是绝对路径，直接使用；否则相对于当前目录
    const folderPath = FOLDER_NAME && path.isAbsolute(FOLDER_NAME) 
      ? FOLDER_NAME 
      : path.join(process.cwd(), FOLDER_NAME || 'Kooboo');
    
    console.log(`📁 目标文件夹: ${folderPath}`);
    console.log(`🔗 API地址: ${API_BASE_URL}`);
    console.log(`🆔 站点ID: ${SITE_ID}`);
    configLoaded = true;
  }

  if (!API_BASE_URL || !BASIC_AUTH_USER_NAME || !BASIC_AUTH_PASSWORD || !SITE_ID) {
    throw new Error('Missing required environment variables');
  }

  const defaultModules = Object.values(Module);
  const modules = SYNC_MODULES ? SYNC_MODULES.split(',') as Module[] : defaultModules;
  
  // modules同步顺序排序 script,style,code,api,view,layout,page
  const modulesSort = [
    Module.Script,
    Module.Style,
    Module.Code,
    Module.Api,
    Module.View,
    Module.Layout,
    Module.Page,
    Module.Label
  ]
  modules.sort((a, b) => modulesSort.indexOf(a) - modulesSort.indexOf(b));

  // 处理绝对路径和相对路径
  const koobooDir = FOLDER_NAME && path.isAbsolute(FOLDER_NAME)
    ? FOLDER_NAME
    : path.join(process.cwd(), FOLDER_NAME || 'Kooboo');

  return {
    API_BASE_URL,
    BASIC_AUTH_USER_NAME,
    BASIC_AUTH_PASSWORD,
    SITE_ID,
    SYNC_MODULES: modules,
    KOOBOO_DIR: koobooDir
  };
};
