<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <TitleBar
      :app-version="appVersion"
      @minimize="minimizeWindow"
      @maximize="maximizeWindow"
      @close="closeWindow"
    />

    <!-- 主内容区 -->
    <el-container class="flex-1 overflow-hidden">
      <EnvironmentSidebar
        :environments="environments"
        :current-env="currentEnv"
        @add="openAddEnvDialog"
        @switch-env="switchEnvironment"
        @env-action="handleEnvAction"
        @reorder-envs="handleEnvironmentReorder"
      />

      <!-- 右侧主内容 -->
      <el-main class="bg-gray-50 p-5">
        <div class="flex flex-col h-full">
          <OperationPanel
            :current-env="currentEnv"
            :current-env-label="currentEnvLabel"
            :config="config"
            :logs="logs"
          />

          <LogPanel :logs="logs" @clear="clearLogs" />
        </div>
      </el-main>
    </el-container>

    <EnvironmentConfigDialog
      v-model="configDialogVisible"
      :mode="configDialogMode"
      :title="currentConfigEnvLabel"
      :env-name="configEnvName"
      :config="configDraft"
      :environments="environments"
      @saved="handleConfigSaved"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import TitleBar from './components/TitleBar.vue';
import EnvironmentSidebar from './components/EnvironmentSidebar.vue';
import OperationPanel from './components/OperationPanel.vue';
import LogPanel from './components/LogPanel.vue';
import EnvironmentConfigDialog from './components/EnvironmentConfigDialog.vue';

const currentEnv = ref('');
const appVersion = ref('');
const environments = ref([]);
const defaultSyncModules = 'Page,View,Layout,Api,Code,Style,Script,Label';
const createDefaultConfig = (label = '') => ({
  LABEL: label,
  BASIC_AUTH_USER_NAME: '',
  BASIC_AUTH_PASSWORD: '',
  API_BASE_URL: '',
  SITE_ID: '',
  SYNC_MODULES: defaultSyncModules,
  FOLDER_NAME: 'Kooboo',
  AUTO_UPLOAD: false
});
const config = reactive(createDefaultConfig());
const configDraft = reactive(createDefaultConfig());

const logs = ref([]);
const configDialogVisible = ref(false);
const configDialogMode = ref('edit');
const editingEnv = ref(''); // 当前正在编辑配置的环境名称

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

const configEnvName = computed(() => editingEnv.value || currentEnv.value);

// 加载环境列表
const loadEnvironments = async () => {
  const result = await window.electronAPI.getEnvList();
  environments.value = result;
};

// 打开添加环境对话框
const openAddEnvDialog = () => {
  editingEnv.value = '';
  configDialogMode.value = 'create';
  Object.assign(configDraft, createDefaultConfig());
  configDialogVisible.value = true;
};

// 处理环境操作（配置或删除）
const handleEnvAction = async (command, envName) => {
  if (command === 'config') {
    // 只加载配置，不切换当前环境
    editingEnv.value = envName;
    configDialogMode.value = 'edit';
    await loadConfig(envName, configDraft);
    configDialogVisible.value = true;
  } else if (command === 'delete') {
    await handleDeleteClick(envName);
  } else if (command === 'copy') {
    await handleCopyEnvironment(envName);
  }
};

const handleCopyEnvironment = async (envName) => {
  const env = environments.value.find(item => item.name === envName);
  const envLabel = env ? env.label : envName;
  const result = await window.electronAPI.cloneEnvConfig(envName);

  if (result.success) {
    await loadEnvironments();
    ElMessage.success(`已复制环境 "${envLabel}" 为 "${result.data.label}"`);
  } else {
    ElMessage.error(`复制失败: ${result.error}`);
  }
};

const handleEnvironmentReorder = async (nextEnvironments) => {
  environments.value = nextEnvironments;

  const result = await window.electronAPI.saveEnvOrder(
    nextEnvironments.map(env => env.name)
  );

  if (!result.success) {
    ElMessage.error(`保存环境排序失败: ${result.error}`);
    await loadEnvironments();
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
          await switchEnvironment(firstEnv, { notify: false });
        } else {
          // 没有环境了，清空配置
          currentEnv.value = '';
          Object.assign(config, createDefaultConfig());
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

// 加载配置
const loadConfig = async (env, target = config) => {
  const result = await window.electronAPI.readEnvConfig(env);
  if (result.success) {
    Object.assign(target, result.data);
  }
};

// 切换环境
const switchEnvironment = async (env, options = {}) => {
  const { notify = true } = options;
  const shouldNotify = notify && currentEnv.value !== env;

  currentEnv.value = env;
  await window.electronAPI.setActiveEnv(env);
  await loadConfig(env);

  if (shouldNotify) {
    ElMessage.success(`已切换到 ${currentEnvLabel.value}`);
  }
};

const handleConfigSaved = async ({ envName, mode }) => {
  await loadEnvironments();
  configDialogVisible.value = false;
  editingEnv.value = '';

  if (mode === 'create') {
    await switchEnvironment(envName, { notify: false });
    return;
  }

  if (envName === currentEnv.value) {
    await loadConfig(currentEnv.value);
  } else if (currentEnv.value) {
    await loadConfig(currentEnv.value);
  }
};

// 清空日志
const clearLogs = () => {
  logs.value = [];
  ElMessage.info('日志已清空');
};

// 监听日志
const handleSyncLog = (log) => {
  logs.value.push(log);
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
    await switchEnvironment(environments.value[0].name, { notify: false });
  }
  window.electronAPI.onSyncLog(handleSyncLog);
});

onUnmounted(() => {
  window.electronAPI.removeSyncLogListener();
});
</script>

<style scoped>
.el-main {
  height: calc(100vh - 60px);
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
</style>
