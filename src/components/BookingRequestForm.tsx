import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/session";
import { canRequest } from '../lib/booking-access';
import type { Availability, Resource, ResourceKind } from "../lib/availability";
import { campusInstant } from "../lib/availability";
import { campusDate } from "../lib/types";
import {
  buildBooking,
  createAttempt,
  repeatPeriods,
  requestLink,
  statusLabel,
  submissionUncertain,
} from "../lib/bookings";
import type {
  Attempt,
  Booking,
  Period,
  Repeat,
  RequestFields,
  SeriesResult,
} from "../lib/bookings";
import { Button } from "./ui";

export default function BookingRequestForm({
  kind,
  resource,
  period,
  availability,
  checking,
  dateError,
  lock,
}: {
  kind: ResourceKind;
  resource: Resource;
  period: Period;
  availability?: Availability;
  checking: boolean;
  dateError: string;
  lock: (value: boolean) => void;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [fields, setFields] = useState<RequestFields>({
    purpose: "",
    activity: "",
    participants: "1",
    quantity: "1",
    selected: [],
  });
  const [repeat, setRepeat] = useState<Repeat>({
    frequency: "once",
    count: 2,
    interval: 1,
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [retryRecurring, setRetryRecurring] = useState(false);
  const [receipt, setReceipt] = useState<Booking[] | null>(null);
  const attempt = useRef<Attempt | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (receipt) document.getElementById("receipt-heading")?.focus();
  }, [receipt]);
  let dates: Period[] = [],
    recurrenceError = "";
  try {
    dates = repeatPeriods(kind, period, repeat);
  } catch (failure) {
    recurrenceError = (failure as Error).message;
  }
  if (!user || !canRequest(user, kind)) return null;
  if (!user.department_id)
    return (
      <p className="notice">
        An active campus department must be assigned before you can request a
        booking. Contact your administrator.
      </p>
    );

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      inFlight.current ||
      receipt ||
      (uncertain && !attempt.current?.recurring)
    )
      return;
    setError("");
    let submission: Attempt;
    try {
      if (uncertain && attempt.current) submission = attempt.current;
      else {
        if (dateError || recurrenceError)
          throw new Error(dateError || recurrenceError);
        if (checking || !availability)
          throw new Error(
            "Wait for a successful availability check before submitting.",
          );
        const booking = buildBooking(
          kind,
          resource,
          period,
          fields,
          availability,
        );
        submission = createAttempt(kind, booking, repeat, crypto.randomUUID());
        attempt.current = submission;
      }
    } catch (failure) {
      setError((failure as Error).message);
      return;
    }
    inFlight.current = true;
    setRetryRecurring(submission.recurring);
    setPending(true);
    lock(true);
    try {
      const result = await api.request<Booking | SeriesResult>(
        submission.path,
        { method: "POST", body: JSON.stringify(submission.body) },
      );
      setReceipt("bookings" in result ? result.bookings : [result]);
      setUncertain(false);
      for (const key of [
        "bookings",
        "dashboard",
        "notifications",
        "availability",
        "facility-schedule",
        "calendar-events",
      ])
        void client.invalidateQueries({ queryKey: [key] });
    } catch (failure) {
      const ambiguous = submissionUncertain(failure, submission.recurring);
      setUncertain(ambiguous);
      setError(
        ambiguous
          ? "We couldn’t confirm the result. Check My requests before starting another submission."
          : (failure as Error).message,
      );
      lock(ambiguous);
      void client.invalidateQueries({
        queryKey: ["availability", kind, String(resource.id)],
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  if (receipt)
    return (
      <section
        className="surface request-form"
        aria-labelledby="receipt-heading"
      >
        <p className="eyebrow">Request received</p>
        <h2 id="receipt-heading" tabIndex={-1}>
          Your {receipt.length > 1 ? "requests were" : "request was"} submitted
        </h2>
        <p className="notice notice-success" role="status">
          {receipt.length} {receipt.length === 1 ? "request" : "requests"}{" "}
          received. Each booking follows its own approval process. Pending
          requests do not reserve resources.
        </p>
        <ul className="record-list">
          {receipt.map((booking) => (
            <li key={booking.id}>
              <div>
                <Link to={requestLink(kind, booking.id)}>
                  {booking.booking_reference}
                </Link>
                <p className="muted">{statusLabel(booking.status)}</p>
              </div>
              <Link to={requestLink(kind, booking.id)}>View request →</Link>
            </li>
          ))}
        </ul>
        <Link className="button button-primary" to="/requests">
          View my requests
        </Link>
      </section>
    );
  const frozen = pending || uncertain;
  const blocked =
    !!dateError || !!recurrenceError || !availability?.available || checking;
  return (
    <section className="surface request-form" aria-labelledby="request-heading">
      <p className="eyebrow">Ready to request?</p>
      <h2 id="request-heading">Tell us what you need</h2>
      <p className="muted">Review the dates above, then submit for approval.</p>
      <form onSubmit={submit} noValidate aria-busy={pending}>
        <fieldset disabled={frozen}>
          <legend className="sr-only">Request details</legend>
          {kind === "facility" ? (
            <div className="period-fields">
              <div className="field">
                <label htmlFor="activity-name">Activity name</label>
                <input
                  id="activity-name"
                  required
                  value={fields.activity}
                  onChange={(event) =>
                    setFields({ ...fields, activity: event.target.value })
                  }
                  placeholder="e.g. Department planning meeting"
                />
              </div>
              <div className="field">
                <label htmlFor="participants">Number of participants</label>
                <input
                  id="participants"
                  type="number"
                  min="1"
                  max={resource.capacity}
                  step="1"
                  required
                  value={fields.participants}
                  onChange={(event) =>
                    setFields({ ...fields, participants: event.target.value })
                  }
                />
              </div>
            </div>
          ) : resource.tracking_mode === "individual" ? (
            <fieldset className="item-selection">
              <legend>Choose specific assets</legend>
              <p className="muted">
                The same selected items will be requested for every recurring
                date.
              </p>
              <p>{fields.selected.length} selected</p>
              <div className="item-options">
                {availability?.available_instances.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={fields.selected.includes(Number(item.id))}
                      onChange={(event) =>
                        setFields({
                          ...fields,
                          selected: event.target.checked
                            ? [...fields.selected, Number(item.id)]
                            : fields.selected.filter(
                                (id) => id !== Number(item.id),
                              ),
                        })
                      }
                    />
                    <span>
                      {item.asset_tag}
                      {item.serial_number && (
                        <small>Serial: {item.serial_number}</small>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              {fields.selected.length > 0 && (
                <Button
                  variant="quiet"
                  type="button"
                  onClick={() => setFields({ ...fields, selected: [] })}
                >
                  Clear item selection
                </Button>
              )}
            </fieldset>
          ) : (
            <div className="field">
              <label htmlFor="request-quantity">Quantity requested</label>
              <input
                id="request-quantity"
                type="number"
                min="1"
                step="1"
                max={availability?.available_quantity}
                value={fields.quantity}
                required
                onChange={(event) =>
                  setFields({ ...fields, quantity: event.target.value })
                }
              />
              <p className="muted">
                {availability?.available_quantity ?? "—"} currently available
                for the selected period.
              </p>
            </div>
          )}
          <div className="field">
            <label htmlFor="request-purpose">Purpose</label>
            <textarea
              id="request-purpose"
              required
              rows={3}
              value={fields.purpose}
              onChange={(event) =>
                setFields({ ...fields, purpose: event.target.value })
              }
              placeholder="Explain the activity and how the resource will be used."
            />
          </div>
          <div className="period-fields">
            <div className="field">
              <label htmlFor="request-repeat">Repeat</label>
              <select
                id="request-repeat"
                value={repeat.frequency}
                onChange={(event) =>
                  setRepeat({
                    ...repeat,
                    frequency: event.target.value as Repeat["frequency"],
                  })
                }
              >
                <option value="once">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            {repeat.frequency !== "once" && (
              <>
                <div className="field">
                  <label htmlFor="repeat-interval">
                    Every (number of{" "}
                    {repeat.frequency === "daily" ? "days" : "weeks"})
                  </label>
                  <input
                    id="repeat-interval"
                    type="number"
                    min="1"
                    max="4"
                    value={repeat.interval}
                    onChange={(event) =>
                      setRepeat({
                        ...repeat,
                        interval: Number(event.target.value),
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="repeat-count">
                    Total occurrences (including first)
                  </label>
                  <input
                    id="repeat-count"
                    type="number"
                    min="2"
                    max="30"
                    value={repeat.count}
                    onChange={(event) =>
                      setRepeat({
                        ...repeat,
                        count: Number(event.target.value),
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        </fieldset>
        {repeat.frequency !== "once" && (
          <div className="recurrence-preview">
            <h3>Review your {dates.length || repeat.count} dates</h3>
            <p className="muted">
              Availability above is for the first date. All dates and items are
              checked together on submission; if one fails, none are created.
              Each occurrence is decided separately.
            </p>
            <ol tabIndex={0} aria-label="Recurring request dates">
              {dates.map((date) => (
                <li key={date.start}>
                  {campusDate(campusInstant(date.start)!, true)} –{" "}
                  {campusDate(campusInstant(date.end)!, true)}
                </li>
              ))}
            </ol>
          </div>
        )}
        {repeat.frequency !== "once" && !dateError && recurrenceError && (
          <p className="notice notice-error" role="status">
            {recurrenceError}
          </p>
        )}
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        {uncertain && (
          <p className="notice">
            {retryRecurring
              ? "Retrying below checks the original recurring request to avoid duplicate bookings. Keep this page open to retry safely."
              : "Automatic retries are disabled for this request. Check your request list before opening a new form."}{" "}
            <Link to="/requests">Check my requests →</Link>
          </p>
        )}
        <p className="muted request-disclaimer">
          Submission does not guarantee approval or hold availability.
        </p>
        <Button
          type="submit"
          disabled={pending || (uncertain ? !retryRecurring : blocked)}
        >
          {pending
            ? "Submitting…"
            : uncertain
              ? "Retry same recurring request"
              : checking
                ? "Checking availability…"
                : repeat.frequency === "once"
                  ? "Submit request"
                  : `Submit ${dates.length || repeat.count} requests`}
        </Button>
      </form>
    </section>
  );
}
