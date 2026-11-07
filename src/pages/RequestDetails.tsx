import AssetCustody from "../components/AssetCustody";
import BookingActions from "../components/BookingActions";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/session";
import {
  bookingEnd,
  bookingPath,
  bookingStart,
  requestLink,
  statusLabel,
} from "../lib/bookings";
import type { Booking, SeriesResult } from "../lib/bookings";
import { resourceName, resourcePath } from "../lib/availability";
import type { Resource, ResourceKind } from "../lib/availability";
import { campusDate } from "../lib/types";
import { ErrorState, Loading, PageHeading } from "../components/ui";

function BookingDetails({
  kind,
  id,
  review,
}: {
  kind: ResourceKind;
  id: string;
  review: boolean;
}) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["bookings", kind, id],
    queryFn: ({ signal }) =>
      api.request<Booking>(`/${bookingPath(kind)}/${id}`, { signal }),
  });
  const booking = query.data;
  const own = !!booking && Number(booking.requester_id) === Number(user?.id);
  const allowed =
    own || (review && !!user?.permissions.includes(`${kind}_booking.view_all`));
  const resourceId =
    kind === "facility" ? booking?.facility_id : booking?.asset_id;
  const resource = useQuery({
    queryKey: ["resource", kind, String(resourceId)],
    enabled:
      allowed && !!resourceId && !!user?.permissions.includes(`${kind}.view`),
    queryFn: ({ signal }) =>
      api.request<Resource>(`/${resourcePath(kind)}/${resourceId}`, { signal }),
  });
  if (query.isPending) return <Loading label="Loading request…" />;
  if (query.error && !booking)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  if (!booking || !allowed)
    return (
      <PageHeading
        eyebrow="My requests"
        title="This request isn’t in your account."
      />
    );
  return (
    <>
      {query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      <PageHeading
        eyebrow={kind === "facility" ? "Facility request" : "Asset request"}
        title={booking.booking_reference}
      >
        {resource.data
          ? resourceName(resource.data)
          : `${kind === "facility" ? "Facility" : "Asset"} #${resourceId}`}
      </PageHeading>
      <section className="surface request-details">
        <div className="section-toolbar">
          <h2>Booking details</h2>
          <span className={`badge status-${booking.status.toLowerCase()}`}>
            {statusLabel(booking.status)}
          </span>
        </div>
        {booking.status === "PENDING" && (
          <p className="notice">
            Awaiting a decision. This request does not reserve the resource.
          </p>
        )}
        {booking.rejection_reason && (
          <div className="notice notice-error">
            <h3>Reason for rejection</h3>
            <p>{booking.rejection_reason}</p>
            {booking.rejection_source === "automatic" && (
              <p>
                Automatically rejected because the request was no longer
                feasible.
              </p>
            )}
          </div>
        )}
        {booking.cancellation_reason && (
          <div className="notice">
            <h3>Reason for cancellation</h3>
            <p>{booking.cancellation_reason}</p>
          </div>
        )}
        <dl>
          {review && (
            <>
              <dt>Requester</dt>
              <dd>Account #{booking.requester_id}</dd>
            </>
          )}
          <dt>Start</dt>
          <dd>{campusDate(bookingStart(booking), true)}</dd>
          <dt>{kind === "asset" ? "Expected return" : "End"}</dt>
          <dd>{campusDate(bookingEnd(booking), true)}</dd>
          {kind === "facility" ? (
            <>
              <dt>Activity</dt>
              <dd>{booking.activity_name}</dd>
              <dt>Participants</dt>
              <dd>{booking.participants_count}</dd>
            </>
          ) : (
            <>
              <dt>Quantity requested</dt>
              <dd>{booking.quantity_requested}</dd>
              <dt>Released / returned</dt>
              <dd>
                {booking.quantity_released ?? 0} /{" "}
                {booking.quantity_returned ?? 0}
              </dd>
              {Number(booking.quantity_lost) > 0 && (
                <>
                  <dt>Recorded lost</dt>
                  <dd>{booking.quantity_lost}</dd>
                </>
              )}
              {!!booking.instance_ids?.length && (
                <>
                  <dt>Specific assets</dt>
                  <dd>
                    {booking.selected_items?.length ? (
                      <ul className="asset-tags">
                        {booking.selected_items.map((item) => (
                          <li key={item.id}>{item.asset_tag}</li>
                        ))}
                      </ul>
                    ) : (
                      `${booking.instance_ids.length} individually tracked items selected`
                    )}
                  </dd>
                </>
              )}
            </>
          )}
          <dt>Purpose</dt>
          <dd className="preserve-lines">{booking.purpose}</dd>
          <dt>Submitted</dt>
          <dd>{campusDate(booking.submitted_at, true)}</dd>
          {kind === "facility" && booking.completed_at && <><dt>Completed</dt><dd>{campusDate(booking.completed_at, true)}</dd></>}
        </dl>
        {!review && booking.series_id && (
          <Link to={`/requests/series/${booking.series_id}`}>
            View all occurrences in this series →
          </Link>
        )}
      </section>
      <BookingActions key={`${kind}-${id}`} kind={kind} booking={booking} />
      {kind === "asset" && <AssetCustody key={id} booking={booking} />}
      <p className="refresh-caption">
        Times are in Asia/Manila. Status updates every 30 seconds; decisions
        also appear in <Link to="/notifications">Notifications</Link>.
      </p>
    </>
  );
}

function SeriesDetails({ id }: { id: string }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["bookings", "series", id],
    queryFn: ({ signal }) =>
      api.request<SeriesResult>(`/booking-series/${id}`, { signal }),
  });
  if (query.isPending) return <Loading label="Loading occurrences…" />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  if (
    !query.data ||
    Number(query.data.series.requester_id) !== Number(user?.id)
  )
    return (
      <PageHeading
        eyebrow="My requests"
        title="This series isn’t in your account."
      />
    );
  const { series, bookings } = query.data;
  return (
    <>
      <PageHeading eyebrow="Recurring booking" title="Your recurring requests">
        Each occurrence has its own approval and status.
      </PageHeading>
      <ul className="booking-list">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <div>
              <h2>
                <Link to={requestLink(series.resource_kind, booking.id)}>
                  {booking.booking_reference}
                </Link>
              </h2>
              <p className="muted">
                {campusDate(bookingStart(booking), true)} –{" "}
                {campusDate(bookingEnd(booking), true)}
              </p>
            </div>
            <span className={`badge status-${booking.status.toLowerCase()}`}>
              {statusLabel(booking.status)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function RequestDetails({
  review = false,
}: {
  review?: boolean;
}) {
  const { kind, id = "" } = useParams();
  return (
    <>
      <Link className="back-link" to={review ? "/review" : "/requests"}>
        ← {review ? "Booking review" : "My requests"}
      </Link>
      {!/^[1-9]\d*$/.test(id) ||
      !["facility", "asset", "series"].includes(kind || "") ? (
        <PageHeading
          eyebrow="Request not found"
          title="This request isn’t here."
        />
      ) : kind === "series" ? (
        <SeriesDetails id={id} />
      ) : (
        <BookingDetails kind={kind as ResourceKind} id={id} review={review} />
      )}
    </>
  );
}
