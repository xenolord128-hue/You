function normalizeApiBase(raw?: string): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.origin + parsed.pathname.replace(/\/+$/, '');
    }
  } catch {
    // ignore invalid URL
  }
  return '';
}

const API_BASE_URL = normalizeApiBase(
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL
);

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function apiUrl(path: string): string {
  if (!path) return API_BASE_URL || '/';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}
