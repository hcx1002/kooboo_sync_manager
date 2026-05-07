const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // 环境配置相关
  readEnvConfig: (env) => ipcRenderer.invoke('read-env-config', env),
  setActiveEnv: (env) => ipcRenderer.invoke('set-active-env', env),
  saveEnvConfig: (env, config) => ipcRenderer.invoke('save-env-config', env, config),
  deleteEnvConfig: (env) => ipcRenderer.invoke('delete-env-config', env),
  cloneEnvConfig: (env) => ipcRenderer.invoke('clone-env-config', env),
  saveEnvOrder: (envs) => ipcRenderer.invoke('save-env-order', envs),
  setAutoUpload: (env, enabled) => ipcRenderer.invoke('set-auto-upload', env, enabled),
  getEnvList: () => ipcRenderer.invoke('get-env-list'),
  
  // 同步操作相关
  executePull: (env, force) => ipcRenderer.invoke('execute-pull', env, force),
  executePush: (env, force) => ipcRenderer.invoke('execute-push', env, force),
  executeFix: (env) => ipcRenderer.invoke('execute-fix', env),
  executeSitePull: (env) => ipcRenderer.invoke('execute-site-pull', env),
  executeSitePush: (env) => ipcRenderer.invoke('execute-site-push', env),
  initDevConfig: (env) => ipcRenderer.invoke('init-dev-config', env),
  
  // 文件选择
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // 监听同步日志
  onSyncLog: (callback) => {
    ipcRenderer.on('sync-log', (event, log) => callback(log));
  },
  
  // 移除监听
  removeSyncLogListener: () => {
    ipcRenderer.removeAllListeners('sync-log');
  }
});
