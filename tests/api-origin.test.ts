import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiOrigin } from '../src/lib/api-origin.ts';
test('local development keeps the Vite proxy; deployment uses the exact Render origin', () => {
  assert.equal(apiOrigin(undefined), '');
  assert.equal(apiOrigin('https://cfabs.onrender.com/', true), 'https://cfabs.onrender.com');
  assert.equal(apiOrigin('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
});
test('API origins reject credentials, paths, query strings and insecure production URLs', () => {
  for (const url of ['https://u:p@example.com', 'https://example.com/api', 'https://example.com?key=secret', 'https://example.com/#token', 'javascript:alert(1)', 'http://example.com', 'not-a-url']) assert.throws(() => apiOrigin(url, true));
  assert.throws(() => apiOrigin('http://localhost:3000', true));
});
