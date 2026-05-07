<template>
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
          <el-tooltip content="监听文件变动并上传" placement="top">
            <span class="text-sm text-gray-500 cursor-help">自动上传</span>
          </el-tooltip>
          <div class="auto-upload-control">
            <el-switch
              :model-value="config.AUTO_UPLOAD"
              :disabled="!currentEnv"
              :loading="loadingStates.autoUpload"
              @change="updateAutoUpload"
            />
            <el-tooltip v-if="config.AUTO_UPLOAD && !loadingStates.autoUpload" content="自动上传监听中" placement="top">
              <span class="auto-upload-spinner" aria-label="自动上传监听中"></span>
            </el-tooltip>
          </div>
        </div>
      </div>
    </template>

    <div class="operation-toolbar">
      <div class="operation-group">
        <div class="operation-group-title">模块同步</div>
        <div class="operation-actions">
          <el-button-group>
            <el-button type="primary" :icon="Download" :loading="loadingStates.pull" :disabled="!currentEnv"
              @click="executePull(false)">
              拉取
            </el-button>
            <el-dropdown trigger="click" @command="handlePullCommand">
              <el-button type="primary" class="split-more-button" :loading="loadingStates.forcePull"
                :disabled="!currentEnv">
                <el-icon>
                  <ArrowDown />
                </el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="force" :disabled="!currentEnv || loadingStates.forcePull">
                    强制拉取
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </el-button-group>

          <el-button-group>
            <el-button type="success" :icon="Upload" :loading="loadingStates.push" :disabled="!currentEnv"
              @click="executePush(false)">
              推送
            </el-button>
            <el-dropdown trigger="click" @command="handlePushCommand">
              <el-button type="success" class="split-more-button" :loading="loadingStates.forcePush" :disabled="!currentEnv">
                <el-icon>
                  <ArrowDown />
                </el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="force" :disabled="!currentEnv || loadingStates.forcePush">
                    强制推送
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </el-button-group>
        </div>
      </div>

      <div class="operation-divider"></div>

      <div class="operation-group">
        <div class="operation-group-title">配置</div>
        <div class="operation-actions">
          <el-dropdown trigger="click" @command="handleSiteConfigCommand">
            <el-button :icon="Setting" :loading="siteConfigLoading" :disabled="!currentEnv">
              站点配置
              <el-icon class="el-icon--right">
                <ArrowDown />
              </el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="pull" :disabled="!currentEnv || loadingStates.sitePull">
                  拉取站点配置
                </el-dropdown-item>
                <el-dropdown-item command="push" :disabled="!currentEnv || loadingStates.sitePush">
                  推送站点配置
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <el-dropdown trigger="click" @command="handleMaintenanceCommand">
            <el-button :icon="Tools" :loading="maintenanceLoading" :disabled="!currentEnv">
              维护工具
              <el-icon class="el-icon--right">
                <ArrowDown />
              </el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="fix" :disabled="!currentEnv || loadingStates.fix">
                  修复目录
                </el-dropdown-item>
                <el-dropdown-item command="devConfig" :disabled="!currentEnv || loadingStates.devConfig">
                  初始化开发配置
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed, reactive } from 'vue';
import {
  Operation,
  Download,
  Upload,
  Tools,
  Setting,
  ArrowDown
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const props = defineProps({
  currentEnv: {
    type: String,
    default: ''
  },
  currentEnvLabel: {
    type: String,
    default: ''
  },
  config: {
    type: Object,
    required: true
  },
  logs: {
    type: Array,
    required: true
  }
});

const loadingStates = reactive({
  pull: false,
  forcePull: false,
  push: false,
  forcePush: false,
  fix: false,
  devConfig: false,
  sitePull: false,
  sitePush: false,
  autoUpload: false
});

const siteConfigLoading = computed(() => loadingStates.sitePull || loadingStates.sitePush);
const maintenanceLoading = computed(() => loadingStates.fix || loadingStates.devConfig);

const log = (type, message) => {
  props.logs.push({ type, message });
};

const updateAutoUpload = async (value) => {
  if (!props.currentEnv) {
    return;
  }

  const previousValue = props.config.AUTO_UPLOAD;
  props.config.AUTO_UPLOAD = value;
  loadingStates.autoUpload = true;

  const result = await window.electronAPI.setAutoUpload(props.currentEnv, value);
  if (result.success) {
    props.config.AUTO_UPLOAD = result.autoUpload;
    ElMessage.success(value ? '自动上传已开启' : '自动上传已关闭');
  } else {
    props.config.AUTO_UPLOAD = previousValue;
    ElMessage.error(`自动上传设置保存失败: ${result.error}`);
  }

  loadingStates.autoUpload = false;
};

const executePull = async (force) => {
  const key = force ? 'forcePull' : 'pull';
  loadingStates[key] = true;
  log('info', `开始${force ? '强制' : ''}拉取 (${props.currentEnvLabel})...`);

  const result = await window.electronAPI.executePull(props.currentEnv, force);

  loadingStates[key] = false;
  if (result.success) {
    ElMessage.success('拉取完成！');
  } else {
    log('error', result.error);
    ElMessage.error(`拉取失败: ${result.error}`);
  }
};

const executePush = async (force) => {
  const key = force ? 'forcePush' : 'push';
  loadingStates[key] = true;
  log('info', `开始${force ? '强制' : ''}推送 (${props.currentEnvLabel})...`);

  const result = await window.electronAPI.executePush(props.currentEnv, force);

  loadingStates[key] = false;
  if (result.success) {
    ElMessage.success('推送完成！');
  } else {
    log('error', result.error);
    ElMessage.error(`推送失败: ${result.error}`);
  }
};

const handlePullCommand = (command) => {
  if (command === 'force') {
    executePull(true);
  }
};

const handlePushCommand = (command) => {
  if (command === 'force') {
    executePush(true);
  }
};

const executeFix = async () => {
  loadingStates.fix = true;
  log('info', `开始修复目录 (${props.currentEnvLabel})...`);

  const result = await window.electronAPI.executeFix(props.currentEnv);

  loadingStates.fix = false;
  if (result.success) {
    ElMessage.success('修复完成！');
  } else {
    log('error', result.error);
    ElMessage.error(`修复失败: ${result.error}`);
  }
};

const executeInitDevConfig = async () => {
  try {
    await ElMessageBox.confirm(
      `将在目标文件夹 "${props.config.FOLDER_NAME}" 初始化开发配置文件。已存在的文件会跳过，不会覆盖。`,
      '初始化开发配置',
      {
        confirmButtonText: '开始初始化',
        cancelButtonText: '取消',
        type: 'info'
      }
    );
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(`初始化确认失败: ${error}`);
    }
    return;
  }

  loadingStates.devConfig = true;
  log('info', `开始初始化开发配置 (${props.currentEnvLabel})...`);

  let result;
  try {
    result = await window.electronAPI.initDevConfig(props.currentEnv);
  } catch (error) {
    result = { success: false, error: error instanceof Error ? error.message : String(error) };
  }

  loadingStates.devConfig = false;

  if (result.success) {
    const createdText = result.created.length > 0 ? result.created.join(', ') : '无';
    const skippedText = result.skipped.length > 0 ? result.skipped.join(', ') : '无';

    log('info', `目标文件夹: ${result.targetDir}`);
    log('info', `已创建: ${createdText}`);
    log('info', `已存在跳过: ${skippedText}`);
    ElMessage.success(result.created.length > 0 ? '开发配置初始化完成！' : '开发配置已存在，无需初始化');
  } else {
    log('error', result.error);
    ElMessage.error(`初始化开发配置失败: ${result.error}`);
  }
};

