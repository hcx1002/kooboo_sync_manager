<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="600px"
    :close-on-click-modal="false"
    style="max-height: 90vh; overflow-y: auto; margin-top: 8vh;"
    @update:model-value="value => $emit('update:modelValue', value)"
  >
    <el-form ref="formRef" :model="config" :rules="configRules" label-position="top" size="default">
      <el-form-item label="显示名称" prop="LABEL">
        <el-input v-model="config.LABEL" placeholder="例如: 开发环境, 测试服务器" :prefix-icon="Edit" />
      </el-form-item>

      <el-form-item label="用户名" prop="BASIC_AUTH_USER_NAME">
        <el-input v-model="config.BASIC_AUTH_USER_NAME" placeholder="Kooboo用户名" :prefix-icon="User" />
      </el-form-item>

      <el-form-item label="密码" prop="BASIC_AUTH_PASSWORD">
        <el-input
          v-model="config.BASIC_AUTH_PASSWORD"
          type="password"
          placeholder="Kooboo密码"
          :prefix-icon="Lock"
          show-password
        />
      </el-form-item>

      <el-form-item label="API地址" prop="API_BASE_URL">
        <el-input v-model="config.API_BASE_URL" placeholder="https://your-server.kooboo.io" :prefix-icon="Link" />
      </el-form-item>

      <el-form-item label="站点ID" prop="SITE_ID">
        <el-input v-model="config.SITE_ID" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" :prefix-icon="Key" />
      </el-form-item>

      <el-form-item label="同步模块" prop="SYNC_MODULES">
        <div class="flex flex-wrap gap-2">
          <el-check-tag
            v-for="module in availableModules"
            :key="module"
            :checked="selectedModules.includes(module)"
            @change="toggleModule(module)"
            class="cursor-pointer"
            round
          >
            {{ module }}
          </el-check-tag>
        </div>
      </el-form-item>

      <el-form-item label="目标文件夹" prop="FOLDER_NAME">
        <div class="flex gap-2 w-full">
          <el-input class="w-full" v-model="config.FOLDER_NAME" placeholder="选择或输入文件夹路径" :prefix-icon="Folder" />
          <el-button :icon="FolderOpened" @click="selectFolder">选择</el-button>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :icon="Select" @click="submit">保存配置</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import {
  User,
  Lock,
  Link,
  Key,
  Folder,
  FolderOpened,
  Select,
  Edit
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'edit'
  },
  title: {
    type: String,
    required: true
  },
  envName: {
    type: String,
    default: ''
  },
  config: {
    type: Object,
    required: true
  },
  environments: {
    type: Array,
    required: true
  }
});

const emit = defineEmits([
  'update:modelValue',
  'saved'
]);

const formRef = ref(null);
const availableModules = ['Page', 'View', 'Layout', 'Api', 'Code', 'Style', 'Script', 'Label'];
const isCreateMode = computed(() => props.mode === 'create');
const dialogTitle = computed(() => isCreateMode.value ? '添加环境' : `配置 ${props.title} 环境`);
const selectedModules = computed({
  get: () => props.config.SYNC_MODULES.split(',').filter(module => module.trim()),
  set: (modules) => {
    props.config.SYNC_MODULES = modules.join(',');
  }
});

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

const normalizeEnvName = (value) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
};

const getEnvNameTimestamp = () => {
  return Date.now().toString(36);
};

const getUniqueEnvironmentName = (baseName) => {
  const existingNames = new Set(props.environments.map(env => env.name));
  const normalizedBaseName = baseName || 'env';
  const timestampedBaseName = `${normalizedBaseName}-${getEnvNameTimestamp()}`;
  let envName = timestampedBaseName;
  let index = 2;

  while (existingNames.has(envName)) {
    envName = `${timestampedBaseName}-${index}`;
    index += 1;
  }

  return envName;
};

const getEnvironmentNameForSave = () => {
  if (!isCreateMode.value) {
    return props.envName;
  }

  return getUniqueEnvironmentName(normalizeEnvName(props.config.LABEL || ''));
};

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

const selectFolder = async () => {
  const result = await window.electronAPI.selectFolder();
  if (result.success) {
    props.config.FOLDER_NAME = result.path;
  }
};

const buildConfigData = () => {
  const configData = JSON.parse(JSON.stringify(props.config));

  if (!configData.LABEL) {
    configData.LABEL = props.title;
  }

  return configData;
};

const submit = async () => {
  if (!formRef.value) {
    return;
  }

  try {
    await formRef.value.validate();
  } catch {
    ElMessage.warning('请填写所有必填项');
    return;
  }

  const envName = getEnvironmentNameForSave();
  if (!envName) {
    ElMessage.error('环境不存在，无法保存配置');
    return;
  }

  const result = await window.electronAPI.saveEnvConfig(envName, buildConfigData());
  if (result.success) {
    ElMessage.success(isCreateMode.value ? '环境创建成功！' : '配置保存成功！');
    emit('update:modelValue', false);
    emit('saved', { envName, mode: props.mode });
  } else {
    ElMessage.error(`保存失败: ${result.error}`);
  }
};

watch(() => props.modelValue, async (visible) => {
  if (visible) {
    return;
  }

  await nextTick();
  formRef.value?.resetFields();
});
</script>

<style scoped>
:deep(.el-check-tag) {
  border-radius: 999px;
  font-weight: 500;
}
</style>
