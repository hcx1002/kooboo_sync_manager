import path from 'path';
import { Module } from '../types';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';

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

// 外部注入的配置（用于桌面应用）
let externalConfig: any = null;

/**
 * 设置外部配置（用于桌面应用从 AppData 加载配置）
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
 * 获取环境特定的元数据文件名
 */
export const getMetadataFileName = (): string => {
  return `__metadata.${currentEnvironment}.json`;
};

/**
 * 获取 AppData 配置目录
 */
const getAppDataConfigPath = (envName: string): string => {
  const userDataPath = process.env.APPDATA || 
    (process.platform === 'darwin' 
      ? path.join(os.homedir(), 'Library', 'Application Support') 
      : path.join(os.homedir(), '.config'));
  
  return path.join(userDataPath, 'kooboo-sync', 'environments', `${envName}.json`);
};

/**
 * 从 AppData 加载配置
 */
const loadFromAppData = (): boolean => {
  const configPath = getAppDataConfigPath(currentEnvironment);
  
  if (fs.existsSync(configPath)) {
    try {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      
      // 设置到 process.env，保持现有代码兼容
      process.env.API_BASE_URL = configData.API_BASE_URL;
      process.env.BASIC_AUTH_USER_NAME = configData.BASIC_AUTH_USER_NAME;
      process.env.BASIC_AUTH_PASSWORD = configData.BASIC_AUTH_PASSWORD;
      process.env.SITE_ID = configData.SITE_ID;
      process.env.SYNC_MODULES = configData.SYNC_MODULES;
      process.env.FOLDER_NAME = configData.FOLDER_NAME;
      
      if (!configLoaded) {
        console.log(`📋 从 AppData 加载配置: ${currentEnvironment}`);
      }
      return true;
    } catch (error) {
      console.error(`❌ 加载 AppData 配置失败: ${error}`);
      return false;
    }
  }
  
  return false;
};

/**
 * 加载指定环境的配置文件（.env 方式）
 */
const loadEnvConfig = () => {
  // 如果有外部注入的配置，直接使用
  if (externalConfig) {
    process.env.API_BASE_URL = externalConfig.API_BASE_URL;
    process.env.BASIC_AUTH_USER_NAME = externalConfig.BASIC_AUTH_USER_NAME;
    process.env.BASIC_AUTH_PASSWORD = externalConfig.BASIC_AUTH_PASSWORD;
    process.env.SITE_ID = externalConfig.SITE_ID;
    process.env.SYNC_MODULES = externalConfig.SYNC_MODULES;
    process.env.FOLDER_NAME = externalConfig.FOLDER_NAME;
    
    if (!configLoaded) {
      console.log(`📋 使用外部配置 (${currentEnvironment})`);
    }
    return;
  }
  
  // 优先从 AppData 加载（桌面应用场景）
  if (loadFromAppData()) {
    return;
  }
  
  // 回退到 .env 文件（CLI 场景）
  const envFile = `.env.${currentEnvironment}`;
  const envPath = path.join(process.cwd(), envFile);
  
  // 检查环境配置文件是否存在
  if (fs.existsSync(envPath)) {
    if (!configLoaded) {
      console.log(`📋 加载环境配置: ${envFile}`);
    }
    // 使用 override: true 来覆盖已存在的环境变量
    dotenv.config({ path: envPath, override: true });
  } else {
    // 如果指定环境配置不存在，尝试加载默认 .env
    const defaultEnvPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(defaultEnvPath)) {
      if (!configLoaded) {
        console.log(`⚠️  未找到 ${envFile}，使用默认 .env 配置`);
      }
      dotenv.config({ path: defaultEnvPath, override: true });
    } else {
      throw new Error(`环境配置文件不存在: ${envFile} 或 .env，也未找到 AppData 配置`);
    }
  }
};

export const useEnv = (): EnvConfig => {
  // 加载对应环境的配置
  loadEnvConfig();
  
  const {
    API_BASE_URL,
    BASIC_AUTH_USER_NAME,
    BASIC_AUTH_PASSWORD,
    SITE_ID,
    SYNC_MODULES,
    FOLDER_NAME
  } = process.env;

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
    Module.Page
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
