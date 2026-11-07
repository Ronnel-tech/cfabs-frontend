import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate } from '@fullcalendar/react';
import { calendarPath, calendarRange, calendarResourceLink, calendarSelection, emptyCalendarFilters } from '../src/lib/calendar.ts';
import { rangeError } from '../src/lib/availability.ts';

test('calendar feed sends bounded UTC dates and only selected filters', () => {
  const path = calendarPath('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', { ...emptyCalendarFilters, type: 'facility_booking', facility_id: '7', department_id: '2' });
  const url = new URL(path, 'https://campus.invalid');
  assert.equal(url.pathname, '/calendar/events');
  assert.equal(url.searchParams.get('start'), '2026-11-01T00:00:00Z');
  assert.equal(url.searchParams.get('facility_id'), '7');
  assert.equal(url.searchParams.get('department_id'), '2');
  assert.equal(url.searchParams.has('status'), false);
  assert.equal(url.searchParams.has('asset_id'), false);
  const nativeDates = new URL(calendarPath('2026-11-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z', emptyCalendarFilters), 'https://campus.invalid');
  assert.equal(nativeDates.searchParams.get('start'), '2026-11-01T00:00:00Z');
  assert.equal(nativeDates.searchParams.get('end'), '2026-12-01T00:00:00Z');
});
test('calendar selections use campus time across UTC and offset inputs', () => {
  const expected = { start: '2030-11-10T09:00', end: '2030-11-10T10:00' };
  assert.deepEqual(calendarSelection('2030-11-10T01:00:00Z', '2030-11-10T02:00:00Z', false), expected);
  assert.deepEqual(calendarSelection('2030-11-10T09:00:00+08:00', '2030-11-10T10:00:00+08:00', false), expected);
  assert.deepEqual(calendarSelection('2030-11-10', '2030-11-12', true), expected);
});
test('UTC midnight boundaries become the correct campus day', () => {
  assert.deepEqual(calendarSelection('2030-11-09T16:30:00Z', '2030-11-09T17:30:00Z', false), { start: '2030-11-10T00:30', end: '2030-11-10T01:30' });
  assert.throws(() => calendarSelection('bad', 'bad', false));
  assert.throws(() => calendarSelection('2030-11-10T02:00:00Z', '2030-11-10T01:00:00Z', false));
});
test('the installed FullCalendar formatter resolves Asia/Manila independently of the device zone', () => {
  const formatted = formatDate('2030-11-10T01:00:00Z', { timeZone: 'Asia/Manila', locale: 'en', hour: 'numeric', minute: '2-digit' });
  assert.match(formatted, /9:00/);
});
test('resource links preserve selected times and contain no credentials', () => {
  const path = calendarResourceLink('asset', 42, { start: '2030-11-10T09:00', end: '2030-11-13T17:00' });
  const url = new URL(path, 'https://campus.invalid');
  assert.equal(url.pathname, '/assets/42');
  assert.equal(url.searchParams.get('end'), '2030-11-13T17:00');
  assert.deepEqual([...url.searchParams.keys()], ['start', 'end']);
  assert.throws(() => calendarResourceLink('facility', 0, { start: '', end: '' }));
});
test('calendar choices still use existing facility hours and asset duration rules', () => {
  const now = new Date('2030-11-09T01:00:00Z');
  assert.match(rangeError('facility', '2030-11-10T07:00', '2030-11-10T09:00', now), /8 AM/);
  assert.match(rangeError('facility', '2030-11-10T09:00', '2030-11-11T10:00', now), /one day/);
  assert.equal(rangeError('asset', '2030-11-10T09:00', '2031-01-11T10:00', now), '');
});
test('custom ranges include the through date and enforce the 90-day fetch bound', () => {
  assert.deepEqual(calendarRange('2030-11-09', '2030-11-09'), { start: '2030-11-09T00:00:00+08:00', end: '2030-11-10T00:00:00+08:00' });
  assert.equal(calendarRange('2030-01-01', '2030-03-31').end, '2030-04-01T00:00:00+08:00');
  assert.throws(() => calendarRange('2030-01-01', '2030-04-01'));
  assert.throws(() => calendarRange('2030-02-30', '2030-03-01'));
  assert.throws(() => calendarRange('2030-11-10', '2030-11-09'));
});
