export type ResourceKind = "facility" | "asset";
export type Resource = {
  id: number;
  facility_name?: string;
  asset_name?: string;
  facility_code?: string;
  asset_code?: string;
  status: string;
  description: string | null;
  building?: string | null;
  location_details?: string | null;
  capacity?: number;
  location?: string | null;
  tracking_mode?: "quantity" | "individual";
};
export type Availability = {
  available: boolean;
  available_quantity: number;
  available_instances: {
    id: number;
    asset_tag: string;
    serial_number: string | null;
  }[];
  unavailable_intervals: { start_utc: string; end_utc: string }[];
  within_operating_hours?: boolean;
  requires_schedule_review?: boolean;
  advance_booking_window: { within_limit: boolean; latest_start_date: string };
};
export const resourcePath = (kind: ResourceKind) =>
  kind === "facility" ? "facilities" : "assets";
export const resourceName = (resource: Resource) =>
  resource.facility_name || resource.asset_name || "Campus resource";
export const resourceCode = (resource: Resource) =>
  resource.facility_code || resource.asset_code || "";

export function campusToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function addDays(day: string, count: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function campusInstant(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const date = new Date(`${local}:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 16) !== local
  )
    return null;
  return `${local}:00+08:00`;
}
export function rangeError(
  kind: ResourceKind,
  start: string,
  end: string,
  now = new Date(),
) {
  const from = campusInstant(start),
    to = campusInstant(end);
  if (!from || !to) return "Choose a valid start and end date/time.";
  if (Date.parse(from) <= now.getTime())
    return "Choose a start time in the future.";
  if (Date.parse(to) <= Date.parse(from))
    return "The end must be after the start.";
  if (start.slice(0, 10) > addDays(campusToday(now), 30))
    return "Bookings may start up to 30 campus calendar days ahead.";
  if (
    kind === "facility" &&
    (start.slice(0, 10) !== end.slice(0, 10) ||
      start.slice(11) < "08:00" ||
      end.slice(11) > "17:00")
  ) {
    return "Facilities are bookable from 8 AM to 5 PM on one day.";
  }
  return "";
}
export function availabilityPath(
  kind: ResourceKind,
  id: string | number,
  start: string,
  end: string,
) {
  return `/${resourcePath(kind)}/${id}/availability?${new URLSearchParams({ start, end })}`;
}
export function availabilityReason(data: Availability) {
  if (!data.advance_booking_window.within_limit)
    return "Outside the 30-day advance booking window.";
  if (data.requires_schedule_review)
    return "This facility’s custom schedule requires coordinator review.";
  if (data.within_operating_hours === false)
    return "Outside facility operating hours.";
  return "Unavailable for this entire period. Choose another time or resource.";
}

// Calendar summaries use only the API's private-safe blocked intervals, clipped
// and merged into each campus operating day. Pending bookings never block them.
export function daySchedule(
  day: string,
  blocks: Availability["unavailable_intervals"],
  now = new Date(),
) {
  const opens = Date.parse(`${day}T08:00:00+08:00`);
  const closes = Date.parse(`${day}T17:00:00+08:00`);
  const left = Math.max(opens, Math.ceil(now.getTime() / 60_000) * 60_000);
  const sorted = blocks
    .map((block) => [
      Math.max(opens, Date.parse(block.start_utc.replace(" ", "T") + "Z")),
      Math.min(closes, Date.parse(block.end_utc.replace(" ", "T") + "Z")),
    ])
    .filter(([from, to]) => from < to)
    .sort((a, b) => a[0] - b[0]);
  let cursor = left;
  const free: [number, number][] = [];
  for (const [from, to] of sorted) {
    if (from > cursor) free.push([cursor, from]);
    cursor = Math.max(cursor, to);
  }
  if (cursor < closes) free.push([cursor, closes]);
  return free;
}
export const campusTime = (instant: number) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
export function localInput(instant: number) {
  return new Date(instant + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
