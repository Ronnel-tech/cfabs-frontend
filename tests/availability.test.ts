import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, availabilityPath, campusInstant, campusToday, daySchedule, localInput, rangeError } from '../src/lib/availability.ts'

const now = new Date('2026-11-07T01:00:00Z')
test('campus dates and input conversion are independent of device timezone', () => {
  assert.equal(campusToday(new Date('2026-11-07T18:00:00Z')), '2026-11-08')
  assert.equal(campusInstant('2026-11-08T09:00'), '2026-11-08T09:00:00+08:00')
  assert.equal(localInput(Date.parse('2026-11-08T01:00:00Z')), '2026-11-08T09:00')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
})
test('invalid, impossible, empty, past, and reversed intervals are rejected', () => {
  assert.equal(campusInstant('2026-02-30T09:00'), null)
  assert.equal(campusInstant('2026-11-08T25:00'), null)
  assert.ok(rangeError('asset', '', '', now))
  assert.ok(rangeError('asset', '2026-11-07T08:00', '2026-11-07T10:00', now))
  assert.ok(rangeError('asset', '2026-11-08T10:00', '2026-11-08T09:00', now))
})
test('facilities respect inclusive opening boundaries and same-day policy', () => {
  assert.equal(rangeError('facility', '2026-11-08T08:00', '2026-11-08T17:00', now), '')
  assert.ok(rangeError('facility', '2026-11-08T07:59', '2026-11-08T17:00', now))
  assert.ok(rangeError('facility', '2026-11-08T09:00', '2026-11-08T17:01', now))
  assert.ok(rangeError('facility', '2026-11-08T09:00', '2026-11-09T10:00', now))
})
test('advance limit is inclusive by campus date and asset returns can exceed it', () => {
  assert.equal(rangeError('asset', '2026-12-07T23:59', '2027-02-01T12:00', now), '')
  assert.ok(rangeError('asset', '2026-12-08T00:00', '2026-12-08T12:00', now))
})
test('availability query preserves campus offset rather than interpreting device time', () => {
  const path = availabilityPath('asset', 7, '2026-11-08T09:00:00+08:00', '2026-11-09T10:00:00+08:00')
  const url = new URL(`http://localhost${path}`)
  assert.equal(url.pathname, '/assets/7/availability')
  assert.equal(url.searchParams.get('start'), '2026-11-08T09:00:00+08:00')
})
const minutes = (ranges: [number, number][]) => ranges.map(([from, to]) => [localInput(from).slice(11), localInput(to).slice(11)])
test('facility calendar merges adjacent/overlapping blocks and clips to campus hours', () => {
  const result = daySchedule('2026-11-08', [
    { start_utc: '2026-11-08 01:00:00', end_utc: '2026-11-08 03:00:00' },
    { start_utc: '2026-11-08 02:00:00', end_utc: '2026-11-08 04:00:00' },
    { start_utc: '2026-11-08 04:00:00', end_utc: '2026-11-08 05:00:00' },
    { start_utc: '2026-11-08 08:00:00', end_utc: '2026-11-09 08:00:00' },
  ], now)
  assert.deepEqual(minutes(result), [['08:00', '09:00'], ['13:00', '16:00']])
})
test('full-day and unfinished overdue maintenance expose no free time', () => {
  assert.deepEqual(daySchedule('2026-11-08', [{ start_utc: '2026-11-01 00:00:00', end_utc: '9999-12-31 23:59:59' }], now), [])
})
test('calendar excludes elapsed minutes today and all time after closing', () => {
  assert.deepEqual(minutes(daySchedule('2026-11-07', [], new Date('2026-11-07T01:30:15Z'))), [['09:31', '17:00']])
  assert.deepEqual(daySchedule('2026-11-07', [], new Date('2026-11-07T09:00:00Z')), [])
})
