<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- 自定义标题栏（可拖拽） -->
    <div
      class="title-bar bg-[#1287ff] text-white shadow-lg flex items-center justify-between">
      <div class="flex items-center gap-3 pl-4">
        <el-icon :size="28">
          <RefreshRight />
        </el-icon>
        <div>
          <h1 class="text-xl font-bold">Kooboo Sync Manager</h1>
          <p class="text-xs opacity-90">
            可视化同步管理工具
            <span v-if="appVersion"> v{{ appVersion }}</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- <el-tag effect="dark" size="default">{{ currentEnvLabel }}</el-tag> -->

        <!-- 窗口控制按钮 -->
        <div class="flex items-center window-controls">
          <button @click="minimizeWindow" class="window-btn hover:bg-white/20 transition-colors">
            <el-icon :size="16">
              <Minus />
            </el-icon>
          </button>
          <button @click="maximizeWindow" class="window-btn hover:bg-white/20 transition-colors">
            <el-icon :size="14">
              <CopyDocument />
            </el-icon>
          </button>
          <button @click="closeWindow" class="window-btn hover:bg-red-500 transition-colors">
            <el-icon :size="16">
              <Close />
            </el-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <el-container class="flex-1 overflow-hidden">
      <!-- 左侧环境列表 -->
      <el-aside width="280px" class="bg-white border-r overflow-y-auto p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-800">环境列表</h3>
          <el-button type="primary" :icon="Plus" size="small" circle @click="openAddEnvDialog" />
        </div>

        <div class="space-y-2">
          <!-- 空状态 - 没有环境时显示 -->
          <div v-if="environments.length === 0" class="text-center py-12">
            <el-icon :size="64" class="text-gray-300 mb-4">
              <Box />
            </el-icon>
            <p class="text-gray-400 mb-4">还没有任何环境配置</p>
            <el-button type="primary" :icon="Plus" @click="openAddEnvDialog">
              创建第一个环境
            </el-button>
          </div>

          <!-- 环境列表 -->
          <div v-else v-for="env in environments" :key="env.name" :class="[
            'group p-3 rounded-lg transition-all',
            currentEnv === env.name
              ? 'bg-blue-50 border-2 border-blue-500 shadow-sm'
              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
          ]" @click="switchEnvironment(env.name)">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                <el-icon :size="24" :class="currentEnv === env.name ? 'text-blue-600' : 'text-gray-500'">
                  <component :is="getEnvIcon(env.name)" />
                </el-icon>
                <div class="flex-1 min-w-0">
                  <div :class="['font-medium truncate', currentEnv === env.name ? 'text-blue-600' : 'text-gray-700']">
                    {{ env.label }}
                  </div>
                  <div class="text-xs text-gray-400 truncate">{{ env.name }}</div>
                  <!-- 同步模块 -->
                  <!-- <div>
                    <el-tag
                      v-for="module in env.exists ? (await window.electronAPI.readEnvConfig(env.name)).data.SYNC_MODULES.split(',') : []"
                      :key="module" size="mini" class="mr-1 mb-1">
                      {{ module }}
                      </el-tag>
                  </div> -->
                </div>
              </div>

              <div class="flex items-center gap-2 flex-shrink-0">
                <el-icon v-if="!env.exists" :size="25" color="#e74c3c">
                  <CircleClose />
                </el-icon>
                <el-icon v-else :size="25" color="#00b894">
                  <CircleCheck />
                </el-icon>

                <!-- 配置和删除按钮 - 使用下拉菜单 -->
                <div class="" @click.stop>
                  <el-dropdown trigger="click" @command="(command) => handleEnvAction(command, env.name)">
                    <el-button :icon="MoreFilled" size="small" circle />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="config" :icon="Setting">
                          配置环境
                        </el-dropdown-item>
                        <el-dropdown-item command="delete" :icon="DeleteFilled" divided>
                          <span>删除环境</span>
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-aside>

      <!-- 右侧主内容 -->
      <el-main class="bg-gray-50 p-5">
        <div class="flex flex-col h-full">
          <!-- 操作按钮面板 -->
          <el-card shadow="never" class="flex-shrink-0">
            <template #header>
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-2">
                  <el-icon :size="20">
                    <Operation />
                  </el-icon>
                  <span class="font-semibold">同步操作</span>
                </div>

                <div class="flex items-center gap-3">
                  <span class="text-sm text-gray-500">自动上传</span>
                  <el-switch
                    v-model="config.AUTO_UPLOAD"
                    :disabled="!currentEnv"
                    :loading="loadingStates.autoUpload"
                    @change="updateAutoUpload"
                  />
                </div>
              </div>
            </template>

            <div class="flex flex-wrap gap-3">
              <el-button type="success" :icon="Download" :loading="loadingStates.pull" :disabled="!currentEnv"
                @click="executePull(false)">
                拉取 (Pull)
              </el-button>

              <el-button type="success" :icon="Download" :loading="loadingStates.forcePull" :disabled="!currentEnv"
                @click="executePull(true)" plain>
                强制拉取
              </el-button>

              <el-button type="primary" :icon="Upload" :loading="loadingStates.push" :disabled="!currentEnv"
                @click="executePush(false)">
                推送 (Push)
              </el-button>

              <el-button type="primary" :icon="Upload" :loading="loadingStates.forcePush" :disabled="!currentEnv"
                @click="executePush(true)" plain>
                强制推送
              </el-button>

              <el-button type="warning" :icon="Tools" :loading="loadingStates.fix" :disabled="!currentEnv"
                @click="executeFix">
                修复目录
              </el-button>

              <el-button type="info" :icon="Download" :loading="loadingStates.sitePull" :disabled="!currentEnv"
                @click="executeSitePull">
                拉取站点配置
              </el-button>

              <el-button type="info" :icon="Upload" :loading="loadingStates.sitePush" :disabled="!currentEnv"
                @click="executeSitePush" plain>
                推送站点配置
              </el-button>

              <el-button type="info" :icon="Delete" @click="clearLogs" plain>
                清空日志
              </el-button>
            </div>

            <!-- 状态提示 -->
            <!-- <el-alert v-if="isExecuting" title="正在执行操作，请稍候..." type="warning" :closable="false" class="mt-4" />
            <el-alert v-else-if="lastResult" :title="lastResult.message"
              :type="lastResult.success ? 'success' : 'error'" :closable="false" class="mt-4" /> -->
          </el-card>

          <!-- 日志面板 -->
          <el-card shadow="never" class="flex-1 flex flex-col overflow-hidden">
            <template #header>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <el-icon :size="20">
                    <Document />
                  </el-icon>
                  <span class="font-semibold">执行日志</span>
                </div>
                <el-tag>{{ logs.length }} 条</el-tag>
              </div>
            </template>

            <el-scrollbar ref="logsContainer" class="flex-1">
              <div v-if="logs.length === 0" class="flex items-center justify-center h-full text-gray-400 py-20">
                <div class="text-center">
                  <el-icon :size="48" class="mb-2">
                    <DocumentCopy />
                  </el-icon>
                  <p>暂无日志信息</p>
                </div>
              </div>

              <div v-else class="space-y-1 p-2">
                <div v-for="(log, index) in logs" :key="index"
                  class="flex items-start gap-2 px-2 py-1 rounded hover:bg-gray-50">
                  <el-icon :size="16" :class="{
                    'text-blue-500': log.type === 'info',
                    'text-red-500': log.type === 'error',
                    'text-yellow-500': log.type === 'warning'
                  }" class="mt-0.5 flex-shrink-0">
                    <component :is="getLogIcon(log.type)" />
                  </el-icon>
                  <span :class="{
                    'text-gray-700': log.type === 'info',
                    'text-red-600 font-medium': log.type === 'error',
                    'text-yellow-600': log.type === 'warning'
                  }" class="text-xs break-all">
                    {{ log.message }}
                  </span>
                </div>
              </div>
            </el-scrollbar>
          </el-card>
        </div>
      </el-main>
    </el-container>

    <!-- 环境配置对话框 -->
    <el-dialog v-model="configDialogVisible" :title="`配置 ${currentConfigEnvLabel} 环境`" width="600px"
      :close-on-click-modal="false" style="max-height: 90vh; overflow-y: auto;margin-top: 4vh;">
      <el-form ref="configFormRef" :model="config" :rules="configRules" label-position="top" size="default">
        <el-form-item label="显示名称" prop="LABEL">
          <el-input v-model="config.LABEL" placeholder="例如: 开发环境, 测试服务器" :prefix-icon="Edit" />
        </el-form-item>

        <el-form-item label="用户名" prop="BASIC_AUTH_USER_NAME">
          <el-input v-model="config.BASIC_AUTH_USER_NAME" placeholder="Kooboo用户名" :prefix-icon="User" />
        </el-form-item>

        <el-form-item label="密码" prop="BASIC_AUTH_PASSWORD">
          <el-input v-model="config.BASIC_AUTH_PASSWORD" type="password" placeholder="Kooboo密码" :prefix-icon="Lock"
            show-password />
        </el-form-item>

        <el-form-item label="API地址" prop="API_BASE_URL">
          <el-input v-model="config.API_BASE_URL" placeholder="https://your-server.kooboo.io" :prefix-icon="Link" />
        </el-form-item>

        <el-form-item label="站点ID" prop="SITE_ID">
          <el-input v-model="config.SITE_ID" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" :prefix-icon="Key" />
        </el-form-item>

        <el-form-item label="同步模块" prop="SYNC_MODULES">
          <div class="flex flex-wrap gap-2">
            <el-check-tag v-for="module in availableModules" :key="module" :checked="selectedModules.includes(module)"
              @change="toggleModule(module)" class="cursor-pointer" round>
              {{ module }}
            </el-check-tag>
          </div>
        </el-form-item>

        <el-form-item label="目标文件夹" prop="FOLDER_NAME">
          <div class="flex gap-2">
            <el-input v-model="config.FOLDER_NAME" placeholder="选择或输入文件夹路径" :prefix-icon="Folder" />
            <el-button :icon="FolderOpened" @click="selectFolder">选择</el-button>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" :icon="Select" @click="saveConfig">保存配置</el-button>
      </template>
    </el-dialog>

    <!-- 添加环境对话框 -->
    <el-dialog v-model="dialogVisible" title="添加自定义环境" width="500px" :close-on-click-modal="false">
      <el-form ref="newEnvFormRef" :model="newEnvForm" :rules="newEnvRules" label-position="top">
        <el-form-item label="环境名称（英文）" prop="name">
          <el-input v-model="newEnvForm.name" placeholder="例如: test, staging, uat" :prefix-icon="Edit" />
        </el-form-item>
        <el-form-item label="显示名称" prop="label">
          <el-input v-model="newEnvForm.label" placeholder="例如: 测试环境, 预发布环境" :prefix-icon="Edit" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddEnv">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import {
  RefreshRight, Plus, User, Lock, Link, Key, Folder, FolderOpened,
  Select, Operation, Download, Upload, Tools, Delete, Document,
  DocumentCopy, CircleCheck, CircleClose, Setting, Monitor, Promotion, Box,
  InfoFilled, WarningFilled, CircleCloseFilled, Edit,
  Minus, Close, CopyDocument, DeleteFilled, MoreFilled
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const currentEnv = ref('');
const appVersion = ref('');
const environments = ref([]);
const defaultSyncModules = 'Page,View,Layout,Api,Code,Style,Script,Label';
const config = reactive({
  BASIC_AUTH_USER_NAME: '',
  BASIC_AUTH_PASSWORD: '',
  API_BASE_URL: '',
  SITE_ID: '',
  SYNC_MODULES: defaultSyncModules,
  FOLDER_NAME: 'Kooboo',
  AUTO_UPLOAD: false
});

