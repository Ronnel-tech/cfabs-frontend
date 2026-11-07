import { loadEnv } from 'vite';
const value = loadEnv('production', process.cwd(), 'VITE_').VITE_API_ORIGIN?.trim();
if (!value) throw new Error('Set VITE_API_ORIGIN in Vercel to your HTTPS Render backend origin before building.');
const url = new URL(value);
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('VITE_API_ORIGIN must be an HTTPS origin without /api, credentials or a path.');
console.log('Public backend origin validated.');
