import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { campusDate } from "../lib/types";
import type { Notice } from "../lib/types";
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeading,
} from "../components/ui";

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [success, setSuccess] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", page],
    queryFn: ({ signal }) =>
      api.request<Notice[]>(`/notifications?page=${page}&per_page=20`, {
        signal,
      }),
  });
  const mutation = useMutation({
    mutationFn: (id: number) =>
      api.request(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      setSuccess("Notification marked as read.");
      void client.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  return (
    <>
      <PageHeading eyebrow="Stay in the loop" title="Notifications">
        Account updates, booking decisions, asset handovers, and maintenance notices.
      </PageHeading>
      <div className="section-toolbar">
        <p className="muted">Latest first · updates every 30 seconds</p>
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh
        </Button>
      </div>
      {success && (
        <p className="notice notice-success" role="status">
          {success}
        </p>
      )}
      {mutation.error && (
        <p className="notice notice-error" role="alert">
          {mutation.error.message}
        </p>
      )}
      {query.isPending ? (
        <Loading label="Loading notifications…" />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <ul className="notification-list">
          {query.data.map((notice) => (
            <li
              key={notice.id}
              className={Number(notice.is_read) ? "" : "unread"}
            >
              <div className="notification-content">
                <div className="notification-heading">
                  <h2>{notice.title}</h2>
                  {!Number(notice.is_read) && (
                    <span className="badge">Unread</span>
                  )}
                </div>
                <p>{notice.message}</p>
                <time dateTime={notice.created_at.replace(" ", "T") + "Z"}>
                  {campusDate(notice.created_at, true)}
                </time>
              </div>
              {!Number(notice.is_read) && (
                <Button
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setSuccess("");
                    mutation.mutate(notice.id);
                  }}
                >
                  {mutation.isPending && mutation.variables === notice.id
                    ? "Saving…"
                    : "Mark as read"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={page === 1 ? "No notifications yet" : "No more notifications"}
        >
          Account updates, booking decisions, maintenance notices, and reminders will appear here.
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
    </>
  );
}
