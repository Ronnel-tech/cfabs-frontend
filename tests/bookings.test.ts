import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBooking, createAttempt, repeatPeriods, submissionUncertain } from '../src/lib/bookings.ts'
import { ApiError } from '../src/lib/api.ts'
import type { RequestFields } from '../src/lib/bookings.ts'
import type { Availability, Resource } from '../src/lib/availability.ts'

const now = new Date('2026-11-07T01:00:00Z')
const period = { start: '2026-11-08T09:00', end: '2026-11-08T10:00' }
const fields: RequestFields = { activity: ' Planning ', purpose: ' Department meeting ', participants: '10', quantity: '2', selected: [2, 1] }
const facility: Resource = { id: 7, status: 'active', capacity: 20, description: null }
const pool: Resource = { id: 8, status: 'active', tracking_mode: 'quantity', description: null }
const individual: Resource = { ...pool, tracking_mode: 'individual' }
const available: Availability = { available: true, available_quantity: 4, available_instances: [{ id: 1, asset_tag: 'ONE', serial_number: null }, { id: 2, asset_tag: 'TWO', serial_number: null }], unavailable_intervals: [], advance_booking_window: { within_limit: true, latest_start_date: '2026-12-07' } }

test('weekly recurrence preserves campus wall times and crosses a year boundary', () => {
  const dates = repeatPeriods('facility', { start: '2026-12-28T09:00', end: '2026-12-28T10:00' }, { frequency: 'weekly', count: 3, interval: 1 }, new Date('2026-12-20T00:00:00Z'))
  assert.deepEqual(dates.map(date => date.start), ['2026-12-28T09:00', '2027-01-04T09:00', '2027-01-11T09:00'])
})
test('every occurrence must fit the inclusive 30-campus-day start window', () => {
  assert.equal(repeatPeriods('facility', { start: '2026-12-06T09:00', end: '2026-12-06T10:00' }, { frequency: 'daily', count: 2, interval: 1 }, now).length, 2)
  assert.throws(() => repeatPeriods('facility', { start: '2026-12-07T09:00', end: '2026-12-07T10:00' }, { frequency: 'daily', count: 2, interval: 1 }, now), /Occurrence 2/)
})
test('asset recurrence preserves long borrowing duration without capping the return', () => {
  const dates = repeatPeriods('asset', { start: period.start, end: '2027-01-08T10:00' }, { frequency: 'weekly', count: 2, interval: 1 }, now)
  assert.equal(dates[1].end, '2027-01-15T10:00')
})
test('recurrence count and interval are finite integers within API limits', () => {
  for (const rule of [{ frequency: 'daily' as const, count: 1, interval: 1 }, { frequency: 'weekly' as const, count: 31, interval: 1 }, { frequency: 'weekly' as const, count: 2, interval: 0 }, { frequency: 'daily' as const, count: 2, interval: 1.5 }]) {
    assert.throws(() => repeatPeriods('asset', period, rule, now))
  }
})
test('facility requests send explicit campus offsets and enforce room capacity', () => {
  const body = buildBooking('facility', facility, period, fields, available)
  assert.equal(body.purpose, 'Department meeting')
  assert.equal(body.start_datetime, '2026-11-08T09:00:00+08:00')
  assert.equal(body.participants_count, 10)
  assert.throws(() => buildBooking('facility', facility, period, { ...fields, participants: '21' }, available), /at most 20/)
})
test('quantities cannot be fractional, negative, zero, unsafe, or exceed stock', () => {
  for (const quantity of ['1.5', '-1', '0', '9007199254740992', '5']) assert.throws(() => buildBooking('asset', pool, period, { ...fields, quantity }, available))
  const body = buildBooking('asset', pool, period, fields, available)
  assert.equal(body.quantity_requested, 2)
  assert.equal('instance_ids' in body, false)
})
test('specific selections derive quantity and reject duplicates or stale items', () => {
  const body = buildBooking('asset', individual, period, fields, available)
  assert.equal(body.quantity_requested, 2)
  assert.deepEqual(body.instance_ids, [1, 2])
  for (const selected of [[], [1, 1], [3]]) assert.throws(() => buildBooking('asset', individual, period, { ...fields, selected }, available))
})
test('a changed resource or failed availability cannot be submitted', () => {
  assert.throws(() => buildBooking('asset', { ...pool, status: 'inactive' }, period, fields, available))
  assert.throws(() => buildBooking('asset', pool, period, fields, { ...available, available: false }))
})
test('required text honors backend byte limits for multibyte content', () => {
  assert.throws(() => buildBooking('facility', facility, period, { ...fields, purpose: '   ' }, available))
  assert.throws(() => buildBooking('facility', facility, period, { ...fields, activity: '界'.repeat(61) }, available))
  assert.throws(() => buildBooking('asset', pool, period, { ...fields, purpose: '界'.repeat(1334) }, available))
})
test('series transport retains the exact submitted payload and idempotency key', () => {
  const body = buildBooking('asset', individual, period, fields, available)
  const attempt = createAttempt('asset', body, { frequency: 'weekly', count: 3, interval: 1 }, 'fixed-retry-key-12345')
  assert.equal(attempt.path, '/asset-booking-series')
  assert.deepEqual(attempt.body, { booking: body, recurrence: { frequency: 'weekly', count: 3, interval: 1 }, idempotency_key: 'fixed-retry-key-12345' })
  const single = createAttempt('asset', body, { frequency: 'once', count: 3, interval: 1 }, 'unused-single-key')
  assert.equal(single.path, '/asset-bookings')
  assert.equal('recurrence' in single.body, false)
  assert.equal('idempotency_key' in single.body, false)
})

test('unknown outcomes and processing locks retain the original series for safe retries', () => {
  assert.equal(submissionUncertain(new ApiError('Offline', 0), false), true)
  assert.equal(submissionUncertain(new ApiError('Server failed', 500), true), true)
  assert.equal(submissionUncertain(new ApiError('This recurring request is still processing; retry with the same key.', 409), true), true)
  assert.equal(submissionUncertain(new ApiError('Occurrence 2 is unavailable', 409), true), false)
  assert.equal(submissionUncertain(new ApiError('Purpose is required', 422), false), false)
})