const logs = ref([]);
const logsContainer = ref(null);
const isExecuting = ref(false);
const lastResult = ref(null);
const dialogVisible = ref(false);
const configDialogVisible = ref(false);
const editingEnv = ref(''); // 当前正在编辑配置的环境名称
const configFormRef = ref(null); // 配置表单引用
const newEnvFormRef = ref(null); // 新环境表单引用
const newEnvForm = reactive({
  name: '',
  label: ''
});

// 各个操作的loading状态
const loadingStates = reactive({
  pull: false,
  forcePull: false,
  push: false,
  forcePush: false,
  fix: false,
  sitePull: false,
  sitePush: false,
  autoUpload: false
});

// 可用的同步模块
const availableModules = ['Page', 'View', 'Layout', 'Api', 'Code', 'Style', 'Script', 'Label'];

// 配置表单验证规则
const configRules = {
  LABEL: [
    { required: true, message: '请输入显示名称', trigger: 'blur' }
  ],
  BASIC_AUTH_USER_NAME: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  BASIC_AUTH_PASSWORD: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ],
  API_BASE_URL: [
    { required: true, message: '请输入API地址', trigger: 'blur' },
    { type: 'url', message: '请输入正确的URL格式', trigger: 'blur' }
  ],
  SITE_ID: [
    { required: true, message: '请输入站点ID', trigger: 'blur' }
  ],
  SYNC_MODULES: [
    { required: true, message: '请选择至少一个同步模块', trigger: 'change' }
  ],
  FOLDER_NAME: [
    { required: true, message: '请输入或选择目标文件夹', trigger: 'blur' }
  ]
};

