import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMovement, conditions, custodyActions, movementItems, movementLimit, movementPath } from '../src/lib/handovers.ts'
import type { Custody, Operation } from '../src/lib/handovers.ts'
const now = Date.parse('2026-11-07T02:00:00Z')
const permissions = ['asset_booking.release', 'asset_booking.return', 'asset.condition.manage']
const snapshot: Custody = {
  booking: { id: 1, requester_id: 8, booking_reference: 'ASSET-1', status: 'RELEASED', quantity_requested: 10, usage_start: '2026-11-07 01:00:00', expected_return: '2026-11-07 03:00:00', purpose: '', series_id: null, submitted_at: '' },
  asset_status: 'active', tracking_mode: 'quantity', reconciled: true,
  totals: { released: 6, returned: 2, lost: 1, inspection: 1 },
  unreleased_instance_ids: [7, 8], outstanding_instance_ids: [2, 3],
  inspection_holds: [{ id: 21, remaining_quantity: 1, instance_ids: [4], remarks: 'Check', created_at: '2026-11-07 01:20:00' }],
}
const fields = { quantity: '2', selected: [2], condition: 'good', remarks: '' }
const key = 'a-valid-unique-batch-key'
const build = (operation: Operation, extra = {}, state = snapshot, grants = permissions) => buildMovement(state, operation, grants, { ...fields, ...extra }, key, now)

test('batch balances distinguish unreleased, outstanding, loss, and held inspection units', () => {
  assert.equal(movementLimit(snapshot, { direction: 'release' }), 4)
  assert.equal(movementLimit(snapshot, { direction: 'return' }), 3)
  assert.equal(movementLimit(snapshot, { direction: 'inspection', source: 21 }), 1)
  assert.equal(movementLimit(snapshot, { direction: 'inspection', source: 99 }), 0)
})
test('release uses inclusive start and exclusive end; returns remain possible when overdue or asset inactive', () => {
  assert.ok(custodyActions(snapshot, permissions, Date.parse('2026-11-07T01:00:00Z')).includes('release'))
  assert.ok(!custodyActions(snapshot, permissions, Date.parse('2026-11-07T00:59:59Z')).includes('release'))
  assert.ok(!custodyActions(snapshot, permissions, Date.parse('2026-11-07T03:00:00Z')).includes('release'))
  assert.deepEqual(custodyActions({ ...snapshot, asset_status: 'inactive' }, permissions, now), ['return', 'inspection'])
  assert.deepEqual(custodyActions(snapshot, permissions, Date.parse('2026-12-01T00:00:00Z')), ['return', 'inspection'])
})
test('custody actions require explicit grants and reconciled eligible booking state', () => {
  assert.deepEqual(custodyActions(snapshot, [], now), [])
  assert.deepEqual(custodyActions({ ...snapshot, reconciled: false }, permissions, now), [])
  for (const status of ['PENDING', 'REJECTED', 'CANCELLED', 'COMPLETED']) assert.deepEqual(custodyActions({ ...snapshot, booking: { ...snapshot.booking, status } }, permissions, now), [])
})
test('partial pool payloads retain exact quantity and do not send item IDs', () => {
  assert.deepEqual(build({ direction: 'release' }), { quantity: 2, condition_status: 'good', idempotency_key: key })
  for (const quantity of ['0', '-1', '1.2', '1e1', '5', '9007199254740993']) assert.throws(() => build({ direction: 'release' }, { quantity }))
  assert.throws(() => build({ direction: 'return' }, { quantity: '4' }))
})
test('individual batch selections come from the full-ledger snapshot and cannot reuse returned items', () => {
  const state = { ...snapshot, tracking_mode: 'individual' as const }
  assert.deepEqual(movementItems(state, { direction: 'release' }), [7, 8])
  assert.deepEqual(movementItems(state, { direction: 'return' }), [2, 3])
  assert.deepEqual(movementItems(state, { direction: 'inspection', source: 21 }), [4])
  assert.deepEqual(build({ direction: 'return' }, { selected: [3, 2], quantity: '999' }, state), { quantity: 2, instance_ids: [2, 3], condition_status: 'good', idempotency_key: key })
  for (const selected of [[], [2, 2], [4], [7]]) assert.throws(() => build({ direction: 'return' }, { selected }, state))
})
test('inspection is bound to its originating return batch', () => {
  assert.equal(movementPath(1, { direction: 'inspection', source: 21 }), '/asset-handovers/21/inspect')
  assert.equal(movementPath(1, { direction: 'return' }), '/asset-bookings/1/return')
  assert.throws(() => build({ direction: 'inspection', source: 99 }, { quantity: '1' }))
  assert.throws(() => build({ direction: 'inspection', source: 21 }, { quantity: '2' }))
  assert.throws(() => build({ direction: 'inspection', source: 21 }, { quantity: '1', condition: 'lost', remarks: 'Lost' }))
})
test('damage and loss need extra permission and explanatory remarks; inspection results cannot record loss', () => {
  assert.deepEqual(conditions('return', false), ['good', 'fair', 'inspection'])
  for (const condition of ['damaged', 'lost', 'inspection']) assert.throws(() => build({ direction: 'return' }, { condition }))
  assert.throws(() => build({ direction: 'return' }, { condition: 'lost', remarks: 'Missing' }, snapshot, ['asset_booking.return']))
  assert.deepEqual(build({ direction: 'return' }, { condition: 'lost', remarks: ' Missing ' }), { quantity: 2, condition_status: 'lost', remarks: 'Missing', idempotency_key: key })
})
test('completion requires settled custody and no inspection balance, preserving a reason-only payload', () => {
  const settled = { ...snapshot, totals: { released: 6, returned: 5, lost: 1, inspection: 0 }, inspection_holds: [] }
  assert.ok(custodyActions(settled, permissions, now).includes('complete'))
  assert.deepEqual(build({ direction: 'complete' }, { remarks: ' No longer needed ' }, settled), { reason: 'No longer needed' })
  assert.throws(() => build({ direction: 'complete' }, { remarks: 'Not settled' }))
  assert.throws(() => build({ direction: 'complete' }, {}, settled))
})
test('remarks honor UTF-8 byte limits and batch references are validated', () => {
  assert.throws(() => build({ direction: 'return' }, { remarks: '界'.repeat(1334) }))
  assert.throws(() => buildMovement(snapshot, { direction: 'return' }, permissions, fields, 'short', now))
  assert.throws(() => build({ direction: 'release' }, { condition: 'damaged', remarks: 'Broken' }))
})
