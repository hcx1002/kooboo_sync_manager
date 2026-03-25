import { useEnv } from './useEnv';

interface RequestConfig {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, unknown>;
  timeout?: number;
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (Array.isArray(payload)) {
    const text = payload
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join(', ');

    if (text) {
      return text;
    }
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    for (const key of ['message', 'error', 'detail', 'title']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    if (Array.isArray(record.errors)) {
      const text = record.errors
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .join(', ');

      if (text) {
        return text;
      }
    }
  }

  return fallback;
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class FetchClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(baseURL: string, auth: { username: string; password: string }, timeout = 30000) {
    this.baseURL = baseURL;
    this.timeout = timeout;

    const credentials = Buffer.from(`${auth.username}:${auth.password}`, 'utf-8').toString('base64');
    this.defaultHeaders = {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json'
    };
  }

  private async request(url: string, config: RequestConfig = {}) {
    const { method = 'GET', headers = {}, body, params, timeout = this.timeout } = config;
    let fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    if (params && Object.keys(params).length > 0) {
      const urlObj = new URL(fullUrl);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          urlObj.searchParams.append(key, String(value));
        }
      });
      fullUrl = urlObj.toString();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const requestBody = body
        ? (body instanceof FormData ? body : JSON.stringify(body))
        : undefined;

      const response = await fetch(fullUrl, {
        method,
        headers: { ...this.defaultHeaders, ...headers },
        body: requestBody,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await parseResponseBody(response);

      if (!response.ok) {
        const fallbackMessage = `HTTP ${response.status} ${response.statusText}`.trim();
        throw new Error(extractErrorMessage(data, fallbackMessage));
      }

      if (data && typeof data === 'object' && !Array.isArray(data) && 'model' in data) {
        return (data as { model: unknown }).model;
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        console.error('请求超时');
        throw new Error('请求超时');
      }

      if (error instanceof TypeError) {
        console.error('网络错误: 无法连接到服务器');
        throw new Error('网络错误: 无法连接到服务器');
      }

      console.error(`请求错误: ${error.message}`);
      throw error;
    }
  }

  async get(url: string, config?: RequestConfig) {
    return this.request(url, { ...config, method: 'GET' });
  }

  async post(url: string, data?: unknown, config?: RequestConfig) {
    return this.request(url, {
      ...config,
      method: 'POST',
      body: data,
      headers: data instanceof FormData ? {} : config?.headers
    });
  }

  async put(url: string, data?: unknown, config?: RequestConfig) {
    return this.request(url, { ...config, method: 'PUT', body: data });
  }

  async delete(url: string, config?: RequestConfig) {
    return this.request(url, { ...config, method: 'DELETE' });
  }
}

let cachedClient: FetchClient | null = null;
let cachedEnv: string | null = null;

export function createApiClient(): FetchClient {
  const { API_BASE_URL, BASIC_AUTH_USER_NAME, BASIC_AUTH_PASSWORD } = useEnv();
  const apiFullUrl = `${API_BASE_URL}/_api/v2`;
  const currentEnv = `${API_BASE_URL}-${BASIC_AUTH_USER_NAME}-${BASIC_AUTH_PASSWORD}`;

  if (cachedClient && cachedEnv === currentEnv) {
    return cachedClient;
  }

  const client = new FetchClient(
    apiFullUrl,
    {
      username: BASIC_AUTH_USER_NAME,
      password: BASIC_AUTH_PASSWORD
    },
    30000
  );

  cachedClient = client;
  cachedEnv = currentEnv;

  return client;
}

export const apiClient = new Proxy({} as any, {
  get(_target, prop) {
    const client = createApiClient();
    const value = client[prop as keyof typeof client];

    if (typeof value === 'function') {
      return value.bind(client);
    }

    return value;
  }
});

export function useUrlSiteId(url: string) {
  const { API_BASE_URL, SITE_ID } = useEnv();
  const urlObj = new URL(url, API_BASE_URL);
  urlObj.searchParams.set('SiteId', SITE_ID);
  return urlObj.toString().replace(API_BASE_URL, '');
}
