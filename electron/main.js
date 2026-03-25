const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 获取应用配置目录
const APP_DATA_PATH = path.join(app.getPath('userData'), 'environments');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

// 确保配置目录存在
function ensureAppDataDir() {
  if (!fs.existsSync(APP_DATA_PATH)) {
    fs.mkdirSync(APP_DATA_PATH, { recursive: true });
  }
}

// 获取环境配置文件路径
function getEnvConfigPath(envName) {
  return path.join(APP_DATA_PATH, `${envName}.json`);
}

// 导入同步逻辑
const { pullTask } = require('../dist/pull');
const { pushTask } = require('../dist/push');
const { fixTask } = require('../dist/fix');
const { setEnvironment, setExternalConfig } = require('../dist/utils/useEnv');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // 无边框窗口
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

  // 开发模式：加载 Vite 服务器
  // 生产模式：加载打包后的静态文件
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools(); // 去掉自动打开开发者工具
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-electron/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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
    app.quit();
  }
});

// ==================== IPC 处理 ====================

// 窗口控制
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
  mainWindow?.close();
});

// 获取环境列表
ipcMain.handle('get-env-list', async () => {
  ensureAppDataDir();
  const files = fs.readdirSync(APP_DATA_PATH);
  const envs = files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
  
  // 返回所有已存在的环境配置，从配置文件中读取 label
  const result = envs.map(name => {
    try {
      const configPath = getEnvConfigPath(name);
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      
      return {
        name,
        label: config.LABEL || name.toUpperCase(), // 从配置中读取 label，如果没有则使用大写名称
        exists: true
      };
    } catch (error) {
      return {
        name,
        label: name.toUpperCase(),
        exists: true
      };
    }
  });
  
  return result;
});

// 读取环境配置
ipcMain.handle('read-env-config', async (event, envName) => {
  try {
    const configPath = getEnvConfigPath(envName);
    
    if (!fs.existsSync(configPath)) {
      // 返回默认配置
      return {
        success: true,
        data: {
          BASIC_AUTH_USER_NAME: '',
          BASIC_AUTH_PASSWORD: '',
          API_BASE_URL: '',
          SITE_ID: '',
          SYNC_MODULES: 'Page,View,Layout,Api,Code,Style,Script',
          FOLDER_NAME: 'Kooboo'
        }
      };
    }
    
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    
    return { success: true, data: config };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 保存环境配置
ipcMain.handle('save-env-config', async (event, envName, config) => {
  try {
    ensureAppDataDir();
    const configPath = getEnvConfigPath(envName);
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 删除环境配置
ipcMain.handle('delete-env-config', async (event, envName) => {
  try {
    const configPath = getEnvConfigPath(envName);
    
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 选择文件夹
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  
  return { success: false };
});

// 执行拉取操作
ipcMain.handle('execute-pull', async (event, env, force) => {
  try {
    // 从 AppData 读取配置
    const configPath = getEnvConfigPath(env);
    if (!fs.existsSync(configPath)) {
      return { success: false, error: `环境配置不存在: ${env}` };
    }
    
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    // 使用外部配置注入方式，而不是修改 process.env
    setEnvironment(env);
    setExternalConfig(config);
    
    // 创建日志流
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      const message = args.join(' ');
      logs.push({ type: 'info', message });
      mainWindow?.webContents.send('sync-log', { type: 'info', message });
      originalLog(...args);
    };
    
    console.error = (...args) => {
      const message = args.join(' ');
      logs.push({ type: 'error', message });
      mainWindow?.webContents.send('sync-log', { type: 'error', message });
      originalError(...args);
    };
    
    console.warn = (...args) => {
      const message = args.join(' ');
      logs.push({ type: 'warning', message });
      mainWindow?.webContents.send('sync-log', { type: 'warning', message });
      originalWarn(...args);
    };
    
    await pullTask(force);
    
    // 恢复console，清除外部配置
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    setExternalConfig(null);
    
    return { success: true, logs };
  } catch (error) {
    // 恢复console
    console.log = console.log.originalLog || console.log;
    console.error = console.error.originalError || console.error;
    console.warn = console.warn.originalWarn || console.warn;
    setExternalConfig(null);
    
    return { success: false, error: error.message };
  }
});

// 执行推送操作
ipcMain.handle('execute-push', async (event, env, force) => {
  try {
    // 从 AppData 读取配置
    const configPath = getEnvConfigPath(env);
    if (!fs.existsSync(configPath)) {
      return { success: false, error: `环境配置不存在: ${env}` };
    }
    
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    // 使用外部配置注入方式
    setEnvironment(env);
    setExternalConfig(config);
    
    // 创建日志流
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      const message = args.join(' ');
      logs.push({ type: 'info', message });
      mainWindow?.webContents.send('sync-log', { type: 'info', message });
      originalLog(...args);
    };
    
    console.error = (...args) => {
      const message = args.join(' ');
      logs.push({ type: 'error', message });
      mainWindow?.webContents.send('sync-log', { type: 'error', message });
      originalError(...args);
    };
    
    console.warn = (...args) => {
      const message = args.join(' ');
      logs.push({ type: 'warning', message });
      mainWindow?.webContents.send('sync-log', { type: 'warning', message });
      originalWarn(...args);
    };
    
    await pushTask(force);
    
    // 恢复console，清除外部配置
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    setExternalConfig(null);
    
    return { success: true, logs };
  } catch (error) {
    // 恢复console
    console.log = console.log.originalLog || console.log;
    console.error = console.error.originalError || console.error;
    console.warn = console.warn.originalWarn || console.warn;
    setExternalConfig(null);
    
    return { success: false, error: error.message };
  }
});

// 执行修复操作
ipcMain.handle('execute-fix', async (event, env) => {
  try {
    // 从 AppData 读取配置
    const configPath = getEnvConfigPath(env);
    if (!fs.existsSync(configPath)) {
      return { success: false, error: `环境配置不存在: ${env}` };
    }
    
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    // 使用外部配置注入方式
    setEnvironment(env);
    setExternalConfig(config);
    
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      const message = args.join(' ');
      logs.push({ type: 'info', message });
      mainWindow?.webContents.send('sync-log', { type: 'info', message });
      originalLog(...args);
    };
    
    console.error = (...args) => {
      const message = args.join(' ');
      logs.push({ type: 'error', message });
      mainWindow?.webContents.send('sync-log', { type: 'error', message });
      originalError(...args);
    };
    
    console.warn = (...args) => {
      const message = args.join(' ');
      logs.push({ type: 'warning', message });
      mainWindow?.webContents.send('sync-log', { type: 'warning', message });
      originalWarn(...args);
    };
    
    await fixTask();
    
    // 恢复console，清除外部配置
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    setExternalConfig(null);
    
    return { success: true, logs };
  } catch (error) {
    // 恢复console
    console.log = console.log.originalLog || console.log;
    console.error = console.error.originalError || console.error;
    console.warn = console.warn.originalWarn || console.warn;
    setExternalConfig(null);
    
    return { success: false, error: error.message };
  }
});
