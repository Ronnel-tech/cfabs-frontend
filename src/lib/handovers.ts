import type { Booking } from "./bookings.ts";

export type Handover = {
  id: number;
  direction: "release" | "return" | "loss" | "inspection";
  quantity: number;
  condition_status: string;
  remarks: string | null;
  created_at: string;
  source_handover_id: number | null;
  instance_ids: number[];
};
export type Hold = {
  id: number;
  remaining_quantity: number;
  instance_ids: number[];
  remarks: string | null;
  created_at: string;
};
export type Custody = {
  booking: Booking;
  tracking_mode: "quantity" | "individual";
  asset_status: string;
  reconciled: boolean;
  totals: {
    released: number;
    returned: number;
    lost: number;
    inspection: number;
  };
  unreleased_instance_ids: number[];
  outstanding_instance_ids: number[];
  inspection_holds: Hold[];
};
export type Movement = "release" | "return" | "inspection" | "complete";
export type Operation = { direction: Movement; source?: number };
export const utcInstant = (value = "") =>
  Date.parse(
    value.replace(" ", "T") + (/[zZ]|[+-]\d\d:\d\d$/.test(value) ? "" : "Z"),
  );
export function movementLimit(snapshot: Custody, operation: Operation) {
  if (operation.direction === "release")
    return Math.max(
      0,
      Number(snapshot.booking.quantity_requested) -
        Number(snapshot.totals.released),
    );
  if (operation.direction === "return")
    return Math.max(
      0,
      Number(snapshot.totals.released) -
        Number(snapshot.totals.returned) -
        Number(snapshot.totals.lost),
    );
  return Number(
    snapshot.inspection_holds.find(
      (hold) => Number(hold.id) === operation.source,
    )?.remaining_quantity ?? 0,
  );
}
export function movementItems(
  snapshot: Custody,
  operation: Operation,
): number[] {
  if (operation.direction === "release")
    return snapshot.unreleased_instance_ids.map(Number);
  if (operation.direction === "return")
    return snapshot.outstanding_instance_ids.map(Number);
  return (
    snapshot.inspection_holds
      .find((hold) => Number(hold.id) === operation.source)
      ?.instance_ids.map(Number) ?? []
  );
}
export function custodyActions(
  snapshot: Custody,
  permissions: string[],
  now = Date.now(),
): Movement[] {
  if (
    !snapshot.reconciled ||
    !["APPROVED", "READY_FOR_RELEASE", "RELEASED", "RETURNED"].includes(
      snapshot.booking.status,
    )
  )
    return [];
  const actions: Movement[] = [];
  if (
    permissions.includes("asset_booking.release") &&
    snapshot.asset_status === "active" &&
    utcInstant(snapshot.booking.usage_start) <= now &&
    utcInstant(snapshot.booking.expected_return) > now &&
    movementLimit(snapshot, { direction: "release" }) > 0
  )
    actions.push("release");
  if (
    permissions.includes("asset_booking.return") &&
    movementLimit(snapshot, { direction: "return" }) > 0
  )
    actions.push("return");
  if (
    permissions.includes("asset.condition.manage") &&
    snapshot.inspection_holds.length
  )
    actions.push("inspection");
  if (
    permissions.includes("asset_booking.return") &&
    ["RELEASED", "RETURNED"].includes(snapshot.booking.status) &&
    Number(snapshot.totals.released) > 0 &&
    movementLimit(snapshot, { direction: "return" }) === 0 &&
    Number(snapshot.totals.inspection) === 0
  )
    actions.push("complete");
  return actions;
}
export function conditions(direction: Movement, manage: boolean) {
  return direction === "release"
    ? ["good", "fair"]
    : direction === "inspection"
      ? ["good", "fair", "damaged"]
      : ["good", "fair", "inspection", ...(manage ? ["damaged", "lost"] : [])];
}
export function buildMovement(
  snapshot: Custody,
  operation: Operation,
  permissions: string[],
  fields: {
    quantity: string;
    selected: number[];
    condition: string;
    remarks: string;
  },
  key: string,
  now = Date.now(),
) {
  if (!custodyActions(snapshot, permissions, now).includes(operation.direction))
    throw new Error(
      "This action is no longer available. Refresh the custody details.",
    );
  const remarks = fields.remarks.trim();
  if (new TextEncoder().encode(remarks).length > 4000)
    throw new Error("Remarks are too long. Please shorten them.");
  if (operation.direction === "complete") {
    if (!remarks)
      throw new Error(
        "Explain why the unused approved balance is no longer needed.",
      );
    return { reason: remarks };
  }
  const individual = snapshot.tracking_mode === "individual";
  const quantity = individual
    ? fields.selected.length
    : Number(fields.quantity);
  if (
    (!individual && !/^[1-9]\d*$/.test(fields.quantity)) ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > Math.min(4294967295, movementLimit(snapshot, operation))
  )
    throw new Error(
      "Enter a positive whole quantity within the remaining balance.",
    );
  const items = [...fields.selected].sort((a, b) => a - b);
  if (
    individual &&
    (items.length > 1000 ||
      new Set(items).size !== items.length ||
      items.some((id) => !movementItems(snapshot, operation).includes(id)))
  )
    throw new Error("Choose only eligible items for this batch.");
  if (
    !conditions(
      operation.direction,
      permissions.includes("asset.condition.manage"),
    ).includes(fields.condition)
  )
    throw new Error("Choose a permitted condition for this action.");
  if (["damaged", "lost", "inspection"].includes(fields.condition) && !remarks)
    throw new Error(
      "Enter remarks explaining the damage, loss, or inspection.",
    );
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(key))
    throw new Error("A valid batch reference is required.");
  return {
    quantity,
    condition_status: fields.condition,
    ...(individual ? { instance_ids: items } : {}),
    ...(remarks ? { remarks } : {}),
    idempotency_key: key,
  };
}
export function movementPath(booking: number, operation: Operation) {
  return operation.direction === "inspection"
    ? `/asset-handovers/${operation.source}/inspect`
    : `/asset-bookings/${booking}/${operation.direction}`;
}

export const movementNames = {
  release: "Release assets",
  return: "Receive assets",
  inspection: "Resolve inspection",
  complete: "Complete booking",
};
