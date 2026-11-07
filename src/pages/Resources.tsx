import { useState } from "react";
import { Link, Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/session";
import { api } from "../lib/api";
import { resourceCode, resourceName, resourcePath } from "../lib/availability";
import type { Resource, ResourceKind } from "../lib/availability";
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeading,
} from "../components/ui";

export default function Resources({ kind }: { kind: ResourceKind }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const permitted = !!user?.permissions.includes(`${kind}.view`);
  const path = resourcePath(kind);
  const query = useQuery({
    queryKey: ["resources", kind, page],
    enabled: permitted,
    queryFn: ({ signal }) =>
      api.request<Resource[]>(`/${path}?page=${page}&per_page=20`, { signal }),
  });
  if (!permitted) return <Navigate to="/" replace />;
  return (
    <>
      <PageHeading
        eyebrow="Find what you need"
        title={kind === "facility" ? "Campus facilities" : "Shared assets"}
      >
        {kind === "facility"
          ? "Explore campus spaces and find an open time for your activity."
          : "Check equipment availability and quantities for your borrowing period."}
      </PageHeading>
      <div className="section-toolbar">
        <p className="muted">
          Active {path} · select a resource to check dates
        </p>
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh
        </Button>
      </div>
      {query.isPending ? (
        <Loading label={`Loading ${path}…`} />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <ul className="resource-list">
          {query.data.map((resource) => (
            <li key={resource.id}>
              <div>
                <p className="eyebrow">{resourceCode(resource)}</p>
                <h2>
                  <Link to={`/${path}/${resource.id}`}>
                    {resourceName(resource)}
                  </Link>
                </h2>
                <p className="muted">
                  {kind === "facility"
                    ? `${resource.capacity} people · ${resource.building || resource.location_details || "Location not specified"}`
                    : `${resource.tracking_mode === "individual" ? "Individually tagged items" : "Quantity-tracked stock"} · ${resource.location || "Location not specified"}`}
                </p>
                {resource.description && (
                  <p className="resource-description">{resource.description}</p>
                )}
              </div>
              <Link
                className="button button-secondary"
                to={`/${path}/${resource.id}`}
              >
                Check availability <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={page === 1 ? `No active ${path} yet` : "No more resources"}
        >
          Your campus team’s published resources will appear here.
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
