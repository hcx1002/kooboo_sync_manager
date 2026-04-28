const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

const APP_DATA_PATH = path.join(app.getPath('userData'), 'environments');
const ENV_ORDER_PATH = path.join(app.getPath('userData'), 'environment-order.json');
const DEFAULT_SYNC_MODULES = 'Page,View,Layout,Api,Code,Style,Script,Label';
const AUTO_PUSH_DEBOUNCE_MS = 1200;
const DEV_CONFIG_TEMPLATE_DIR = path.join(__dirname, 'templates', 'dev-config');
const DEV_CONFIG_FILES = [
  'AGENTS.md',
  'kooboo.project.d.ts',
  'uno.config.ts',
  'tsconfig.json',
  'types.kooboo.d.ts'
];

const { pullTask } = require('../dist/pull');
const { pushTask, pushModuleTask } = require('../dist/push');
const { fixTask } = require('../dist/fix');
const { sitePullTask } = require('../dist/site-pull');
const { sitePushTask } = require('../dist/site-push');
const { setEnvironment, setExternalConfig } = require('../dist/utils/useEnv');
const { Module } = require('../dist/types');

let mainWindow;
let activeEnvName = null;
let activeEnvConfig = null;
let siteWatcher = null;
let watcherPaused = 0;
let autoPushTimer = null;
let pendingTargets = new Map();
let taskQueue = Promise.resolve();
let quitPromise = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.exit(0);
}

function ensureAppDataDir() {
  const appDataRoot = path.dirname(APP_DATA_PATH);
  if (!fs.existsSync(appDataRoot)) {
    fs.mkdirSync(appDataRoot, { recursive: true });
  }

  if (!fs.existsSync(APP_DATA_PATH)) {
    fs.mkdirSync(APP_DATA_PATH, { recursive: true });
  }
}

function getEnvConfigPath(envName) {
  return path.join(APP_DATA_PATH, `${envName}.json`);
}

function getEnvironmentNames() {
  ensureAppDataDir();
  return fs.readdirSync(APP_DATA_PATH)
    .filter(fileName => fileName.endsWith('.json'))
    .map(fileName => fileName.replace('.json', ''));
}

