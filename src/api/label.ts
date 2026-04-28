import { apiClient, useUrlSiteId } from '../utils/apiClient';

export interface LabelItem {
  id: string;
  name: string;
  values: Record<string, string>;
  lastModified?: string;
  keyHash?: string;
}

export const getList = (): Promise<LabelItem[]> =>
  apiClient.get(useUrlSiteId('Label/list'));

export const create = (body: { key: string; values: Record<string, string> }): Promise<string> =>
  apiClient.post(useUrlSiteId('Label/create'), body);

export const update = (body: { id: string; values: Record<string, string> }): Promise<string> =>
  apiClient.post(useUrlSiteId('Label/Update'), body);

export const deletes = (ids: string[]): Promise<void> =>
  apiClient.post(useUrlSiteId('Label/Deletes'), { ids });
