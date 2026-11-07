import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/session";
import { bookingPath } from "../lib/bookings";
import type { Booking } from "../lib/bookings";
import { bookingActions, decisionReason } from "../lib/bookingActions";
import type { BookingAction } from "../lib/bookingActions";
import type { ResourceKind } from "../lib/availability";
import { Button } from "./ui";

const labels = {
  approve: "Approve request",
  reject: "Reject request",
  cancel: "Cancel booking",
  complete: "Complete facility booking",
};
export default function BookingActions({
  kind,
  booking,
}: {
  kind: ResourceKind;
  booking: Booking;
}) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [action, setAction] = useState<BookingAction | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (action) dialog.current?.showModal();
  }, [action]);
  const actions = user ? bookingActions(kind, booking, user, now) : [];
  function close() {
    dialog.current?.close();
    setAction(null);
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || busy.current) return;
    if (!user || !bookingActions(kind, booking, user).includes(action)) {
      setError("This action is no longer available. Refresh the booking to review its current status.");
      return;
    }
    let value: string | undefined;
    try {
      value = decisionReason(action, reason);
    } catch (failure) {
      setError((failure as Error).message);
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await api.request<{
        automatically_rejected_ids?: number[];
      }>(`/${bookingPath(kind)}/${booking.id}/${action}`, {
        method: "PATCH",
        ...(value ? { body: JSON.stringify({ reason: value }) } : {}),
      });
      const count = result?.automatically_rejected_ids?.length ?? 0;
      setMessage(
        action === "approve"
          ? `Request approved. ${count} conflicting pending ${count === 1 ? "request was" : "requests were"} automatically rejected.`
          : action === "complete"
            ? "Facility booking completed. The requester has been notified."
          : action === "reject"
            ? "Request rejected. The requester has been notified."
            : "Booking cancelled. The requester has been notified.",
      );
      close();
      requestAnimationFrame(() => feedback.current?.focus());
    } catch (failure) {
      // Never blindly repeat a decision whose response may have been lost.
      const unknown =
        !(failure instanceof Error && "status" in failure) ||
        Number((failure as { status?: number }).status) === 0 ||
        Number((failure as { status?: number }).status) >= 500;
      if (unknown) {
        setUncertain(true);
        setMessage(
          "The decision could not be confirmed. Refresh the booking to check its status before taking another action.",
        );
        close();
      } else setError((failure as Error).message);
    } finally {
      await cache.invalidateQueries({ queryKey: ["bookings"] });
      for (const key of [
        "dashboard",
        "notifications",
        "availability",
        "facility-schedule",
        "calendar-events",
        "reports",
        "audit",
      ])
        void cache.invalidateQueries({ queryKey: [key] });
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <section className="booking-actions" aria-label="Booking actions">
      {message && (
        <p className="notice" role="status" ref={feedback} tabIndex={-1}>
          {message}
        </p>
      )}
      {uncertain ? (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const fresh = await api.request<Booking>(
                `/${bookingPath(kind)}/${booking.id}`,
              );
              cache.setQueryData(["bookings", kind, String(booking.id)], fresh);
              setUncertain(false);
              setMessage(
                "Booking refreshed. Review its current status before continuing.",
              );
            } catch {
              setMessage(
                "Status could not be refreshed. Check your connection and try again.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          Refresh booking status
        </Button>
      ) : (
        <div className="action-buttons">
          {actions.map((item) => (
            <Button
              key={item}
              disabled={pending}
              variant={item === "approve" || item === "complete" ? "primary" : "secondary"}
              className={item === "reject" || item === "cancel" ? "button-danger" : ""}
              onClick={() => {
                setReason("");
                setError("");
                setAction(item);
              }}
            >
              {labels[item]}
            </Button>
          ))}
        </div>
      )}
      <dialog
        ref={dialog}
        className="decision-dialog"
        aria-labelledby="decision-title"
        onCancel={(event) => {
          if (busy.current) event.preventDefault();
          else setAction(null);
        }}
        onClose={() => {
          if (!busy.current) setAction(null);
        }}
      >
        {action && (
          <form onSubmit={submit} aria-busy={pending}>
            <h2 id="decision-title">{labels[action]}?</h2>
            <p className="muted">{booking.booking_reference}</p>
            <p>
              {action === "approve"
                ? "Availability will be checked again. Approval reserves this resource and automatically rejects pending requests that can no longer be fulfilled."
                : action === "complete"
                  ? "Confirm that the scheduled facility use has finished. The server checks that the approved booking has ended, and the requester will be notified."
                : action === "reject"
                  ? "The requester will receive your reason. This decision cannot be undone."
                  : "This booking will end and its reservation will be released. Previously rejected requests will not be restored."}
            </p>
            {(action === "reject" || action === "cancel") && (
              <div className="field">
                <label htmlFor="decision-reason">Reason</label>
                <textarea
                  autoFocus
                  id="decision-reason"
                  rows={4}
                  value={reason}
                  disabled={pending}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  maxLength={4000}
                />
              </div>
            )}
            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
            <div className="action-buttons">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                autoFocus={action === "approve" || action === "complete"}
                onClick={close}
              >
                Go back
              </Button>
              <Button
                type="submit"
                disabled={pending}
                className={action === "reject" || action === "cancel" ? "button-danger" : ""}
              >
                {pending ? "Submitting…" : labels[action]}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
