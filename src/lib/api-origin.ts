export function apiOrigin(value: string | undefined, production = false): string {
  if (!value?.trim()) return '';
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('VITE_API_ORIGIN must be a valid backend origin.'); }
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('VITE_API_ORIGIN must contain only the backend origin, without /api or credentials.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && !production && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('VITE_API_ORIGIN requires HTTPS outside local development.');
  return url.origin;
}
