import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditParams, auditValues, emptyAuditFilters } from '../src/lib/audit.ts'
test('audit filters use paired campus timestamps and exact actor/entity/action values', () => {
  const params = new URLSearchParams(auditParams({ start: '2026-11-01T00:00', end: '2026-12-01T00:00', actor_user_id: '7', entity_type: ' facility_booking ', action: 'facility_booking.completed' }))
  assert.equal(params.get('start'), '2026-11-01T00:00:00+08:00')
  assert.equal(params.get('actor_user_id'), '7')
  assert.equal(params.get('entity_type'), 'facility_booking')
  assert.equal(params.has('requester_id'), false)
  assert.equal(auditParams(emptyAuditFilters()), '')
})
test('audit filters reject malformed boundaries, IDs and oversized UTF-8 text', () => {
  for (const change of [{ start: '2026-11-01T00:00' }, { actor_user_id: '1.5' }, { actor_user_id: '-1' }, { entity_type: 'é'.repeat(41) }, { action: 'é'.repeat(51) }]) assert.throws(() => auditParams({ ...emptyAuditFilters(), ...change }))
})
test('audit values preserve valid recorded data and handle missing/legacy text', () => {
  assert.equal(auditValues(null), 'No recorded values')
  assert.equal(auditValues('{"status":"COMPLETED"}'), '{\n  "status": "COMPLETED"\n}')
  assert.equal(auditValues('Legacy note'), 'Legacy note')
})
