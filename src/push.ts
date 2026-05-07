import fs from 'fs';
import { useEnv } from './utils/useEnv';
import { push as pushFunctions } from './sync/genericSync';
import { checkLocalRoutes, checkLocalCode, fixLocalCode } from './sync/genericSync';
import { checkLocalLabels, fixLocalLabels, pushLabels } from './sync/labelSync';
import { Module } from './types';

function ensureKoobooDir() {
  const { KOOBOO_DIR } = useEnv();
  if (!fs.existsSync(KOOBOO_DIR)) {
    fs.mkdirSync(KOOBOO_DIR, { recursive: true });
  }
}

function fixModule(module: Module) {
  if (module === Module.Label) {
    fixLocalLabels();
  } else {
    fixLocalCode(module);
  }
}

function validateModule(module: Module) {
  const { valid, errors } = module === Module.Label
    ? checkLocalLabels()
    : checkLocalCode(module);
  if (!valid) {
    throw new Error(`模块${module}检查失败: ${errors.join(', ')}`);
  }
}

function validateRoutesIfNeeded(modules: Module[]) {
  const { SYNC_MODULES } = useEnv();
  if (
    (modules.includes(Module.Api) || modules.includes(Module.Page)) &&
    SYNC_MODULES.includes(Module.Api) &&
    SYNC_MODULES.includes(Module.Page)
  ) {
    const { valid, errors } = checkLocalRoutes();
    if (!valid) {
      throw new Error(`本地路由检查失败: ${errors.join(', ')}`);
    }
  }
}

export async function pushModuleTask(module: Module, force = false) {
  ensureKoobooDir();
  fixModule(module);
  validateRoutesIfNeeded([module]);
  validateModule(module);

  console.log(`正在推送模块: ${module}...`);
  if (module === Module.Label) {
    await pushLabels();
  } else {
    await pushFunctions(module, force);
  }
  console.log(`模块 ${module} 推送完成`);
}

export async function pushModulesTask(modules: Module[], force = false) {
  ensureKoobooDir();

  for (const module of modules) {
    fixModule(module);
  }

  validateRoutesIfNeeded(modules);

  for (const module of modules) {
    validateModule(module);
  }

  const totalModules = modules.length;
  let completedModules = 0;
  const failedModules: string[] = [];

  console.log(`开始推送任务，共 ${totalModules} 个模块需要处理...`);

  for (const module of modules) {
    try {
      if (Object.keys(Module).includes(module)) {
        console.log(`正在推送模块: ${module}...`);
        if (module === Module.Label) {
          await pushLabels();
        } else {
          await pushFunctions(module, force);
        }
        completedModules++;
        console.log(`模块 ${module} 推送完成 (${completedModules}/${totalModules})`);
      } else {
        console.warn(`未知模块: ${module}，跳过处理`);
        failedModules.push(`${module}: 未知模块`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedModules.push(`${module}: ${message}`);
      console.error(`推送模块 ${module} 时发生错误:`, message);
    }
  }

  if (completedModules === totalModules) {
    console.log('所有模块推送完成！');
  } else {
    const summary = `部分模块推送失败，成功处理 ${completedModules}/${totalModules} 个模块`;
    console.warn(summary);
    throw new Error(`${summary}。失败模块: ${failedModules.join('; ')}`);
  }
}

export async function pushTask(force = false) {
  const { SYNC_MODULES } = useEnv();
  await pushModulesTask(SYNC_MODULES, force);
}
