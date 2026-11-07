import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/session";
import {
  buildMovement,
  conditions,
  custodyActions,
  movementItems,
  movementLimit,
  movementPath,
  movementNames,
} from "../lib/handovers";
import type { Custody, Handover, Operation } from "../lib/handovers";
import type { Booking } from "../lib/bookings";
import { Button } from "./ui";
import QrScanner from './QrScanner';
import { addQrSelection, handoverQr, type QrLabel } from '../lib/qr';

type Attempt = {
  path: string;
  body: string;
  quantity?: number;
  condition?: string;
  items: number[];
  remarks: string;
  qrCount: number;
};
export default function HandoverForm({
  snapshot,
  operation,
  tags,
  blocked,
  onClose,
}: {
  blocked: boolean;
  snapshot: Custody;
  operation: Operation;
  tags: Map<number, string>;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [quantity, setQuantity] = useState("1");
  const [selected, setSelected] = useState<number[]>([]);
  const [scanned, setScanned] = useState<QrLabel[]>([]);
  const [scanPending, setScanPending] = useState(false);
  const [condition, setCondition] = useState("good");
  const [remarks, setRemarks] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const busy = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const receiptRef = useRef<HTMLParagraphElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const permissions = user?.permissions ?? [];
  const individual = snapshot.tracking_mode === "individual";
  const completing = operation.direction === "complete";
  const choices = conditions(
    operation.direction,
    permissions.includes("asset.condition.manage"),
  );
  const items = movementItems(snapshot, operation);
  const eligible =
    !blocked &&
    custodyActions(snapshot, permissions).includes(operation.direction);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (attempt) dialog.current?.showModal();
  }, [attempt]);
  function edit() {
    if (busy.current || uncertain) return;
    dialog.current?.close();
    setAttempt(null);
  }
  function review(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!eligible || scanPending) {
      setError("Refresh custody details before reviewing a batch.");
      return;
    }
    try {
      const body = buildMovement(
        snapshot,
        operation,
        permissions,
        { quantity, selected, condition, remarks },
        crypto.randomUUID(),
      );
      setAttempt({
        path: movementPath(snapshot.booking.id, operation),
        body: JSON.stringify({ ...body, ...(['release', 'return'].includes(operation.direction) ? handoverQr(scanned, individual, selected) : {}) }),
        quantity: "quantity" in body ? body.quantity : undefined,
        condition: completing ? undefined : condition,
        items: [...selected],
        remarks: remarks.trim(),
        qrCount: scanned.length,
      });
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  async function submit() {
    if (!attempt || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await api.request<{
        handover?: Handover;
        booking?: Booking;
        replayed?: boolean;
      }>(attempt.path, { method: "POST", body: attempt.body });
      setReceipt(
        completing
          ? "Booking completed. Its unused approved balance has been released."
          : `Batch #${result.handover?.id} recorded: ${attempt.quantity} unit(s), ${operation.direction === "return" && attempt.condition === "lost" ? "loss" : operation.direction}, condition ${attempt.condition}.${result.replayed ? " The original batch was recovered without creating a duplicate." : ""}`,
      );
      dialog.current?.close();
      setAttempt(null);
      setUncertain(false);
      requestAnimationFrame(() => receiptRef.current?.focus());
    } catch (failure) {
      const unknown =
        !(failure instanceof ApiError) ||
        failure.status === 0 ||
        failure.status >= 500;
      setError(
        unknown
          ? "The server response could not be confirmed. Retry this exact batch to recover its receipt safely; do not record it as a new batch."
          : (failure as Error).message,
      );
      if (unknown) setUncertain(true);
      else {
        setUncertain(false);
        dialog.current?.close();
        setAttempt(null);
      }
    } finally {
      await Promise.all(
        ["custody", "handovers", "bookings"].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
      for (const key of [
        "dashboard",
        "notifications",
        "availability",
        "facility-schedule",
        "calendar-events",
      ])
        void cache.invalidateQueries({ queryKey: [key] });
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <section
      className="handover-form"
      aria-label={movementNames[operation.direction]}
    >
      <h3 ref={heading} tabIndex={-1}>
        {movementNames[operation.direction]}
        {operation.source ? ` · return batch #${operation.source}` : ""}
      </h3>
      {receipt ? (
        <>
          <p className="notice" role="status" tabIndex={-1} ref={receiptRef}>
            {receipt}
          </p>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Done
          </Button>
        </>
      ) : (
        <>
          <p className="muted">
            {completing
              ? "Close this booking after all issued units and inspection holds have been settled. No further releases will be possible."
              : operation.direction === "inspection"
                ? "Record only units inspected from this return batch. Remaining units stay on hold."
                : "Record only the units physically handed over in this batch. Each batch is saved in the booking history."}
          </p>
          {!eligible && !attempt && (
            <p className="notice">
              This action is no longer eligible. Review the refreshed custody
              details.
            </p>
          )}
          <form onSubmit={review} aria-busy={pending}>
            <fieldset disabled={!!attempt || pending || !eligible}>
              {!completing && (
                <>
                  {['release', 'return'].includes(operation.direction) && <section className="qr-handover" aria-label="Scan handover items"><h4>Scan asset labels (optional)</h4><p className="muted">Scans select equipment for this batch. Review and confirm below to record the handover.</p><QrScanner disabled={!!attempt || pending || !eligible} onBusyChange={setScanPending} onRead={async identifier => {
                    const label = await api.request<QrLabel>(`/qr/${identifier}`);
                    const next = addQrSelection(scanned, label, Number(snapshot.booking.asset_id), individual, items);
                    setScanned(next);
                    if (individual) setSelected(next.map(row => Number(row.resource.id)));
                  }} />{!!scanned.length && <div role="status"><p>{scanned.length} label(s) scanned: {scanned.map(row => row.resource.code).join(', ')}</p><Button type="button" variant="quiet" onClick={() => { setScanned([]); if (individual) setSelected([]); }}>Clear scans</Button></div>}</section>}
                  {individual ? (
                    <div className="field">
                      <p className="field-label">
                        Specific assets · {selected.length} selected
                      </p>
                      <div className="item-options">
                        {items.map((id) => (
                          <label key={id}>
                            <input
                              type="checkbox"
                              checked={selected.includes(id)}
                              onChange={(event) =>
                                setSelected(
                                  event.target.checked
                                    ? [...selected, id]
                                    : selected.filter((value) => value !== id),
                                )
                              }
                            />
                            <span>{tags.get(id) || `Asset item #${id}`}</span>
                          </label>
                        ))}
                      </div>
                      {!items.length && <p>No eligible items remain.</p>}
                    </div>
                  ) : (
                    <div className="field">
                      <label htmlFor="batch-quantity">Batch quantity</label>
                      <input
                        id="batch-quantity"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        max={movementLimit(snapshot, operation)}
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        required
                      />
                      <p className="muted">
                        Up to {movementLimit(snapshot, operation)} units in this
                        batch.
                      </p>
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor="batch-condition">
                      {operation.direction === "inspection"
                        ? "Inspection result"
                        : "Condition"}
                    </label>
                    <select
                      id="batch-condition"
                      value={condition}
                      onChange={(event) => setCondition(event.target.value)}
                    >
                      {choices.map((value) => (
                        <option key={value} value={value}>
                          {value === "inspection"
                            ? "Hold for inspection"
                            : value === "lost"
                              ? "Lost — not physically returned"
                              : value.charAt(0).toUpperCase() + value.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="field">
                <label htmlFor="batch-remarks">
                  {completing
                    ? "Completion reason"
                    : `Remarks${["damaged", "lost", "inspection"].includes(condition) ? " (required)" : " (optional)"}`}
                </label>
                <textarea
                  id="batch-remarks"
                  rows={3}
                  maxLength={4000}
                  required={
                    completing ||
                    ["damaged", "lost", "inspection"].includes(condition)
                  }
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                />
              </div>
            </fieldset>
            {error && !attempt && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
            <div className="action-buttons">
              <Button
                type="button"
                variant="secondary"
                disabled={!!attempt || pending}
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={!!attempt || pending || scanPending || !eligible}
              >
                Review {completing ? "completion" : "batch"}
              </Button>
            </div>
          </form>
        </>
      )}
      <dialog
        ref={dialog}
        className="decision-dialog"
        aria-labelledby="handover-confirm-title"
        onCancel={(event) => {
          if (busy.current || uncertain) event.preventDefault();
          else setAttempt(null);
        }}
      >
        {attempt && (
          <>
            <h2 id="handover-confirm-title">
              Confirm {completing ? "completion" : "handover"}
            </h2>
            <p>{snapshot.booking.booking_reference}</p>
            {attempt.qrCount > 0 && <p>{attempt.qrCount} scanned label(s) will be verified again before this batch is recorded.</p>}
            <p>
              {completing
                ? "This ends the booking and releases its unused approved balance."
                : `${attempt.quantity} unit(s) · ${operation.direction === "return" && attempt.condition === "lost" ? "record as lost" : operation.direction} · ${attempt.condition}`}
            </p>
            {!!attempt.items.length && (
              <ul className="asset-tags">
                {attempt.items.map((id) => (
                  <li key={id}>{tags.get(id) || `Asset item #${id}`}</li>
                ))}
              </ul>
            )}
            {attempt.remarks && (
              <p className="preserve-lines">{attempt.remarks}</p>
            )}
            {["damaged", "lost"].includes(attempt.condition || "") && (
              <p className="notice notice-error">
                This records unusable inventory and may affect future
                reservations. The ledger entry cannot be edited or deleted.
              </p>
            )}
            {attempt.condition === "inspection" && (
              <p className="notice">
                Returned units stay unavailable until their inspection is
                resolved.
              </p>
            )}
            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
            <div className="action-buttons">
              <Button
                variant="secondary"
                disabled={pending || uncertain}
                autoFocus
                onClick={edit}
              >
                Go back
              </Button>
              <Button disabled={pending} onClick={() => void submit()}>
                {pending
                  ? "Recording…"
                  : uncertain
                    ? "Retry exact batch"
                    : completing
                      ? "Complete booking"
                      : "Confirm batch"}
              </Button>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
