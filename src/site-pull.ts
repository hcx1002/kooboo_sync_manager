import { pullSettingTask } from './sync/SiteSync';

export async function sitePullTask() {
  await pullSettingTask();
}