// 新环境表单验证规则
const newEnvRules = {
  name: [
    { required: true, message: '请输入环境名称', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和横线', trigger: 'blur' }
  ],
  label: [
    { required: true, message: '请输入显示名称', trigger: 'blur' }
  ]
};

// 当前选中的模块
const selectedModules = computed({
  get: () => config.SYNC_MODULES.split(',').filter(m => m.trim()),
  set: (val) => {
    config.SYNC_MODULES = val.join(',');
  }
});

// 当前环境标签
const currentEnvLabel = computed(() => {
  const env = environments.value.find(e => e.name === currentEnv.value);
  return env ? env.label : currentEnv.value.toUpperCase();
});

// 当前配置环境标签
const currentConfigEnvLabel = computed(() => {
  const envName = editingEnv.value || currentEnv.value;
  const env = environments.value.find(e => e.name === envName);
  return env ? env.label : envName.toUpperCase();
});

// 切换模块选择
const toggleModule = (module) => {
  const modules = selectedModules.value;
  const index = modules.indexOf(module);
  if (index > -1) {
    modules.splice(index, 1);
  } else {
    modules.push(module);
  }
  selectedModules.value = modules;
};

// 加载环境列表
const loadEnvironments = async () => {
  const result = await window.electronAPI.getEnvList();
  environments.value = result;
};

// 打开添加环境对话框
const openAddEnvDialog = () => {
  dialogVisible.value = true;
};

// 打开配置对话框（不切换环境）
const openConfigDialog = async (envName) => {
  editingEnv.value = envName;
  await loadConfig(envName);
  configDialogVisible.value = true;
};

// 处理环境操作（配置或删除）
const handleEnvAction = async (command, envName) => {
  if (command === 'config') {
    // 只加载配置，不切换当前环境
    editingEnv.value = envName;
    await loadConfig(envName);
    configDialogVisible.value = true;
  } else if (command === 'delete') {
    await handleDeleteClick(envName);
  }
};

// 处理删除按钮点击
const handleDeleteClick = async (envName) => {
  const env = environments.value.find(e => e.name === envName);
  const envLabel = env ? env.label : envName;

  try {
    await ElMessageBox.confirm(
      `确定要删除环境 "${envLabel}" 吗？此操作将永久删除配置文件。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    );

    // 执行删除
    const result = await window.electronAPI.deleteEnvConfig(envName);

    if (result.success) {
      ElMessage.success(`环境 "${envLabel}" 已删除`);

      // 重新加载环境列表
      await loadEnvironments();

      // 如果删除的是当前环境，清空配置或切换到第一个可用环境
      if (currentEnv.value === envName) {
        if (environments.value.length > 0) {
          // 切换到第一个可用环境
          const firstEnv = environments.value[0].name;
          await switchEnvironment(firstEnv);
        } else {
          // 没有环境了，清空配置
          currentEnv.value = '';
          Object.assign(config, {
            BASIC_AUTH_USER_NAME: '',
            BASIC_AUTH_PASSWORD: '',
            API_BASE_URL: '',
            SITE_ID: '',
            SYNC_MODULES: defaultSyncModules,
            FOLDER_NAME: 'Kooboo',
            AUTO_UPLOAD: false
          });
        }
      }
    } else {
      ElMessage.error(`删除失败: ${result.error}`);
    }
  } catch (error) {
    // 用户取消删除
    if (error !== 'cancel') {
      ElMessage.error(`删除失败: ${error}`);
    }
  }
};

// 确认添加环境
const confirmAddEnv = async () => {
  // 验证表单
  if (!newEnvFormRef.value) return;
  
  try {
    await newEnvFormRef.value.validate();
  } catch (error) {
    return; // 验证失败，不继续执行
  }

  const name = newEnvForm.name.trim().toLowerCase();
  const label = newEnvForm.label.trim();

  if (environments.value.some(e => e.name === name)) {
    ElMessage.warning('该环境已存在');
    return;
  }

  environments.value.push({
    name: name,
    label: label,
    exists: false
  });

  currentEnv.value = name;

  Object.assign(config, {
    LABEL: label, // 保存 label 到配置中
    BASIC_AUTH_USER_NAME: '',
    BASIC_AUTH_PASSWORD: '',
    API_BASE_URL: '',
    SITE_ID: '',
    SYNC_MODULES: defaultSyncModules,
    FOLDER_NAME: 'Kooboo',
    AUTO_UPLOAD: false
  });

  await window.electronAPI.setActiveEnv(name);

  dialogVisible.value = false;
  newEnvForm.name = '';
  newEnvForm.label = '';
  
  // 重置表单验证状态
  newEnvFormRef.value?.resetFields();

  // 直接打开配置对话框
  editingEnv.value = name;
  configDialogVisible.value = true;

  ElMessage.success(`环境 "${label}" 创建成功，请配置并保存`);
};

// 加载配置
const loadConfig = async (env) => {
  const result = await window.electronAPI.readEnvConfig(env);
  if (result.success) {
    Object.assign(config, result.data);
  }
};

// 切换环境
const switchEnvironment = async (env) => {
  currentEnv.value = env;
  await window.electronAPI.setActiveEnv(env);
  await loadConfig(env);
};

const buildConfigData = (envName) => {
  const configData = JSON.parse(JSON.stringify(config));

  if (!configData.LABEL) {
    const env = environments.value.find(e => e.name === envName);
    configData.LABEL = env ? env.label : envName.toUpperCase();
  }

  return configData;
};

// 保存配置
const saveConfig = async () => {
  // 验证表单
  if (!configFormRef.value) return;
  
  try {
    await configFormRef.value.validate();
  } catch (error) {
    ElMessage.warning('请填写所有必填项');
    return; // 验证失败，不继续执行
  }

  // 使用 editingEnv 来保存配置，而不影响 currentEnv
  const envToSave = editingEnv.value || currentEnv.value;
  const configData = buildConfigData(envToSave);

  const result = await window.electronAPI.saveEnvConfig(envToSave, configData);
  if (result.success) {
    ElMessage.success('配置保存成功！');
    await loadEnvironments();
    configDialogVisible.value = false;
    editingEnv.value = '';
    // 重置表单验证状态
    configFormRef.value?.resetFields();
  } else {
    ElMessage.error(`保存失败: ${result.error}`);
  }
};

const updateAutoUpload = async (value) => {
  if (!currentEnv.value) {
    return;
  }

  const previousValue = !value;
  loadingStates.autoUpload = true;

  const result = await window.electronAPI.saveEnvConfig(currentEnv.value, buildConfigData(currentEnv.value));
  if (result.success) {
    await window.electronAPI.setActiveEnv(currentEnv.value);
    ElMessage.success(value ? '自动上传已开启' : '自动上传已关闭');
  } else {
    config.AUTO_UPLOAD = previousValue;
    ElMessage.error(`自动上传设置保存失败: ${result.error}`);
  }

  loadingStates.autoUpload = false;
};

// 选择文件夹
const selectFolder = async () => {
  const result = await window.electronAPI.selectFolder();
  if (result.success) {
    config.FOLDER_NAME = result.path;
  }
};

// 执行拉取
const executePull = async (force) => {
  const key = force ? 'forcePull' : 'pull';
  loadingStates[key] = true;
  isExecuting.value = true;
  lastResult.value = null;
  logs.value.push({ type: 'info', message: `开始${force ? '强制' : ''}拉取 (${currentEnvLabel.value})...` });

  const result = await window.electronAPI.executePull(currentEnv.value, force);

  loadingStates[key] = false;
  isExecuting.value = false;
  if (result.success) {
    lastResult.value = { success: true, message: '✅ 拉取完成！' };
    ElMessage.success('拉取完成！');
  } else {
    lastResult.value = { success: false, message: `❌ 拉取失败: ${result.error}` };
    logs.value.push({ type: 'error', message: result.error });
    ElMessage.error(`拉取失败: ${result.error}`);
  }

  setTimeout(() => lastResult.value = null, 5000);
};

// 执行推送
const executePush = async (force) => {
  const key = force ? 'forcePush' : 'push';
  loadingStates[key] = true;
  isExecuting.value = true;
  lastResult.value = null;
  logs.value.push({ type: 'info', message: `开始${force ? '强制' : ''}推送 (${currentEnvLabel.value})...` });

  const result = await window.electronAPI.executePush(currentEnv.value, force);

  loadingStates[key] = false;
  isExecuting.value = false;
  if (result.success) {
    lastResult.value = { success: true, message: '✅ 推送完成！' };
    ElMessage.success('推送完成！');
  } else {
    lastResult.value = { success: false, message: `❌ 推送失败: ${result.error}` };
    logs.value.push({ type: 'error', message: result.error });
    ElMessage.error(`推送失败: ${result.error}`);
  }

  setTimeout(() => lastResult.value = null, 5000);
};

// 执行修复
const executeFix = async () => {
  loadingStates.fix = true;
  isExecuting.value = true;
  lastResult.value = null;
  logs.value.push({ type: 'info', message: `开始修复目录 (${currentEnvLabel.value})...` });

  const result = await window.electronAPI.executeFix(currentEnv.value);

  loadingStates.fix = false;
  isExecuting.value = false;
  if (result.success) {
    lastResult.value = { success: true, message: '✅ 修复完成！' };
    ElMessage.success('修复完成！');
  } else {
    lastResult.value = { success: false, message: `❌ 修复失败: ${result.error}` };
    logs.value.push({ type: 'error', message: result.error });
    ElMessage.error(`修复失败: ${result.error}`);
  }

  setTimeout(() => lastResult.value = null, 5000);
};

const executeSitePull = async () => {
  loadingStates.sitePull = true;
  isExecuting.value = true;
  lastResult.value = null;
  logs.value.push({ type: 'info', message: `开始拉取站点配置 (${currentEnvLabel.value})...` });

  const result = await window.electronAPI.executeSitePull(currentEnv.value);

  loadingStates.sitePull = false;
  isExecuting.value = false;
  if (result.success) {
    lastResult.value = { success: true, message: '✅ 站点配置拉取完成！' };
    ElMessage.success('站点配置拉取完成！');
  } else {
    lastResult.value = { success: false, message: `❌ 站点配置拉取失败: ${result.error}` };
    logs.value.push({ type: 'error', message: result.error });
    ElMessage.error(`站点配置拉取失败: ${result.error}`);
  }

  setTimeout(() => lastResult.value = null, 5000);
};

const executeSitePush = async () => {
  loadingStates.sitePush = true;
  isExecuting.value = true;
  lastResult.value = null;
  logs.value.push({ type: 'info', message: `开始推送站点配置 (${currentEnvLabel.value})...` });

  const result = await window.electronAPI.executeSitePush(currentEnv.value);

  loadingStates.sitePush = false;
  isExecuting.value = false;
  if (result.success) {
    lastResult.value = { success: true, message: '✅ 站点配置推送完成！' };
    ElMessage.success('站点配置推送完成！');
  } else {
    lastResult.value = { success: false, message: `❌ 站点配置推送失败: ${result.error}` };
    logs.value.push({ type: 'error', message: result.error });
    ElMessage.error(`站点配置推送失败: ${result.error}`);
  }

  setTimeout(() => lastResult.value = null, 5000);
};

// 清空日志
const clearLogs = () => {
  logs.value = [];
  ElMessage.info('日志已清空');
};

// 监听日志
const handleSyncLog = (log) => {
  logs.value.push(log);
  scrollToBottom();
};

// 滚动到底部的函数
const scrollToBottom = () => {
  nextTick(() => {
    if (logsContainer.value) {
      // 方法1：通过 setScrollTop 方法（Element Plus 推荐）
      try {
        logsContainer.value.setScrollTop(999999);
      } catch (e) {
        // 方法2：直接访问内部 wrap 元素
        const wrap = logsContainer.value.$refs?.wrap;
        if (wrap) {
          wrap.scrollTop = wrap.scrollHeight;
        }
      }
    }
  });
};

// 监听 logs 数组的变化，自动滚动到底部
watch(() => logs.value.length, () => {
  scrollToBottom();
});

// 获取环境图标
const getEnvIcon = (env) => {
  // const icons = { dev: Setting, acc: Monitor, prod: Promotion };
  return Monitor;
};

// 获取日志图标
const getLogIcon = (type) => {
  const icons = { info: InfoFilled, error: CircleCloseFilled, warning: WarningFilled };
  return icons[type] || InfoFilled;
};

// 窗口控制
const minimizeWindow = () => {
  window.electronAPI.windowMinimize();
};

const maximizeWindow = () => {
  window.electronAPI.windowMaximize();
};

const closeWindow = () => {
  window.electronAPI.windowClose();
};

onMounted(async () => {
  appVersion.value = await window.electronAPI.getAppVersion();
  await loadEnvironments();
  // 加载第一个可用环境的配置，如果没有环境则不加载
  if (environments.value.length > 0) {
    await switchEnvironment(environments.value[0].name);
  }
  window.electronAPI.onSyncLog(handleSyncLog);
});

onUnmounted(() => {
  window.electronAPI.removeSyncLogListener();
});
</script>

<style scoped>
/* 自定义标题栏 */
.title-bar {
  height: 60px;
  -webkit-app-region: drag;
  /* 可拖拽区域 */
  user-select: none;
}

/* 窗口控制按钮不可拖拽 */
.window-controls {
  -webkit-app-region: no-drag;
}

.window-btn {
  width: 46px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  outline: none;
}

.window-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.window-btn:last-child:hover {
  background-color: #e81123;
}

.el-header {
  height: 80px;
  padding: 0;
}

.el-aside {
  height: calc(100vh - 60px);
  /* 减去标题栏高度 */
}

.el-main {
  height: calc(100vh - 60px);
  /* 减去标题栏高度 */
  padding: 0;
}

:deep(.el-card__body) {
  height: 100%;
  display: flex;
  flex-direction: column;
}
:deep(.el-card) {
  --el-card-border-radius:0;
  border-radius: none;
}
:deep(.el-check-tag){
  border-radius: 999px;
  font-weight: 500;
}
</style>