function readEnvironmentOrder() {
  if (!fs.existsSync(ENV_ORDER_PATH)) {
    return [];
  }

  try {
    const order = JSON.parse(fs.readFileSync(ENV_ORDER_PATH, 'utf-8'));
    return Array.isArray(order) ? order.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeEnvironmentOrder(envNames) {
  ensureAppDataDir();
  fs.writeFileSync(ENV_ORDER_PATH, JSON.stringify(envNames, null, 2), 'utf-8');
}

function getOrderedEnvironmentNames() {
  const names = getEnvironmentNames();
  const existingNames = new Set(names);
  const orderedNames = [];

  for (const envName of readEnvironmentOrder()) {
    if (existingNames.has(envName) && !orderedNames.includes(envName)) {
      orderedNames.push(envName);
    }
  }

  const remainingNames = names
    .filter(envName => !orderedNames.includes(envName))
    .sort((left, right) => left.localeCompare(right));

  return [...orderedNames, ...remainingNames];
}

function saveEnvironmentOrder(envNames) {
  const existingNames = new Set(getEnvironmentNames());
  const orderedNames = [];

  for (const envName of envNames) {
    if (typeof envName === 'string' && existingNames.has(envName) && !orderedNames.includes(envName)) {
      orderedNames.push(envName);
    }
  }

  for (const envName of getOrderedEnvironmentNames()) {
    if (!orderedNames.includes(envName)) {
      orderedNames.push(envName);
    }
  }

  writeEnvironmentOrder(orderedNames);
  return orderedNames;
}

function getTargetFolderDisplay(config) {
  const folderName = config.FOLDER_NAME || 'Kooboo';
  const trimmedFolderName = folderName.replace(/[\\/]+$/g, '');
  const displayName = path.basename(trimmedFolderName) || trimmedFolderName || 'Kooboo';

  return {
    targetFolderName: displayName,
    targetFolderPath: resolveKoobooDir(config)
  };
}

function getUniqueCopyName(baseName, existingNames) {
  const copyBaseName = `${baseName}Copy-${Date.now().toString(36)}`;
  let copyName = copyBaseName;
  let index = 2;

  while (existingNames.has(copyName)) {
    copyName = `${copyBaseName}${index}`;
    index += 1;
  }

  return copyName;
}

function cloneEnvironment(envName) {
  const sourceConfig = readEnvConfigFile(envName);

  if (!sourceConfig) {
    throw new Error(`环境配置不存在: ${envName}`);
  }

  const existingNames = new Set(getEnvironmentNames());
  const newEnvName = getUniqueCopyName(envName, existingNames);
  const sourceLabel = sourceConfig.LABEL || envName.toUpperCase();
  const newConfig = normalizeEnvConfig({
    ...sourceConfig,
    LABEL: `${sourceLabel} Copy`
  });

  fs.writeFileSync(getEnvConfigPath(newEnvName), JSON.stringify(newConfig, null, 2), 'utf-8');

  const currentOrder = getOrderedEnvironmentNames().filter(name => name !== newEnvName);
  const sourceIndex = currentOrder.indexOf(envName);
  const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : currentOrder.length;
  currentOrder.splice(insertIndex, 0, newEnvName);
  writeEnvironmentOrder(currentOrder);

  return {
    name: newEnvName,
    label: newConfig.LABEL,
    ...getTargetFolderDisplay(newConfig)
  };
}

function sendSyncLog(type, message) {
  mainWindow?.webContents.send('sync-log', { type, message });
}

function normalizeEnvConfig(config = {}) {
  const apiBaseUrl = typeof config.API_BASE_URL === 'string'
    ? config.API_BASE_URL.trim().replace(/\/+$/g, '')
    : '';

  return {
    BASIC_AUTH_USER_NAME: '',
    BASIC_AUTH_PASSWORD: '',
    API_BASE_URL: apiBaseUrl,
    SITE_ID: '',
    SYNC_MODULES: DEFAULT_SYNC_MODULES,
    FOLDER_NAME: 'Kooboo',
    AUTO_UPLOAD: false,
    ...config,
    API_BASE_URL: apiBaseUrl,
    SYNC_MODULES: config.SYNC_MODULES || DEFAULT_SYNC_MODULES,
    AUTO_UPLOAD: Boolean(config.AUTO_UPLOAD)
  };
}

function readEnvConfigFile(envName, options = {}) {
  const { allowMissing = false } = options;
  const configPath = getEnvConfigPath(envName);

  if (!fs.existsSync(configPath)) {
    return allowMissing ? normalizeEnvConfig() : null;
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  return normalizeEnvConfig(JSON.parse(content));
}

function resolveKoobooDir(config) {
  return config.FOLDER_NAME && path.isAbsolute(config.FOLDER_NAME)
    ? config.FOLDER_NAME
    : path.join(process.cwd(), config.FOLDER_NAME || 'Kooboo');
}

function initializeDevConfig(envName) {
  const config = readEnvConfigFile(envName);

  if (!config) {
    throw new Error(`环境配置不存在: ${envName}`);
  }

  const targetDir = resolveKoobooDir(config);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const created = [];
  const skipped = [];

  for (const fileName of DEV_CONFIG_FILES) {
    const sourcePath = path.join(DEV_CONFIG_TEMPLATE_DIR, fileName);
    const targetPath = path.join(targetDir, fileName);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`开发配置模板不存在: ${fileName}`);
    }

    if (fs.existsSync(targetPath)) {
      skipped.push(fileName);
      continue;
    }

    fs.writeFileSync(targetPath, fs.readFileSync(sourcePath));
    created.push(fileName);
  }

  return { success: true, targetDir, created, skipped };
}

function getEnabledModules(config) {
  return (config.SYNC_MODULES || DEFAULT_SYNC_MODULES)
    .split(',')
    .map(moduleName => moduleName.trim())
    .filter(Boolean);
}

function clearPendingAutoPush() {
  if (autoPushTimer) {
    clearTimeout(autoPushTimer);
    autoPushTimer = null;
  }
  pendingTargets = new Map();
}

async function stopWatcher(options = {}) {
  const { silent = false } = options;

  clearPendingAutoPush();

  if (siteWatcher) {
    const watcherToClose = siteWatcher;
    siteWatcher = null;
    await watcherToClose.close();
    if (!silent) {
      sendSyncLog('info', '自动上传已停止');
    }
  }
}

function quitApplication() {
  if (quitPromise) {
    return quitPromise;
  }

  quitPromise = (async () => {
    await stopWatcher({ silent: true });

    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.destroy();
      }
    }

    app.quit();
  })().catch(error => {
    console.error('退出应用失败:', error);
    app.exit(1);
  });

  return quitPromise;
}

