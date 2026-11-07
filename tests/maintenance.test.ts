import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maintenanceActions, maintenancePayload, maintenancePhase } from '../src/lib/maintenance.ts'
import type { MaintenanceRecord, MaintenanceResource } from '../src/lib/maintenance.ts'
const now = Date.parse('2026-11-07T04:00:00Z')
const facility: MaintenanceResource = { id: 1, facility_name: 'Hall', status: 'active', description: null }
const pool: MaintenanceResource = { id: 2, asset_name: 'Chairs', status: 'active', description: null, tracking_mode: 'quantity', usable_quantity: 10 }
const values = { start: '2026-11-07T10:00', end: '2026-11-07T14:00', reason: 'Scheduled work', quantity: '3', item_id: '' }
const record: MaintenanceRecord = { id: 1, facility_id: 1, start_datetime: '2026-11-07 02:00:00', end_datetime: '2026-11-07 06:00:00', status: 'scheduled', reason: 'Work', completed_by: null }
test('maintenance accepts already-started work with campus timezone offsets', () => {
  assert.deepEqual(maintenancePayload('facility', facility, values, [], now), { facility_id: 1, start_datetime: '2026-11-07T10:00:00+08:00', end_datetime: '2026-11-07T14:00:00+08:00', reason: 'Scheduled work' })
})
test('maintenance does not inherit booking hours or the 30-day booking window', () => {
  const payload = maintenancePayload('facility', facility, { ...values, start: '2027-01-10T01:00', end: '2027-01-12T23:00' }, [], now)
  assert.equal(payload.end_datetime, '2027-01-12T23:00:00+08:00')
})
test('facilities need a valid future end after start; impossible dates are rejected', () => {
  for (const end of ['', '2026-11-07T09:00', '2026-11-07T12:00', '2026-02-30T14:00']) assert.throws(() => maintenancePayload('facility', facility, { ...values, end }, [], now))
  assert.throws(() => maintenancePayload('facility', facility, { ...values, start: 'invalid' }, [], now))
})
test('asset maintenance may be open-ended and omits completion entirely', () => {
  const data = maintenancePayload('asset', pool, { ...values, end: '' }, [], now)
  assert.equal('expected_completion' in data, false)
  assert.equal(data.quantity_affected, 3)
  assert.equal('asset_instance_id' in data, false)
})
test('pool quantities must fit usable stock with whole positive counts', () => {
  for (const quantity of ['0', '-1', '1.5', '11', '4294967296', '']) assert.throws(() => maintenancePayload('asset', pool, { ...values, quantity }, [], now))
  assert.throws(() => maintenancePayload('asset', { ...pool, usable_quantity: 0 }, values, [], now))
})
test('individual work targets a current item and derives quantity one', () => {
  const resource = { ...pool, tracking_mode: 'individual' as const }
  const items = [{ id: 9, asset_tag: 'P9', serial_number: null, status: 'inactive', condition_status: 'damaged' }]
  const data = maintenancePayload('asset', resource, { ...values, item_id: '9', quantity: '10' }, items, now)
  assert.equal(data.asset_instance_id, 9)
  assert.equal(data.quantity_affected, 1)
  for (const item_id of ['', '10', '9.0']) assert.throws(() => maintenancePayload('asset', resource, { ...values, item_id }, items, now))
})
test('missing resources, unknown tracking and empty/oversized reasons cannot be reviewed', () => {
  assert.throws(() => maintenancePayload('facility', undefined, values, [], now))
  assert.throws(() => maintenancePayload('asset', { ...pool, tracking_mode: undefined }, values, [], now))
  for (const reason of [' ', 'é'.repeat(2001)]) assert.throws(() => maintenancePayload('facility', facility, { ...values, reason }, [], now))
  assert.equal(maintenancePayload('facility', facility, { ...values, reason: 'é'.repeat(2000) }, [], now).reason.length, 2000)
})
test('close actions require permission and explicit open status; future work cannot complete', () => {
  assert.deepEqual(maintenanceActions(record, false, now), [])
  assert.deepEqual(maintenanceActions(record, true, now), ['complete', 'cancel'])
  assert.deepEqual(maintenanceActions({ ...record, start_datetime: '2026-11-07 04:00:01' }, true, now), ['cancel'])
  assert.deepEqual(maintenanceActions({ ...record, start_datetime: '2026-11-07 04:00:00' }, true, now), ['complete', 'cancel'])
  for (const status of ['completed', 'cancelled']) assert.deepEqual(maintenanceActions({ ...record, status }, true, now), [])
})
test('overdue and open-ended work remain active until explicitly closed', () => {
  assert.equal(maintenancePhase('facility', record, now), 'Currently active')
  assert.equal(maintenancePhase('facility', { ...record, end_datetime: '2026-11-07 04:00:00' }, now), 'Overdue · still blocking')
  assert.equal(maintenancePhase('asset', { ...record, expected_completion: null }, now), 'Currently active')
  assert.equal(maintenancePhase('facility', { ...record, start_datetime: '2026-11-08 02:00:00' }, now), 'Scheduled')
  assert.equal(maintenancePhase('facility', { ...record, status: 'completed' }, now), 'completed')
})
