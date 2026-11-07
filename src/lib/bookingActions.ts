import type { Booking } from "./bookings.ts";
import { bookingEnd, bookingStart } from "./bookings.ts";
import { utcInstant } from "./handovers.ts";
import type { ResourceKind } from "./availability.ts";
import type { Profile } from "./types.ts";

export type BookingAction = "approve" | "reject" | "cancel" | "complete";
export function bookingActions(
  kind: ResourceKind,
  booking: Booking,
  user: Profile,
  now = Date.now(),
): BookingAction[] {
  const own = Number(booking.requester_id) === Number(user.id);
  const permits = (action: string) =>
    user.permissions.includes(`${kind}_booking.${action}`);
  const actions: BookingAction[] = [];
  const start = Date.parse(
    bookingStart(booking).replace(" ", "T") +
      (/[zZ]|[+-]\d\d:\d\d$/.test(bookingStart(booking)) ? "" : "Z"),
  );
  if (booking.status === "PENDING") {
    if (!own && permits("approve") && start > now) actions.push("approve");
    if (permits("reject")) actions.push("reject");
  }
  if (
    (own || permits("cancel_any")) &&
    ["PENDING", "APPROVED", "READY_FOR_RELEASE"].includes(booking.status) &&
    (booking.status === "PENDING" || start > now) &&
    !(
      kind === "asset" &&
      (booking.released_at || Number(booking.quantity_released) > 0)
    )
  )
    actions.push("cancel");
  if (kind === "facility" && booking.status === "APPROVED" && permits("approve") && utcInstant(bookingEnd(booking)) <= now) actions.push("complete");
  return actions;
}
export function decisionReason(action: BookingAction, value: string) {
  if (action === "approve" || action === "complete") return undefined;
  const reason = value.trim();
  if (!reason) throw new Error("Enter a reason for the requester.");
  if (new TextEncoder().encode(reason).length > 4000)
    throw new Error("The reason is too long. Please shorten it.");
  return reason;
}