const executeSitePull = async () => {
  loadingStates.sitePull = true;
  log('info', `开始拉取站点配置 (${props.currentEnvLabel})...`);

  const result = await window.electronAPI.executeSitePull(props.currentEnv);

  loadingStates.sitePull = false;
  if (result.success) {
    ElMessage.success('站点配置拉取完成！');
  } else {
    log('error', result.error);
    ElMessage.error(`站点配置拉取失败: ${result.error}`);
  }
};

const executeSitePush = async () => {
  loadingStates.sitePush = true;
  log('info', `开始推送站点配置 (${props.currentEnvLabel})...`);

  const result = await window.electronAPI.executeSitePush(props.currentEnv);

  loadingStates.sitePush = false;
  if (result.success) {
    ElMessage.success('站点配置推送完成！');
  } else {
    log('error', result.error);
    ElMessage.error(`站点配置推送失败: ${result.error}`);
  }
};

const handleSiteConfigCommand = (command) => {
  if (command === 'pull') {
    executeSitePull();
    return;
  }

  if (command === 'push') {
    executeSitePush();
  }
};

const handleMaintenanceCommand = (command) => {
  if (command === 'fix') {
    executeFix();
    return;
  }

  if (command === 'devConfig') {
    executeInitDevConfig();
  }
};
</script>

<style scoped>
.auto-upload-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.auto-upload-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #bfdbfe;
  border-top-color: #1287ff;
  border-radius: 50%;
  animation: auto-upload-spin 900ms linear infinite;
}

@keyframes auto-upload-spin {
  to {
    transform: rotate(360deg);
  }
}

.operation-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 18px;
  flex-wrap: wrap;
}

.operation-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.operation-group-title {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.operation-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.operation-divider {
  align-self: stretch;
  width: 1px;
  min-height: 54px;
  background: #e5e7eb;
}

.split-more-button {
  width: 36px;
  padding-left: 0;
  padding-right: 0;
}

:deep(.operation-actions .el-button),
:deep(.operation-toolbar > .el-button) {
  height: 36px;
  border-radius: 4px;
}

:deep(.operation-actions .el-button-group) {
  display: inline-flex;
}

:deep(.operation-actions .el-button-group > .el-dropdown) {
  display: inline-flex;
  margin-left: -1px;
}

:deep(.operation-actions .el-button-group > .el-dropdown .el-button) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

@media (max-width: 1100px) {
  .operation-toolbar {
    align-items: flex-start;
  }

  .operation-divider {
    display: none;
  }
}
</style>
