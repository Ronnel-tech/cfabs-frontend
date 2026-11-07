import { useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/session";
import { api } from "../lib/api";
import { catalogs, catalogName, canManage, catalogLabels } from "../lib/catalog";
import type { CatalogKind, CatalogRecord } from "../lib/catalog";
import CatalogEditor from "../components/CatalogEditor";
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeading,
} from "../components/ui";

export default function CatalogManagement() {
  const { kind = "departments", assetId } = useParams();
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const valid =
    Object.hasOwn(catalogs, kind) &&
    canManage(kind as CatalogKind, permissions);
  const selected = kind as CatalogKind;
  const config = valid ? catalogs[selected] : catalogs.departments;
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{
    record?: CatalogRecord;
    statusOnly?: boolean;
  } | null>(null);
  const [message, setMessage] = useState("");
  const path =
    selected === "instances" ? `/assets/${assetId}/instances` : `/${selected}`;
  const parent = useQuery({
    queryKey: ["catalog", "parent", assetId],
    enabled:
      valid &&
      selected === "instances" &&
      !!assetId &&
      /^[1-9]\d*$/.test(assetId),
    queryFn: ({ signal }) =>
      api.request<CatalogRecord>(`/assets/${assetId}`, { signal }),
  });
  const query = useQuery({
    queryKey: ["catalog", path, page],
    enabled:
      valid &&
      (selected !== "instances" ||
        (!!assetId && parent.data?.tracking_mode === "individual")),
    queryFn: ({ signal }) =>
      api.request<CatalogRecord[]>(
        `${path}?page=${page}&per_page=20${permissions.includes(config.edit) ? "&include_inactive=1" : ""}`,
        { signal },
      ),
  });
  if (selected === "instances" && (!assetId || !/^[1-9]\d*$/.test(assetId)))
    return <Navigate to="/manage/assets" replace />;
  if (!valid) {
    const first = (Object.keys(catalogs) as CatalogKind[]).find(
      (key) => key !== "instances" && canManage(key, permissions),
    );
    return <Navigate to={first ? `/manage/${first}` : "/"} replace />;
  }
  return (
    <>
      <PageHeading eyebrow="Resource management" title={`Manage ${config.title.toLowerCase()}`}>
        Maintain {config.title.toLowerCase()} and their current status. Changes are checked against existing bookings.
      </PageHeading>
      <nav className="catalog-navigation" aria-label="Catalog sections">
        {(Object.keys(catalogs) as CatalogKind[])
          .filter((key) => key !== "instances" && canManage(key, permissions))
          .map((key) => (
            <Link
              key={key}
              aria-current={
                key === selected ||
                (key === "assets" && selected === "instances")
                  ? "page"
                  : undefined
              }
              to={`/manage/${key}`}
            >
              {catalogs[key].title}
            </Link>
          ))}
      </nav>
      {selected === "instances" && (
        <p>
          <Link to="/manage/assets">← Back to assets</Link>
        </p>
      )}
      <div className="section-toolbar catalog-toolbar">
        <div>
          <h2>
            {config.title}
            {parent.data ? ` · ${catalogName(parent.data)}` : ""}
          </h2>
          <p className="muted">
            {permissions.includes(config.edit)
              ? "All record statuses"
              : "Active records only · inactive records require update permission"}
          </p>
        </div>
        <div className="action-buttons">
          <Button
            variant="secondary"
            disabled={query.isFetching || !!editor}
            onClick={() => void query.refetch()}
          >
            Refresh
          </Button>
          {permissions.includes(config.create) &&
            (selected !== "instances" ||
              (parent.data?.tracking_mode === "individual" &&
                parent.data.status === "active")) && (
              <Button disabled={!!editor} onClick={() => setEditor({})}>
                Add {catalogLabels[selected]}
              </Button>
            )}
        </div>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {selected === "instances" && parent.error ? (
        <ErrorState error={parent.error} retry={() => void parent.refetch()} />
      ) : selected === "instances" && parent.isPending ? (
        <Loading />
      ) : selected === "instances" &&
        parent.data?.tracking_mode !== "individual" ? (
        <p className="notice">
          Only individually tracked assets have tagged items.
        </p>
      ) : query.isPending ? (
        <Loading label="Loading catalog…" />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <ul className="record-list catalog-records">
          {query.data.map((row) => (
            <li key={row.id}>
              <div>
                <h3>{catalogName(row)}</h3>
                <p className="muted">
                  #{row.id} ·{" "}
                  {String(
                    row.department_code ||
                      row.facility_code ||
                      row.asset_code ||
                      row.serial_number ||
                      "",
                  )}{" "}
                  · {row.status}
                  {row.tracking_mode ? ` · ${row.tracking_mode}` : ""}
                  {row.condition_status ? ` · ${row.condition_status}` : ""}
                </p>
                {row.tracking_mode === "quantity" && (
                  <p className="muted">
                    Usable {row.usable_quantity} / total {row.total_quantity} ·
                    booking availability is checked separately
                  </p>
                )}
                {row.description && <p>{row.description}</p>}
              </div>
              <div className="action-buttons">
                {(selected === 'instances' || (selected === 'assets' && row.tracking_mode === 'quantity')) && permissions.includes('asset.view') && <Link className="button button-secondary" to={`/asset-qr/${selected === 'instances' ? 'asset-instance' : 'asset'}/${row.id}`}>QR label<span className="sr-only"> for {catalogName(row)}</span></Link>}
                {selected === "assets" &&
                  row.tracking_mode === "individual" && (
                    <Link
                      className="button button-secondary"
                      to={`/manage/instances/${row.id}`}
                    >
                      Tagged items
                    </Link>
                  )}
                {permissions.includes(config.edit) && (
                  <Button
                    variant="secondary"
                    onClick={() => setEditor({ record: row })}
                  >
                    Edit<span className="sr-only"> {catalogName(row)}</span>
                  </Button>
                )}
                {permissions.includes(config.status) && (
                  <Button
                    variant="quiet"
                    onClick={() => setEditor({ record: row, statusOnly: true })}
                  >
                    Change status
                    <span className="sr-only"> of {catalogName(row)}</span>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={page === 1 ? "No records yet" : "No more records"}>
          Create a record if your current access allows it, or return to the
          previous page.
        </EmptyState>
      )}
      <div className="pagination">
        <Button
          variant="secondary"
          disabled={page === 1 || query.isFetching || !!editor}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span>Page {page}</span>
        <Button
          variant="secondary"
          disabled={
            (query.data?.length ?? 0) < 20 || query.isFetching || !!editor
          }
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      {editor && (
        <CatalogEditor
          kind={selected}
          path={path}
          {...editor}
          onClose={(feedback) => {
            setEditor(null);
            if (feedback) setMessage(feedback);
          }}
        />
      )}
    </>
  );
}
