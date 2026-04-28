<template>
  <div class="title-bar bg-[#1287ff] text-white shadow-lg flex items-center justify-between">
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

    <div class="flex items-center window-controls">
      <button @click="$emit('minimize')" class="window-btn hover:bg-white/20 transition-colors">
        <el-icon :size="16">
          <Minus />
        </el-icon>
      </button>
      <button @click="$emit('maximize')" class="window-btn hover:bg-white/20 transition-colors">
        <el-icon :size="14">
          <CopyDocument />
        </el-icon>
      </button>
      <button @click="$emit('close')" class="window-btn hover:bg-red-500 transition-colors">
        <el-icon :size="16">
          <Close />
        </el-icon>
      </button>
    </div>
  </div>
</template>

<script setup>
import { RefreshRight, Minus, Close, CopyDocument } from '@element-plus/icons-vue';

defineProps({
  appVersion: {
    type: String,
    default: ''
  }
});

defineEmits(['minimize', 'maximize', 'close']);
</script>

<style scoped>
.title-bar {
  height: 60px;
  -webkit-app-region: drag;
  user-select: none;
}

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
</style>
