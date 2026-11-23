import { auth } from '../lib/firebase';
import { apiUrl } from '../lib/api';

export interface MysqlTestResponse {
  ok: boolean;
  connected: boolean;
  message: string;
}

export interface MysqlRecord<T = Record<string, unknown>> {
  id: string;
  collection: string;
  data: T;
  createdAt: string;
  updatedAt: string;
}

async function buildAuthorizedHeaders(includeContentType = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  await auth.authStateReady();
  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) {
        headers['X-Firebase-Id-Token'] = idToken;
      }
    } catch {
      // Proceed; backend enforces authentication
    }
  }

  return headers;
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    throw new Error(`Unexpected server response (${res.status}).`);
  }
  const body = (await res.json()) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(body.error || body.message || `Request failed (${res.status}).`);
  }
  return body;
}

export async function testMysqlDatabaseConnection(): Promise<MysqlTestResponse> {
  const res = await fetch(apiUrl('/api/mysql/test'), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    return {
      ok: false,
      connected: false,
      message: 'Backend API endpoint /api/mysql/test is not reachable on this host.',
    };
  }
  return (await res.json()) as MysqlTestResponse;
}

export async function listMysqlRecords<T = Record<string, unknown>>(
  collection: string,
  limit = 100,
  offset = 0
): Promise<MysqlRecord<T>[]> {
  const headers = await buildAuthorizedHeaders(false);
  const res = await fetch(
    apiUrl(
      `/api/mysql/records/${encodeURIComponent(collection)}?limit=${encodeURIComponent(
        String(limit)
      )}&offset=${encodeURIComponent(String(offset))}`
    ),
    {
      method: 'GET',
      credentials: 'include',
      headers,
      cache: 'no-store',
    }
  );
  const payload = await parseJsonResponse<{ records?: MysqlRecord<T>[] }>(res);
  return Array.isArray(payload.records) ? payload.records : [];
}

export async function getMysqlRecord<T = Record<string, unknown>>(
  collection: string,
  id: string
): Promise<MysqlRecord<T> | null> {
  const headers = await buildAuthorizedHeaders(false);
  const res = await fetch(
    apiUrl(`/api/mysql/records/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`),
    {
      method: 'GET',
      credentials: 'include',
      headers,
      cache: 'no-store',
    }
  );
  if (res.status === 404) return null;
  const payload = await parseJsonResponse<{ record?: MysqlRecord<T> }>(res);
  return payload.record || null;
}

export async function saveMysqlRecord<T = Record<string, unknown>>(
  collection: string,
  id: string,
  data: T
): Promise<MysqlRecord<T>> {
  const headers = await buildAuthorizedHeaders(true);
  const res = await fetch(
    apiUrl(`/api/mysql/records/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`),
    {
      method: 'PUT',
      credentials: 'include',
      headers,
      body: JSON.stringify({ data }),
    }
  );
  const payload = await parseJsonResponse<{ record: MysqlRecord<T> }>(res);
  return payload.record;
}

export async function createMysqlRecord<T = Record<string, unknown>>(
  collection: string,
  data: T,
  id?: string
): Promise<MysqlRecord<T>> {
  const headers = await buildAuthorizedHeaders(true);
  const res = await fetch(apiUrl(`/api/mysql/records/${encodeURIComponent(collection)}`), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ id, data }),
  });
  const payload = await parseJsonResponse<{ record: MysqlRecord<T> }>(res);
  return payload.record;
}

export async function deleteMysqlRecord(collection: string, id: string): Promise<boolean> {
  const headers = await buildAuthorizedHeaders(false);
  const res = await fetch(
    apiUrl(`/api/mysql/records/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`),
    {
      method: 'DELETE',
      credentials: 'include',
      headers,
    }
  );
  const payload = await parseJsonResponse<{ deleted?: boolean }>(res);
  return Boolean(payload.deleted);
}
