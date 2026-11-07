import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/session";
import { api } from "../lib/api";
import { campusDate, displayName } from "../lib/types";
import type { Dashboard } from "../lib/types";
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeading,
} from "../components/ui";

export default function Overview() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: ({ signal }) => api.request<Dashboard>("/dashboard", { signal }),
  });
  const data = query.data;
  const count = (statuses: string[]) =>
    statuses.reduce(
      (total, status) =>
        total +
        Number(data?.facility_bookings[status] || 0) +
        Number(data?.asset_bookings[status] || 0),
      0,
    );
  return (
    <>
      <PageHeading
        eyebrow="Your campus at a glance"
        title={`Welcome, ${user ? user.first_name || displayName(user) : ""}.`}
      >
        Keep track of your requests and the equipment in your care.
      </PageHeading>
      <div className="section-toolbar">
        <div>
          <h2>My booking overview</h2>
          {data && (
            <p className="muted">
              {campusDate(data.start_utc)} – {campusDate(data.end_utc)} ·
              bookings overlapping this period
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        data && (
          <>
            <div className="stat-grid">
              <article className="stat">
                <p>Awaiting a decision</p>
                <strong>{count(["PENDING"])}</strong>
                <span>Pending requests</span>
              </article>
              <article className="stat">
                <p>Ready to go</p>
                <strong>{count(["APPROVED"])}</strong>
                <span>Approved bookings</span>
              </article>
              <article className="stat">
                <p>Currently borrowed</p>
                <strong>{count(["RELEASED"])}</strong>
                <span>Released asset bookings</span>
              </article>
              <article className="stat">
                <p>Completed</p>
                <strong>{count(["COMPLETED", "RETURNED"])}</strong>
                <span>Finished bookings</span>
              </article>
            </div>
            <section className="surface">
              <div className="section-toolbar">
                <div>
                  <p className="eyebrow">Equipment in your care</p>
                  <h2>Overdue returns</h2>
                </div>
                <span
                  className={`badge ${data.overdue_assets.length ? "badge-warning" : ""}`}
                >
                  {data.overdue_assets.length} loans
                </span>
              </div>
              {data.overdue_assets.length ? (
                <ul className="record-list">
                  {data.overdue_assets.map((loan) => (
                    <li key={loan.id}>
                      <div>
                        <strong>{loan.booking_reference}</strong>
                        <p className="muted">
                          Expected {campusDate(loan.expected_return, true)}
                        </p>
                      </div>
                      <span className="badge badge-warning">
                        {loan.outstanding_quantity} outstanding
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="You’re all caught up">
                  You have no overdue asset returns.
                </EmptyState>
              )}
            </section>
            <p className="refresh-caption">
              Updates every 30 seconds while this page is open.{" "}
              <Link to="/notifications">
                View approval and rejection notices →
              </Link>
            </p>
          </>
        )
      )}
      <section className="policy-strip" aria-label="Booking guidelines">
        <div>
          <span className="eyebrow">Plan ahead</span>
          <h2>A few things to know</h2>
        </div>
        <p>
          <strong>8 AM–5 PM</strong>Facility booking hours, every day
        </p>
        <p>
          <strong>30 days ahead</strong>Maximum advance start date
        </p>
        <p>
          <strong>Approval reserves it</strong>Pending requests do not hold
          availability
        </p>
      </section>
    </>
  );
}
