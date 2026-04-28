<template>
  <el-aside width="236px" class="bg-white border-r overflow-y-auto p-3 app-sidebar">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-base font-semibold text-gray-800">环境列表</h3>
      <el-button type="primary" :icon="Plus" size="small" circle @click="$emit('add')" />
    </div>

    <div>
      <div v-if="environments.length === 0" class="text-center py-8">
        <el-icon :size="42" class="text-gray-300 mb-3">
          <Box />
        </el-icon>
        <p class="text-sm text-gray-400 mb-3">还没有任何环境配置</p>
        <el-button type="primary" :icon="Plus" size="small" @click="$emit('add')">
          创建第一个环境
        </el-button>
      </div>

      <Draggable
        v-else
        :model-value="environments"
        item-key="name"
        handle=".drag-handle"
        ghost-class="environment-ghost"
        chosen-class="environment-chosen"
        :animation="150"
        class="space-y-1.5"
        @update:model-value="handleDragUpdate"
      >
        <template #item="{ element: env }">
          <div :class="[
            'group px-2 py-2 rounded-md transition-all cursor-pointer',
            currentEnv === env.name
              ? 'bg-blue-50 border border-blue-400 shadow-sm'
              : ' border border-transparent hover:bg-gray-100'
          ]" @click="$emit('switch-env', env.name)">
            <div class="flex items-center justify-between gap-1.5">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <el-tooltip content="拖动排序" placement="top" :show-after="400">
                  <span class="drag-handle" @click.stop>
                    <el-icon :size="15">
                      <Rank />
                    </el-icon>
                  </span>
                </el-tooltip>
                <div class="flex-1 min-w-0">
                  <div :class="['text-sm font-medium leading-5 truncate', currentEnv === env.name ? 'text-blue-600' : 'text-gray-700']">
                    {{ env.label }}
                  </div>
                  <el-tooltip :content="env.targetFolderPath || env.targetFolderName" placement="top" :show-after="500">
                    <div class="text-[11px] leading-4 text-gray-400 truncate">
                      {{ env.targetFolderName || 'Kooboo' }}
                    </div>
                  </el-tooltip>
                </div>
              </div>

              <div class="flex items-center gap-1 flex-shrink-0">
                <div @click.stop>
                  <el-dropdown trigger="click" @command="command => $emit('env-action', command, env.name)">
                    <el-button :icon="MoreFilled" size="small" circle />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="config" :icon="Setting">
                          配置环境
                        </el-dropdown-item>
                        <el-dropdown-item command="copy" :icon="CopyDocument">
                          复制环境
                        </el-dropdown-item>
                        <el-dropdown-item command="delete" :icon="DeleteFilled" divided>
                          删除环境
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Draggable>
    </div>
  </el-aside>
</template>

<script setup>
import Draggable from 'vuedraggable';
import {
  Plus,
  Box,
  Setting,
  DeleteFilled,
  CopyDocument,
  MoreFilled,
  Rank
} from '@element-plus/icons-vue';

defineProps({
  environments: {
    type: Array,
    required: true
  },
  currentEnv: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['add', 'switch-env', 'env-action', 'reorder-envs']);

const handleDragUpdate = (nextEnvironments) => {
  emit('reorder-envs', nextEnvironments);
};
</script>

<style scoped>
.app-sidebar {
  height: calc(100vh - 60px);
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  color: #94a3b8;
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.environment-ghost {
  opacity: 0.55;
}

.environment-chosen {
  background: #eff6ff;
}
</style>
