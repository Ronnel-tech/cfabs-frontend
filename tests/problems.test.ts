import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemActions, problemAdmin, problemChange, problemSubmission, type Problem } from '../src/lib/problems.ts';
import { problemQrPath } from '../src/lib/qr.ts';
import { createApi } from '../src/lib/api.ts';
const row = { id: 1, assigned_to: 7, maintenance_id: null, status: 'assigned', version: 2 } as Problem;
const permissions = ['asset.maintenance.manage'];
const user = (id: number, role_name: string) => ({ id, role_name, permissions });
test('only system administrators review and assign while assigned staff can work', () => {
  assert.equal(problemAdmin('booking_admin', permissions), false);
  assert.equal(problemAdmin('system_admin', []), false);
  assert.deepEqual(problemActions(row, user(8, 'system_admin')), ['assign', 'reject', 'start']);
  assert.deepEqual(problemActions(row, user(7, 'asset_custodian')), ['start']);
  assert.deepEqual(problemActions(row, user(9, 'asset_custodian')), []);
  assert.deepEqual(problemActions({ ...row, status: 'in_progress', maintenance_id: 5 }, user(7, 'asset_custodian')), ['progress', 'resolve']);
  assert.deepEqual(problemActions({ ...row, status: 'resolved' }, user(8, 'system_admin')), []);
});
test('report updates include exact version and validate notes and custodian IDs', () => {
  assert.deepEqual(problemChange(row, 'assign', { assigned_to: '7', notes: ' Inspect ', end: '' }), { expected_version: 2, assigned_to: 7, notes: 'Inspect' });
  assert.deepEqual(problemChange(row, 'start', { assigned_to: '', notes: '', end: '' }), { expected_version: 2 });
  assert.throws(() => problemChange(row, 'resolve', { assigned_to: '', notes: '', end: '' }));
  assert.throws(() => problemChange(row, 'assign', { assigned_to: '-1', notes: 'Inspect', end: '' }));
  assert.throws(() => problemChange(row, 'start', { assigned_to: '', notes: '', end: '2020-01-01T10:00' }));
});
test('submission validates quantities and exact individual item identification', () => {
  const fields = { item: '', quantity: '2', description: ' Loose joints ', photo: '', qr: '' };
  const pool = { id: 5, tracking_mode: 'quantity', total_quantity: 10, status: 'active' };
  assert.deepEqual(problemSubmission(pool, fields, 'stable-reference'), { asset_id: 5, quantity_affected: 2, description: 'Loose joints', idempotency_key: 'stable-reference' });
  assert.throws(() => problemSubmission(pool, { ...fields, quantity: '11' }, 'key'));
  assert.throws(() => problemSubmission(pool, { ...fields, description: 'é'.repeat(2001) }, 'key'));
  const individual = { ...pool, tracking_mode: 'individual' };
  assert.throws(() => problemSubmission(individual, fields, 'key'));
  assert.equal(problemSubmission(individual, { ...fields, item: '9' }, 'key').asset_instance_id, 9);
  assert.equal(problemSubmission(individual, { ...fields, item: '9' }, 'key').quantity_affected, 1);
});
test('QR reporting carries the pool or specific item without exposing credentials', () => {
  const label = { identifier: 'a'.repeat(48), resource: { kind: 'asset-instance', id: 9, asset_id: 5 } } as Parameters<typeof problemQrPath>[0];
  const params = new URLSearchParams(problemQrPath(label).split('?')[1]);
  assert.equal(params.get('asset_instance_id'), '9'); assert.equal(params.get('asset_id'), '5'); assert.equal(params.get('qr_identifier'), 'a'.repeat(48));
  assert.equal(new URLSearchParams(problemQrPath({ ...label, resource: { ...label.resource, kind: 'asset' } }).split('?')[1]).has('asset_instance_id'), false);
});
test('private photos use the authenticated binary helper with no bearer in URL', async () => {
  const client = createApi(async (path, init) => { assert.equal(String(path), '/api/asset-problem-reports/1/photo'); assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer private'); assert.equal(new Headers(init?.headers).get('Accept'), 'image/jpeg'); return new Response('jpeg', { headers: { 'Content-Type': 'image/jpeg' } }); });
  client.setTokens({ access_token: 'private', refresh_token: 'refresh' });
  assert.equal(await (await client.download('/asset-problem-reports/1/photo', undefined, 'jpeg')).text(), 'jpeg');
});
