import { pushSettingsTask } from './sync/SiteSync';

export async function sitePushTask() {
  await pushSettingsTask();
}
