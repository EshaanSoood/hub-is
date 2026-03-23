import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const HUB_API_BASE_URL = 'https://api.eshaansood.org';

export interface HubEnvelope<T> {
  ok: boolean;
  data: T | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
}

const parseEnvLine = (line: string): { key: string; value: string } | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separator = trimmed.indexOf('=');
  if (separator <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
};

const normalizePath = (path: string): string => {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
};

export const loadTokenFromLocalEnv = async (tokenName = 'TOKEN_A'): Promise<string> => {
  const tokenFilePath = fileURLToPath(new URL('../.env.tokens.local', import.meta.url));
  let raw: string;
  try {
    raw = await readFile(tokenFilePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Cannot read ${tokenFilePath}. Run e2e/scripts/mint-tokens.mjs first.`);
    }
    throw error;
  }

  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }
    if (parsed.key === tokenName) {
      const token = parsed.value.trim();
      if (!token) {
        break;
      }
      return token;
    }
  }

  throw new Error(`Missing ${tokenName} in ${tokenFilePath}. Run e2e/scripts/mint-tokens.mjs first.`);
};

export class HubApiClient {
  constructor(private baseUrl: string, private token: string) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${this.token}`);
    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return fetch(new URL(normalizePath(path), this.baseUrl).toString(), {
      ...init,
      headers,
    });
  }

  async get(path: string): Promise<Response> {
    return this.request(path, { method: 'GET' });
  }

  async post(path: string, body: Record<string, unknown>): Promise<Response> {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  }

  async patch(path: string, body: Record<string, unknown>): Promise<Response> {
    return this.request(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async delete(path: string): Promise<Response> {
    return this.request(path, { method: 'DELETE' });
  }
}
