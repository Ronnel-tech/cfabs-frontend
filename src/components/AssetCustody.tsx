import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/session";
import { campusDate } from "../lib/types";
import { custodyActions, movementNames } from "../lib/handovers";
import type { Custody, Handover, Operation } from "../lib/handovers";
import type { Booking } from "../lib/bookings";
import { Button, EmptyState, ErrorState, Loading } from "./ui";
import HandoverForm from "./HandoverForm";

export default function AssetCustody({ booking }: { booking: Booking }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const snapshot = useQuery({
    queryKey: ["custody", booking.id],
    queryFn: ({ signal }) =>
      api.request<Custody>(`/asset-bookings/${booking.id}/custody`, { signal }),
  });
  const history = useQuery({
    queryKey: ["handovers", booking.id, page],
    queryFn: ({ signal }) =>
      api.request<Handover[]>(
        `/asset-bookings/${booking.id}/handovers?page=${page}&per_page=20`,
        { signal },
      ),
  });
  const tags = new Map(
    booking.selected_items?.map((item) => [Number(item.id), item.asset_tag]),
  );
  const data = snapshot.data;
  const actions =
    data && !snapshot.error
      ? custodyActions(data, user?.permissions ?? [], now)
      : [];
  return (
    <section
      className="surface asset-custody"
      aria-labelledby="custody-heading"
    >
      <div className="section-toolbar">
        <div>
          <h2 id="custody-heading">Asset custody</h2>
          <p className="muted">
            Partial releases, returns, and inspection holds
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={snapshot.isFetching || history.isFetching || !!operation}
          onClick={() => {
            void snapshot.refetch();
            void history.refetch();
          }}
        >
          Refresh
        </Button>
      </div>
      {snapshot.error && (
        <ErrorState
          error={snapshot.error}
          retry={() => void snapshot.refetch()}
        />
      )}
      {snapshot.isPending ? (
        <Loading label="Loading custody details…" />
      ) : (
        data && (
          <>
            <dl className="custody-totals">
              <div>
                <dt>Released</dt>
                <dd>
                  {data.totals.released} / {data.booking.quantity_requested}
                </dd>
              </div>
              <div>
                <dt>Returned</dt>
                <dd>{data.totals.returned}</dd>
              </div>
              <div>
                <dt>Lost</dt>
                <dd>{data.totals.lost}</dd>
              </div>
              <div>
                <dt>Outstanding</dt>
                <dd>
                  {Number(data.totals.released) -
                    Number(data.totals.returned) -
                    Number(data.totals.lost)}
                </dd>
              </div>
              <div>
                <dt>Inspection hold</dt>
                <dd>{data.totals.inspection}</dd>
              </div>
            </dl>
            {!data.reconciled && (
              <p className="notice notice-error">
                Recorded totals need reconciliation. Contact an administrator;
                handover actions are unavailable until the ledger is reconciled.
              </p>
            )}
            <p className="refresh-caption">
              Release is allowed only during the approved booking period. Lost
              units are accounted for separately from physical returns.
              Eligibility and physical stock are checked again when recording.
            </p>
            {!operation && (
              <div className="action-buttons">
                {actions
                  .filter((action) => action !== "inspection")
                  .map((direction) => (
                    <Button
                      key={direction}
                      variant={
                        direction === "complete" ? "secondary" : "primary"
                      }
                      onClick={() => setOperation({ direction })}
                    >
                      {movementNames[direction]}
                    </Button>
                  ))}
              </div>
            )}
            {!!data.inspection_holds.length && (
              <div className="inspection-holds">
                <h3>Awaiting inspection</h3>
                {data.inspection_holds.map((hold) => (
                  <div className="inspection-row" key={hold.id}>
                    <div>
                      <strong>Return batch #{hold.id}</strong>
                      <p>
                        {hold.remaining_quantity} unit(s) held ·{" "}
                        {campusDate(hold.created_at, true)}
                      </p>
                      {hold.remarks && (
                        <p className="muted preserve-lines">{hold.remarks}</p>
                      )}
                    </div>
                    {actions.includes("inspection") && (
                      <Button
                        variant="secondary"
                        disabled={!!operation}
                        onClick={() =>
                          setOperation({
                            direction: "inspection",
                            source: Number(hold.id),
                          })
                        }
                      >
                        Inspect batch #{hold.id}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {operation && (
              <HandoverForm
                key={`${operation.direction}-${operation.source ?? ""}`}
                snapshot={data}
                blocked={!!snapshot.error}
                operation={operation}
                tags={tags}
                onClose={() => setOperation(null)}
              />
            )}
          </>
        )
      )}
      <div className="handover-history">
        <h3>Handover history</h3>
        <p className="muted">Oldest first. Each row is one recorded batch.</p>
        {history.isPending ? (
          <Loading label="Loading handover history…" />
        ) : history.error ? (
          <ErrorState
            error={history.error}
            retry={() => void history.refetch()}
          />
        ) : history.data?.length ? (
          <ol className="handover-list">
            {history.data.map((event) => (
              <li key={event.id}>
                <div className="section-toolbar">
                  <strong>
                    Batch #{event.id} ·{" "}
                    {event.direction === "loss"
                      ? "Recorded loss"
                      : event.direction.charAt(0).toUpperCase() +
                        event.direction.slice(1)}
                  </strong>
                  <span className="badge">{event.quantity} unit(s)</span>
                </div>
                <p>
                  {event.condition_status === "inspection"
                    ? "Held for inspection"
                    : `Condition: ${event.condition_status}`}{" "}
                  · {campusDate(event.created_at, true)}
                </p>
                {event.source_handover_id && (
                  <p>Inspected from return batch #{event.source_handover_id}</p>
                )}
                {event.instance_ids.length > 0 && (
                  <ul className="asset-tags">
                    {event.instance_ids.map((id) => (
                      <li key={id}>
                        {tags.get(Number(id)) || `Asset item #${id}`}
                      </li>
                    ))}
                  </ul>
                )}
                {event.remarks && (
                  <p className="preserve-lines">{event.remarks}</p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title={page === 1 ? "No handovers yet" : "No more handovers"}
          >
            Recorded releases, returns, losses, and inspection results will
            appear here.
          </EmptyState>
        )}
        <div className="pagination">
          <Button
            variant="secondary"
            disabled={page === 1 || history.isFetching || !!operation}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>Page {page}</span>
          <Button
            variant="secondary"
            disabled={
              history.isFetching ||
              !!operation ||
              (history.data?.length ?? 0) < 20
            }
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
