declare global {
  interface Window {
    API_BASE_URL?: string;
  }
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.API_BASE_URL) {
    return window.API_BASE_URL;
  }
  
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  return '';
}

export function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  if (baseUrl) {
    return `${baseUrl}${path}`;
  }
  return path;
}
