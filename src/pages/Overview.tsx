import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/session";
import { api } from "../lib/api";
import { campusDate, displayName } from "../lib/types";
import type { Dashboard } from "../lib/types";
import { dashboardCopy, dashboardMode } from '../lib/dashboard';
import { canRequest } from '../lib/booking-access';
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
    queryKey: ["dashboard", user?.id, user?.role_name],
    queryFn: ({ signal }) => api.request<Dashboard>("/dashboard", { signal }),
  });
  const data = query.data;
  const mode = data?.scope ?? dashboardMode(user);
  const copy = dashboardCopy[mode];
  const personal = mode === 'personal';
  const facilityOnly = mode === 'facility';
  const count = (statuses: string[]) =>
    statuses.reduce(
      (total, status) =>
        total +
        Number(data?.facility_bookings?.[status] || 0) +
        Number(data?.asset_bookings?.[status] || 0),
      0,
    );
  return (
    <>
      <PageHeading
        eyebrow={user ? `Welcome, ${user.first_name || displayName(user)}` : 'Campus workspace'}
        title={copy.title}
      >
        {copy.intro}
      </PageHeading>
      <div className="section-toolbar">
        <div>
          <h2>{personal ? 'My requests and reservations' : 'Booking activity'}</h2>
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
            {mode === 'administration' && data.catalog_totals && <section aria-label="System totals" className="stat-grid">
              {Object.entries(data.catalog_totals).map(([name, total]) => <article className="stat" key={name}><p>{name === 'assets' ? 'Asset groups' : name.charAt(0).toUpperCase() + name.slice(1)}</p><strong>{total}</strong><span>Registered records</span></article>)}
            </section>}
            <nav className="action-buttons dashboard-actions" aria-label="Dashboard actions">
              {personal && <Link className="button button-primary" to="/requests">My requests</Link>}
              {user?.permissions.some(p => ['facility_booking.view_all', 'asset_booking.view_all'].includes(p)) && <Link className="button button-primary" to="/review">Review requests</Link>}
              {user?.permissions.includes('user.manage') && <Link className="button button-secondary" to="/administration/accounts">Manage accounts</Link>}
              {user?.permissions.some(p => ['facility.create', 'asset.create'].includes(p)) && <Link className="button button-secondary" to="/manage">Manage catalog</Link>}
            </nav>
            <div className="stat-grid">
              <article className="stat">
                <p>{personal ? 'Awaiting a decision' : 'Awaiting review'}</p>
                <strong>{count(["PENDING"])}</strong>
                <span>Pending requests</span>
              </article>
              <article className="stat">
                <p>{personal ? 'Ready to go' : 'Approved reservations'}</p>
                <strong>{count(["APPROVED", "READY_FOR_RELEASE"])}</strong>
                <span>Approved bookings</span>
              </article>
              <article className="stat">
                <p>{facilityOnly ? 'Cancelled' : 'Currently borrowed'}</p>
                <strong>{count(facilityOnly ? ['CANCELLED'] : ["RELEASED"])}</strong>
                <span>{facilityOnly ? 'Cancelled facility bookings' : 'Released asset bookings'}</span>
              </article>
              <article className="stat">
                <p>Completed</p>
                <strong>{count(["COMPLETED", "RETURNED"])}</strong>
                <span>Finished bookings</span>
              </article>
            </div>
            {!facilityOnly && mode !== 'staff' && <section className="surface">
              <div className="section-toolbar">
                <div>
                  <p className="eyebrow">{personal ? 'Equipment in your care' : 'Asset custody follow-up'}</p>
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
                <EmptyState title="No overdue returns">
                  {personal ? 'You have no overdue asset returns.' : 'No overdue asset returns in your dashboard scope.'}
                </EmptyState>
              )}
            </section>}
            <p className="refresh-caption">
              Updates every 30 seconds while this page is open.{" "}
              <Link to="/notifications">
                View notifications →
              </Link>
            </p>
          </>
        )
      )}
      {(canRequest(user, 'facility') || canRequest(user, 'asset')) && <section className="policy-strip" aria-label="Booking guidelines">
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
      </section>}
    </>
  );
}