function shouldIgnoreRelativePath(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  const baseName = path.posix.basename(normalized);

  if (!normalized || normalized === '.' || normalized.startsWith('../')) {
    return true;
  }

  if (
    baseName === '__metadata.json' ||
    baseName.startsWith('__metadata.') ||
    normalized.includes('/__metadata.json') ||
    normalized.includes('/__metadata.') ||
    normalized.startsWith('.git/') ||
    normalized.startsWith('node_modules/')
  ) {
    return true;
  }

  if (
    baseName === 'Thumbs.db' ||
    baseName === '.DS_Store' ||
    baseName.endsWith('~') ||
    baseName.endsWith('.tmp') ||
    baseName.endsWith('.temp') ||
    baseName.endsWith('.swp') ||
    baseName.endsWith('.swo') ||
    baseName.startsWith('~$')
  ) {
    return true;
  }

  return false;
}

function mapPathToTarget(relativePath, config) {
  if (shouldIgnoreRelativePath(relativePath)) {
    return null;
  }

  const normalized = relativePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const topLevel = parts[0];
  const rest = parts.slice(1).join('/');
  const enabledModules = getEnabledModules(config);

  if (topLevel === 'Site' && rest === 'config.json') {
    return 'SITE';
  }

  if (topLevel === Module.Label && rest === 'labels.json') {
    return enabledModules.includes(Module.Label) ? Module.Label : null;
  }

  if (Object.values(Module).includes(topLevel) && topLevel !== Module.Label) {
    if (!enabledModules.includes(topLevel) || !rest) {
      return null;
    }
    return topLevel;
  }

  return null;
}

function enqueueTask(task) {
  const run = taskQueue.then(task, task);
  taskQueue = run.catch(() => undefined);
  return run;
}

async function runTaskWithEnv(envName, task, options = {}) {
  const { pauseWatcher: shouldPauseWatcher = true } = options;
  const config = readEnvConfigFile(envName);

  if (!config) {
    throw new Error(`环境配置不存在: ${envName}`);
  }

  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  const capture = (type, originalFn) => (...args) => {
    const message = args.join(' ');
    logs.push({ type, message });
    sendSyncLog(type, message);
    originalFn(...args);
  };

  console.log = capture('info', originalLog);
  console.error = capture('error', originalError);
  console.warn = capture('warning', originalWarn);

  if (shouldPauseWatcher) {
    watcherPaused++;
  }

  try {
    setEnvironment(envName);
    setExternalConfig(config);
    await task(config);
    return { success: true, logs };
  } finally {
    setExternalConfig(null);
    if (shouldPauseWatcher) {
      watcherPaused = Math.max(0, watcherPaused - 1);
    }
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  }
}

async function startWatcherForActiveEnv() {
  if (!activeEnvName || !activeEnvConfig?.AUTO_UPLOAD) {
    return;
  }

  const rootPath = resolveKoobooDir(activeEnvConfig);
  if (!fs.existsSync(rootPath)) {
    sendSyncLog('warning', `自动上传未启动，目录不存在: ${rootPath}`);
    return;
  }

  siteWatcher = chokidar.watch(rootPath, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 600,
      pollInterval: 100
    }
  });

  siteWatcher.on('all', (eventName, filePath) => {
    if (watcherPaused > 0 || !activeEnvConfig?.AUTO_UPLOAD) {
      return;
    }

    const relativePath = path.relative(rootPath, filePath);
    const target = mapPathToTarget(relativePath, activeEnvConfig);

    if (!target) {
      return;
    }

    const normalizedPath = relativePath.replace(/\\/g, '/');
    if (!pendingTargets.has(target)) {
      pendingTargets.set(target, new Set());
    }
    pendingTargets.get(target).add(normalizedPath);

    if (autoPushTimer) {
      clearTimeout(autoPushTimer);
    }

    autoPushTimer = setTimeout(() => {
      autoPushTimer = null;
      const targets = pendingTargets;
      pendingTargets = new Map();

      enqueueTask(async () => {
        if (!activeEnvName || !activeEnvConfig?.AUTO_UPLOAD) {
          return;
        }

        for (const [targetKey, changedPaths] of targets.entries()) {
          const changedList = Array.from(changedPaths).join(', ');
          sendSyncLog('info', `检测到文件变更: ${changedList}`);

          if (targetKey === 'SITE') {
            sendSyncLog('info', '自动推送站点配置...');
            try {
              await runTaskWithEnv(activeEnvName, async () => {
                await sitePushTask();
              });
            } catch (error) {
              sendSyncLog('error', `自动推送站点配置失败: ${error.message}`);
            }
            continue;
          }

          sendSyncLog('info', `自动推送模块: ${targetKey}`);
          try {
            await runTaskWithEnv(activeEnvName, async () => {
              await pushModuleTask(targetKey, false);
            });
          } catch (error) {
            sendSyncLog('error', `自动推送模块 ${targetKey} 失败: ${error.message}`);
          }
        }
      });
    }, AUTO_PUSH_DEBOUNCE_MS);
  });

  siteWatcher.on('error', error => {
    sendSyncLog('error', `自动上传监听错误: ${error.message}`);
  });

  sendSyncLog('info', `自动上传已开启，监听目录: ${rootPath}`);
}

