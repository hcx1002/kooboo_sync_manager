<template>
  <el-card shadow="never" class="flex-1 flex flex-col overflow-hidden">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <el-icon :size="20">
            <Document />
          </el-icon>
          <span class="font-semibold">执行日志</span>
        </div>
        <div class="flex items-center gap-2">
          <el-tag>{{ logs.length }} 条</el-tag>
          <el-tooltip content="清空日志" placement="top">
            <el-button :icon="Delete" :disabled="logs.length === 0" @click="$emit('clear')" text circle />
          </el-tooltip>
        </div>
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
        <div v-for="(log, index) in logs" :key="index" class="flex items-start gap-2 px-2 py-1 rounded hover:bg-gray-50">
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
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import {
  Delete,
  Document,
  DocumentCopy,
  InfoFilled,
  WarningFilled,
  CircleCloseFilled
} from '@element-plus/icons-vue';

const props = defineProps({
  logs: {
    type: Array,
    required: true
  }
});

defineEmits(['clear']);

const logsContainer = ref(null);

const getLogIcon = (type) => {
  const icons = { info: InfoFilled, error: CircleCloseFilled, warning: WarningFilled };
  return icons[type] || InfoFilled;
};

const scrollToBottom = () => {
  nextTick(() => {
    if (!logsContainer.value) {
      return;
    }

    try {
      logsContainer.value.setScrollTop(999999);
    } catch {
      const wrap = logsContainer.value.$refs?.wrap;
      if (wrap) {
        wrap.scrollTop = wrap.scrollHeight;
      }
    }
  });
};

watch(() => props.logs.length, scrollToBottom);
</script>
