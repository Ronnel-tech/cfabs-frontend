import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/session";
import { api } from "../lib/api";
import {
  bookingEnd,
  bookingPath,
  bookingStart,
  requestLink,
  statusLabel,
} from "../lib/bookings";
import type { Booking } from "../lib/bookings";
import type { ResourceKind } from "../lib/availability";
import { campusDate } from "../lib/types";
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeading,
} from "../components/ui";

export default function MyRequests({ review = false }: { review?: boolean }) {
  const { user } = useAuth();
  const kinds = (["facility", "asset"] as ResourceKind[]).filter(
    (item) => !review || user?.permissions.includes(`${item}_booking.view_all`),
  );
  const [selectedKind, setKind] = useState<ResourceKind>(
    kinds[0] || "facility",
  );
  const kind = kinds.includes(selectedKind)
    ? selectedKind
    : kinds[0] || "facility";
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["bookings", review ? "review" : "mine", kind, page],
    enabled: kinds.includes(kind),
    queryFn: ({ signal }) =>
      api.request<Booking[]>(
        `/${bookingPath(kind)}?mine=${review ? "0" : "1"}&page=${page}&per_page=20`,
        { signal },
      ),
  });
  if (!kinds.length)
    return (
      <PageHeading
        eyebrow="Booking review"
        title="You don’t have access to review bookings."
      />
    );
  return (
    <>
      <PageHeading
        eyebrow={review ? "Staff workspace" : "Your booking history"}
        title={review ? "Booking review" : "My requests"}
      >
        {review
          ? "Review bookings and open a request to make a decision. All statuses are shown, newest first."
          : "Track decisions and review each booking’s dates and details."}
      </PageHeading>
      <div className="section-toolbar">
        <div className="field inline-field">
          <label htmlFor="request-kind">Request type</label>
          <select
            id="request-kind"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as ResourceKind);
              setPage(1);
            }}
          >
            {kinds.map((item) => (
              <option key={item} value={item}>
                {item === "facility" ? "Facilities" : "Assets"}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh
        </Button>
      </div>
      {query.isPending ? (
        <Loading label="Loading your requests…" />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <ul className="booking-list">
          {query.data.map((booking) => (
            <li key={booking.id}>
              <div>
                <p className="eyebrow">
                  {booking.series_id
                    ? "Recurring occurrence"
                    : "Single booking"}
                </p>
                <h2>
                  <Link
                    to={
                      review
                        ? `/review/${kind}/${booking.id}`
                        : requestLink(kind, booking.id)
                    }
                  >
                    {booking.booking_reference}
                  </Link>
                </h2>
                {booking.activity_name && <p>{booking.activity_name}</p>}
                <p className="muted">
                  {campusDate(bookingStart(booking), true)} –{" "}
                  {campusDate(bookingEnd(booking), true)}
                </p>
                {kind === "asset" && (
                  <p className="muted">
                    {booking.quantity_requested}{" "}
                    {Number(booking.quantity_requested) === 1
                      ? "unit"
                      : "units"}{" "}
                    requested
                  </p>
                )}
              </div>
              <span className={`badge status-${booking.status.toLowerCase()}`}>
                {statusLabel(booking.status)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={page === 1 ? "No bookings yet" : "No more requests"}>
          Browse facilities or assets, check availability, and submit your first
          request.
        </EmptyState>
      )}
      <div className="pagination">
        <Button
          variant="secondary"
          disabled={page === 1 || query.isFetching}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span>Page {page}</span>
        <Button
          variant="secondary"
          disabled={query.isFetching || (query.data?.length ?? 0) < 20}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      <p className="refresh-caption">
        {review
          ? "Actions follow your account permissions. Decide recurring occurrences individually."
          : "Only your requests are shown, including when your account can review other users’ bookings."}{" "}
        Updates every 30 seconds.
      </p>
    </>
  );
}