async function refreshWatcher() {
  await stopWatcher({ silent: true });

  if (!activeEnvName) {
    return;
  }

  if (!activeEnvConfig?.AUTO_UPLOAD) {
    return;
  }

  await startWatcherForActiveEnv();
}

async function setActiveEnvironment(envName) {
  activeEnvName = envName || null;
  activeEnvConfig = activeEnvName ? readEnvConfigFile(activeEnvName, { allowMissing: true }) : null;
  await refreshWatcher();
  return { success: true };
}

function buildTaskHandler(task, options = {}) {
  return async (_event, envName, ...args) => {
    try {
      return await enqueueTask(() => runTaskWithEnv(envName, () => task(...args), options));
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'sync.ico'),
    title: 'Kooboo Sync Manager',
    backgroundColor: '#f5f5f5'
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-electron/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (gotSingleInstanceLock) {
  app.on('second-instance', () => {
    if (!mainWindow) {
      if (app.isReady()) {
        createWindow();
      }
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    ensureAppDataDir();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      quitApplication();
    }
  });
}

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow?.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', () => {
  return quitApplication();
});

ipcMain.handle('get-env-list', async () => {
  ensureAppDataDir();
  const envs = getOrderedEnvironmentNames();

  return envs.map(name => {
    try {
      const config = readEnvConfigFile(name, { allowMissing: true });
      return {
        name,
        label: config.LABEL || name.toUpperCase(),
        exists: true,
        ...getTargetFolderDisplay(config)
      };
    } catch {
      return {
        name,
        label: name.toUpperCase(),
        exists: true,
        targetFolderName: 'Kooboo',
        targetFolderPath: resolveKoobooDir(normalizeEnvConfig())
      };
    }
  });
});

ipcMain.handle('read-env-config', async (_event, envName) => {
  try {
    return {
      success: true,
      data: readEnvConfigFile(envName, { allowMissing: true })
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-active-env', async (_event, envName) => {
  try {
    return await setActiveEnvironment(envName);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-env-config', async (_event, envName, config) => {
  try {
    ensureAppDataDir();
    const configPath = getEnvConfigPath(envName);
    const normalizedConfig = normalizeEnvConfig(config);

    fs.writeFileSync(configPath, JSON.stringify(normalizedConfig, null, 2), 'utf-8');
    saveEnvironmentOrder(getOrderedEnvironmentNames());

    if (envName === activeEnvName) {
      activeEnvConfig = normalizedConfig;
      await refreshWatcher();
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-env-config', async (_event, envName) => {
  try {
    const configPath = getEnvConfigPath(envName);

    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }

    if (envName === activeEnvName) {
      activeEnvName = null;
      activeEnvConfig = null;
      await stopWatcher({ silent: true });
    }

    saveEnvironmentOrder(getOrderedEnvironmentNames().filter(name => name !== envName));

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clone-env-config', async (_event, envName) => {
  try {
    return {
      success: true,
      data: cloneEnvironment(envName)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-env-order', async (_event, envNames) => {
  try {
    return {
      success: true,
      order: saveEnvironmentOrder(Array.isArray(envNames) ? envNames : [])
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }

  return { success: false };
});

ipcMain.handle('init-dev-config', async (_event, envName) => {
  try {
    return await enqueueTask(() => Promise.resolve(initializeDevConfig(envName)));
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('execute-pull', buildTaskHandler(force => pullTask(force)));
ipcMain.handle('execute-push', buildTaskHandler(force => pushTask(force)));
ipcMain.handle('execute-fix', buildTaskHandler(() => fixTask()));
ipcMain.handle('execute-site-pull', buildTaskHandler(() => sitePullTask()));
ipcMain.handle('execute-site-push', buildTaskHandler(() => sitePushTask()));
