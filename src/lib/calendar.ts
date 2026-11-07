import { addDays, campusInstant, localInput } from './availability.ts';
import type { ResourceKind } from './availability';

export const calendarCategories = {
  facility_booking: 'Facility booking', asset_booking: 'Asset booking',
  facility_maintenance: 'Facility maintenance', asset_maintenance: 'Asset maintenance',
} as const;
export type CalendarCategory = keyof typeof calendarCategories;
export type CalendarRecord = {
  id: string; title: string; type: CalendarCategory; kind: ResourceKind;
  resource_id: number; resource_name: string; resource_status: string; status: string;
  start: string; end: string; scheduled_start: string; scheduled_end: string | null;
  open_ended: boolean; can_view_details: boolean; booking_id?: number;
  booking_reference?: string; description?: string; quantity_requested?: number;
};
export type CalendarFeed = { events: CalendarRecord[]; timezone: string; start: string; end: string };
export type CalendarFilters = {
  type: string; status: string; facility_id: string; asset_id: string;
  facility_category_id: string; asset_category_id: string; department_id: string;
};
export const emptyCalendarFilters: CalendarFilters = {
  type: '', status: '', facility_id: '', asset_id: '', facility_category_id: '', asset_category_id: '', department_id: '',
};
export function calendarPath(start: string, end: string, filters: CalendarFilters) {
  // FullCalendar's Date::toISOString includes milliseconds; LavaLust's existing
  // interval parser deliberately accepts timestamps at second precision.
  const params = new URLSearchParams({ start: start.replace(/\.\d{3}Z$/, 'Z'), end: end.replace(/\.\d{3}Z$/, 'Z') });
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return `/calendar/events?${params}`;
}
export function calendarRange(from: string, through: string) {
  const start = campusInstant(`${from}T00:00`), last = campusInstant(`${through}T00:00`);
  if (!start || !last || from > through || Date.parse(last) - Date.parse(start) >= 90 * 86400000) throw new Error('Choose a valid date range of at most 90 days.');
  return { start, end: `${addDays(through, 1)}T00:00:00+08:00` };
}
export function calendarSelection(start: string, end: string, allDay: boolean) {
  if (allDay) return { start: `${start.slice(0, 10)}T09:00`, end: `${start.slice(0, 10)}T10:00` };
  const left = Date.parse(start), right = Date.parse(end);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left >= right) throw new Error('Choose a valid start and end time.');
  return { start: localInput(left), end: localInput(right) };
}
export function calendarResourceLink(kind: ResourceKind, id: number, period: { start: string; end: string }) {
  if (!Number.isSafeInteger(id) || id < 1 || !campusInstant(period.start) || !campusInstant(period.end)) throw new Error('Choose a resource and valid dates.');
  return `/${kind === 'facility' ? 'facilities' : 'assets'}/${id}?${new URLSearchParams(period)}`;
}
