import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/session";
import { canRequest } from '../lib/booking-access';
import { api } from "../lib/api";
import {
  addDays,
  availabilityPath,
  availabilityReason,
  campusInstant,
  campusToday,
  rangeError,
  resourceCode,
  resourceName,
  resourcePath,
} from "../lib/availability";
import type { Availability, Resource, ResourceKind } from "../lib/availability";
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeading,
} from "../components/ui";
import FacilitySchedule from "../components/FacilitySchedule";
import BookingRequestForm from "../components/BookingRequestForm";

export default function ResourceAvailability({ kind }: { kind: ResourceKind }) {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [search] = useSearchParams();
  const today = campusToday();
  const [period, setPeriod] = useState(() => {
    const start = search.get("start") ?? "", end = search.get("end") ?? "";
    return campusInstant(start) && campusInstant(end)
      ? { start, end }
      : { start: `${addDays(today, 1)}T09:00`, end: `${addDays(today, 1)}T10:00` };
  });
  const [requestLocked, setRequestLocked] = useState(false);
  const locked =
    requestLocked &&
    canRequest(user, kind) &&
    !!user?.department_id;
  const permitted = !!user?.permissions.includes(`${kind}.view`);
  const validId = /^[1-9]\d*$/.test(id);
  const path = resourcePath(kind);
  const error = rangeError(kind, period.start, period.end);
  const resource = useQuery({
    queryKey: ["resource", kind, id],
    enabled: permitted && validId,
    queryFn: ({ signal }) =>
      api.request<Resource>(`/${path}/${id}`, { signal }),
  });
  const availability = useQuery({
    queryKey: ["availability", kind, id, period],
    enabled:
      permitted && validId && !!resource.data && !resource.error && !error,
    queryFn: ({ signal }) =>
      api.request<Availability>(
        availabilityPath(
          kind,
          id,
          campusInstant(period.start)!,
          campusInstant(period.end)!,
        ),
        { signal },
      ),
  });
  if (!permitted) return <Navigate to="/" replace />;
  if (!validId)
    return (
      <>
        <PageHeading
          eyebrow="Resource not found"
          title="This resource isn’t here."
        />
        <Link to={`/${path}`}>Back to {path}</Link>
      </>
    );
  const data = availability.data;
  return (
    <>
      <Link className="back-link" to={`/${path}`}>
        ← All {path}
      </Link>
      {resource.isPending ? (
        <Loading label="Loading resource…" />
      ) : resource.error ? (
        <ErrorState
          error={resource.error}
          retry={() => void resource.refetch()}
        />
      ) : (
        resource.data && (
          <>
            <PageHeading
              eyebrow={resourceCode(resource.data)}
              title={resourceName(resource.data)}
            >
              {kind === "facility"
                ? `${resource.data.capacity} people · ${resource.data.building || resource.data.location_details || "Location not specified"}`
                : resource.data.tracking_mode === "individual"
                  ? "Individually tagged equipment · check which items are free"
                  : "Quantity-tracked stock · check how many units are free"}
            </PageHeading>
            {resource.data.description && (
              <p className="resource-introduction">
                {resource.data.description}
              </p>
            )}
            <section className="surface" aria-labelledby="period-heading">
              <div className="section-toolbar">
                <div>
                  <h2 id="period-heading">Check your dates</h2>
                  <p className="muted">
                    Philippine Standard Time (UTC+8), regardless of your device
                    timezone.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={locked || !!error || availability.isFetching}
                  onClick={() => void availability.refetch()}
                >
                  Refresh
                </Button>
              </div>
              <div className="period-fields">
                <div className="field">
                  <label htmlFor="period-start">Start date and time</label>
                  <input
                    id="period-start"
                    type="datetime-local"
                    disabled={locked}
                    value={period.start}
                    min={`${today}T00:00`}
                    max={`${addDays(today, 30)}T23:59`}
                    onChange={(event) =>
                      setPeriod({ ...period, start: event.target.value })
                    }
                    aria-describedby="period-guidance period-error"
                    aria-invalid={!!error}
                  />
                </div>
                <div className="field">
                  <label htmlFor="period-end">
                    {kind === "asset"
                      ? "Expected return date and time"
                      : "End date and time"}
                  </label>
                  <input
                    id="period-end"
                    type="datetime-local"
                    disabled={locked}
                    value={period.end}
                    onChange={(event) =>
                      setPeriod({ ...period, end: event.target.value })
                    }
                    aria-describedby="period-guidance period-error"
                    aria-invalid={!!error}
                  />
                </div>
              </div>
              <p id="period-guidance" className="muted period-guidance">
                {kind === "facility"
                  ? "Every day, 8 AM–5 PM. Choose a period on one day, starting up to 30 days ahead."
                  : "Start up to 30 days ahead. There is no fixed borrowing duration limit; an expected return is required."}
              </p>
              <div id="period-error" aria-live="polite">
                {error && <p className="notice notice-error">{error}</p>}
              </div>
              {!error &&
                (availability.isPending ? (
                  <Loading label="Checking availability…" />
                ) : availability.error ? (
                  <ErrorState
                    error={availability.error}
                    retry={() => void availability.refetch()}
                  />
                ) : (
                  data && (
                    <div
                      className="availability-result"
                      aria-live="polite"
                      aria-busy={availability.isFetching}
                    >
                      <div>
                        <span
                          className={`badge ${data.available ? "" : "badge-warning"}`}
                        >
                          {data.available ? "Available" : "Unavailable"}
                        </span>
                        <h2>
                          {kind === "asset"
                            ? `${data.available_quantity} ${Number(data.available_quantity) === 1 ? "unit" : "units"} available`
                            : data.available
                              ? "This time is open"
                              : "This time is unavailable"}
                        </h2>
                        <p className="muted">
                          {data.available
                            ? "Available throughout your selected period."
                            : availabilityReason(data)}
                        </p>
                      </div>
                      <p className="refresh-caption">
                        {availability.isFetching
                          ? "Updating availability…"
                          : `Last checked ${new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(availability.dataUpdatedAt)}`}{" "}
                        · refreshes every 30 seconds while visible.
                      </p>
                      {kind === "asset" &&
                        resource.data.tracking_mode === "individual" &&
                        (data.available_instances.length ? (
                          <>
                            <h3 className="item-heading">
                              Available asset tags
                            </h3>
                            <ul className="asset-tags">
                              {data.available_instances.map((item) => (
                                <li key={item.id}>{item.asset_tag}</li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <EmptyState title="No specific items available">
                            Choose a different period to find an available item.
                          </EmptyState>
                        ))}
                    </div>
                  )
                ))}
            </section>
            <BookingRequestForm
              kind={kind}
              resource={resource.data}
              period={period}
              availability={availability.error ? undefined : data}
              checking={availability.isFetching}
              dateError={error}
              lock={setRequestLocked}
            />
            {kind === "facility" && (
              <FacilitySchedule
                id={id}
                day={period.start.slice(0, 10)}
                active={resource.data.status === "active"}
                disabled={locked}
                choose={(start, end) => setPeriod({ start, end })}
              />
            )}
            <p className="notice">
              Availability may change. Pending requests do not reserve
              resources; availability is checked again when a request is
              approved.
            </p>
          </>
        )
      )}
    </>
  );
}
