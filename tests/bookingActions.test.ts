import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookingActions, decisionReason } from '../src/lib/bookingActions.ts'
import type { Booking } from '../src/lib/bookings.ts'
import type { Profile } from '../src/lib/types.ts'
const now = Date.parse('2026-11-07T01:00:00Z')
const booking = { requester_id: 1, status: 'PENDING', start_datetime: '2026-11-08 01:00:00', usage_start: '2026-11-08 01:00:00' } as Booking
const user = { id: 2, permissions: ['facility_booking.approve', 'facility_booking.reject', 'facility_booking.cancel_any'] } as Profile

test('staff actions require explicit kind permissions; administrators get no implied grants', () => {
  assert.deepEqual(bookingActions('facility', booking, user, now), ['approve', 'reject', 'cancel'])
  assert.deepEqual(bookingActions('asset', booking, user, now), [])
  assert.deepEqual(bookingActions('facility', booking, { ...user, permissions: ['system.manage'] }, now), [])
})
test('owners cannot approve themselves but may cancel without a staff grant', () => {
  assert.deepEqual(bookingActions('facility', booking, { ...user, id: 1 }, now), ['reject', 'cancel'])
  assert.deepEqual(bookingActions('facility', booking, { ...user, id: 1, permissions: [] }, now), ['cancel'])
})
test('approved bookings cannot be cancelled at or after their UTC start', () => {
  const approved = { ...booking, status: 'APPROVED' }
  assert.deepEqual(bookingActions('facility', approved, user, now), ['cancel'])
  assert.deepEqual(bookingActions('facility', approved, user, Date.parse('2026-11-08T01:00:00Z')), [])
  assert.deepEqual(bookingActions('facility', booking, user, Date.parse('2026-11-09T01:00:00Z')), ['reject', 'cancel'])
})
test('any partial release or release timestamp prevents asset cancellation', () => {
  const owner = { ...user, id: 1 }
  for (const fields of [{ quantity_released: 1 }, { released_at: '2026-11-07 00:00:00' }]) {
    assert.deepEqual(bookingActions('asset', { ...booking, ...fields }, owner, now), [])
  }
  assert.deepEqual(bookingActions('asset', { ...booking, status: 'READY_FOR_RELEASE' }, owner, now), ['cancel'])
})
test('terminal and custody statuses expose no decision actions', () => {
  for (const status of ['REJECTED', 'CANCELLED', 'COMPLETED', 'PARTIALLY_RELEASED', 'RELEASED']) assert.deepEqual(bookingActions('facility', { ...booking, status }, user, now), [])
})
test('decision reasons are required, trimmed, and limited by UTF-8 bytes', () => {
  assert.equal(decisionReason('approve', ''), undefined)
  assert.equal(decisionReason('cancel', '  Plans changed  '), 'Plans changed')
  assert.throws(() => decisionReason('reject', '   '))
  assert.throws(() => decisionReason('reject', '界'.repeat(1334)))
  assert.equal(decisionReason('reject', 'x'.repeat(4000))?.length, 4000)
})
test('facility completion requires explicit approval permission, approved status and elapsed end', () => {
  const ended = { ...booking, status: 'APPROVED', start_datetime: '2026-11-06 01:00:00', end_datetime: '2026-11-07 01:00:00' }
  assert.deepEqual(bookingActions('facility', ended, user, now), ['complete'])
  assert.deepEqual(bookingActions('facility', ended, { ...user, id: 1 }, now), ['complete'])
  assert.deepEqual(bookingActions('facility', ended, user, now - 1), [])
  assert.deepEqual(bookingActions('facility', ended, { ...user, permissions: ['facility_booking.view_all'] }, now), [])
  assert.deepEqual(bookingActions('asset', ended, { ...user, permissions: ['asset_booking.approve'] }, now), [])
  for (const status of ['PENDING', 'COMPLETED', 'CANCELLED']) assert.equal(bookingActions('facility', { ...ended, status }, user, now).includes('complete'), false)
  assert.equal(decisionReason('complete', ''), undefined)
})
