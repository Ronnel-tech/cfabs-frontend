import { addDays, campusInstant, rangeError } from "./availability.ts";
import { ApiError } from "./api.ts";
import type { Availability, Resource, ResourceKind } from "./availability";

export type Period = { start: string; end: string };
export type Repeat = {
  frequency: "once" | "daily" | "weekly";
  count: number;
  interval: number;
};
export type Booking = {
  id: number;
  booking_reference: string;
  requester_id: number;
  status: string;
  facility_id?: number;
  asset_id?: number;
  start_datetime?: string;
  end_datetime?: string;
  usage_start?: string;
  expected_return?: string;
  purpose: string;
  activity_name?: string;
  participants_count?: number;
  quantity_requested?: number;
  quantity_released?: number | null;
  released_at?: string | null;
  quantity_returned?: number | null;
  quantity_lost?: number;
  instance_ids?: number[];
  selected_items?: {
    id: number;
    asset_tag: string;
    serial_number: string | null;
  }[];
  rejection_reason?: string | null;
  rejection_source?: string | null;
  cancellation_reason?: string | null;
  series_id: number | null;
  submitted_at: string;
  completed_at?: string | null;
};
export type SeriesResult = {
  series: {
    id: number;
    requester_id: number;
    resource_kind: ResourceKind;
    frequency: string;
    occurrence_count: number;
    interval_count: number;
  };
  bookings: Booking[];
  replayed?: boolean;
};
export const bookingPath = (kind: ResourceKind) => `${kind}-bookings`;
export const bookingStart = (booking: Booking) =>
  booking.start_datetime || booking.usage_start || "";
export const bookingEnd = (booking: Booking) =>
  booking.end_datetime || booking.expected_return || "";
export const statusLabel = (status: string) =>
  status.toLowerCase().replaceAll("_", " ");
export const requestLink = (kind: ResourceKind, id: number) =>
  `/requests/${kind}/${id}`;

export function repeatPeriods(
  kind: ResourceKind,
  period: Period,
  repeat: Repeat,
  now = new Date(),
): Period[] {
  const count = repeat.frequency === "once" ? 1 : repeat.count;
  if (
    !["once", "daily", "weekly"].includes(repeat.frequency) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 30 ||
    (repeat.frequency !== "once" &&
      (count < 2 ||
        !Number.isInteger(repeat.interval) ||
        repeat.interval < 1 ||
        repeat.interval > 4))
  ) {
    throw new Error("Use 2–30 occurrences, every 1–4 days or weeks.");
  }
  const initialError = rangeError(kind, period.start, period.end, now);
  if (initialError) throw new Error(initialError);
  return Array.from({ length: count }, (_, index) => {
    const offset =
      index *
      (repeat.frequency === "weekly" ? 7 : 1) *
      (repeat.frequency === "once" ? 0 : repeat.interval);
    const occurrence = {
      start: `${addDays(period.start.slice(0, 10), offset)}${period.start.slice(10)}`,
      end: `${addDays(period.end.slice(0, 10), offset)}${period.end.slice(10)}`,
    };
    const error = rangeError(kind, occurrence.start, occurrence.end, now);
    if (error) throw new Error(`Occurrence ${index + 1}: ${error}`);
    return occurrence;
  });
}

export type RequestFields = {
  purpose: string;
  activity: string;
  participants: string;
  quantity: string;
  selected: number[];
};
function text(value: string, maximum: number, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Enter ${label.toLowerCase()}.`);
  if (new TextEncoder().encode(trimmed).length > maximum)
    throw new Error(`${label} is too long. Please shorten it.`);
  return trimmed;
}
function positive(value: string, label: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new Error(`${label} must be a positive whole number.`);
  return Number(value);
}
export function buildBooking(
  kind: ResourceKind,
  resource: Resource,
  period: Period,
  fields: RequestFields,
  availability: Availability,
) {
  if (resource.status !== "active" || !availability.available)
    throw new Error(
      "This resource is no longer available for the selected period. Check the dates above.",
    );
  const common = { purpose: text(fields.purpose, 4000, "Purpose") };
  if (kind === "facility") {
    const participants = positive(fields.participants, "Participant count");
    if (participants > Number(resource.capacity))
      throw new Error(
        `This facility holds at most ${resource.capacity} people.`,
      );
    return {
      ...common,
      facility_id: Number(resource.id),
      start_datetime: campusInstant(period.start),
      end_datetime: campusInstant(period.end),
      activity_name: text(fields.activity, 180, "Activity name"),
      participants_count: participants,
    };
  }
  const quantity =
    resource.tracking_mode === "individual"
      ? fields.selected.length
      : positive(fields.quantity, "Quantity");
  if (quantity < 1 || quantity > Number(availability.available_quantity))
    throw new Error("Choose a quantity within the currently available stock.");
  if (
    resource.tracking_mode === "individual" &&
    (quantity > 1000 ||
      new Set(fields.selected).size !== quantity ||
      fields.selected.some(
        (id) =>
          !availability.available_instances.some(
            (item) => Number(item.id) === id,
          ),
      ))
  ) {
    throw new Error(
      "A selected asset is no longer available. Clear the selection and choose available items again.",
    );
  }
  return {
    ...common,
    asset_id: Number(resource.id),
    usage_start: campusInstant(period.start),
    expected_return: campusInstant(period.end),
    quantity_requested: quantity,
    ...(resource.tracking_mode === "individual"
      ? { instance_ids: [...fields.selected].sort((a, b) => a - b) }
      : {}),
  };
}

export type Attempt = {
  path: string;
  body: Record<string, unknown>;
  recurring: boolean;
};
export function submissionUncertain(error: unknown, recurring: boolean) {
  return (
    !(error instanceof ApiError) ||
    error.status === 0 ||
    error.status >= 500 ||
    (recurring &&
      error.status === 409 &&
      error.message.includes("still processing"))
  );
}
// Reuse only the exact series payload/key after an uncertain response. Singleton
// creation has no server idempotency contract and must not retry automatically.
export function createAttempt(
  kind: ResourceKind,
  booking: Record<string, unknown>,
  repeat: Repeat,
  key: string,
): Attempt {
  if (repeat.frequency === "once")
    return { path: `/${bookingPath(kind)}`, body: booking, recurring: false };
  return {
    path: `/${kind}-booking-series`,
    body: {
      booking,
      recurrence: {
        frequency: repeat.frequency,
        count: repeat.count,
        interval: repeat.interval,
      },
      idempotency_key: key,
    },
    recurring: true,
  };
}
