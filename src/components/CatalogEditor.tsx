import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { catalogs, catalogName, catalogPayload, catalogLabels } from "../lib/catalog";
import type { CatalogKind, CatalogRecord } from "../lib/catalog";
import { Button, ErrorState, Loading } from "./ui";

export default function CatalogEditor({
  kind,
  path,
  record,
  statusOnly,
  onClose,
}: {
  kind: CatalogKind;
  path: string;
  record?: CatalogRecord;
  statusOnly?: boolean;
  onClose: (message?: string) => void;
}) {
  const config = catalogs[kind];
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const cache = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [status, setStatus] = useState(
    record?.status === "active" ? "inactive" : "active",
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      config.fields.map((field) => [
        field.key,
        String(
          record?.[field.key] ??
            (field.choices?.[0] || (field.number === 0 ? 0 : "")),
        ),
      ]),
    ),
  );
  const lookupPaths = [
    ...new Set(
      config.fields.flatMap((field) => (field.lookup ? [field.lookup] : [])),
    ),
  ];
  const lookups = useQuery({
    queryKey: ["catalog-lookups", kind],
    enabled: !statusOnly && lookupPaths.length > 0,
    queryFn: async ({ signal }) => {
      const entries = await Promise.all(
        lookupPaths.map(async (endpoint) => {
          const all: CatalogRecord[] = [];
          for (let page = 1; ; page++) {
            const batch = await api.request<CatalogRecord[]>(
              `/${endpoint}?per_page=100&page=${page}`,
              { signal },
            );
            all.push(...batch);
            if (batch.length < 100) break;
          }
          return [endpoint, all] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
  });
  useEffect(() => {
    dialog.current?.showModal();
    dialog.current?.querySelector("h2")?.focus();
  }, []);
  function close(message?: string) {
    if (!busy.current) {
      dialog.current?.close();
      onClose(message);
    }
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || uncertain) return;
    let payload: Record<string, string | number | null>;
    try {
      payload = statusOnly ? { status } : catalogPayload(kind, values, record);
    } catch (failure) {
      setError((failure as Error).message);
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    let message: string | undefined;
    try {
      await api.request(
        `${path}${record ? `/${record.id}` : ""}${statusOnly ? "/status" : ""}`,
        { method: record ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      message = statusOnly
        ? "Status updated."
        : record
          ? "Changes saved."
          : "Catalog record created.";
    } catch (failure) {
      if (
        !(failure instanceof ApiError) ||
        failure.status === 0 ||
        failure.status >= 500
      ) {
        setUncertain(true);
        setError(
          "The result could not be confirmed. Close this form and refresh the catalog to check the record before submitting again.",
        );
      } else setError(failure.message);
    } finally {
      await Promise.all(
        [
          "catalog",
          "catalog-lookups",
          "resources",
          "availability",
          "facility-schedule",
          "calendar-events",
          "calendar-options",
        ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
      busy.current = false;
      setPending(false);
    }
    if (message) close(message);
  }
  const lookupBusy = !statusOnly && lookupPaths.length > 0 && lookups.isPending;
  return (
    <dialog
      ref={dialog}
      className="decision-dialog catalog-editor"
      aria-labelledby="catalog-editor-title"
      onCancel={(event) => {
        if (busy.current) event.preventDefault();
        else onClose();
      }}
      onClose={() => {
        if (!busy.current) onClose();
      }}
    >
      <form onSubmit={submit} aria-busy={pending}>
        <h2 id="catalog-editor-title" tabIndex={-1}>
          {statusOnly
            ? "Change status"
            : record
              ? `Edit ${catalogLabels[kind]}`
              : `Add ${catalogLabels[kind]}`}
        </h2>
        {record && (
          <p className="muted">
            {catalogName(record)} · #{record.id}
          </p>
        )}
        {statusOnly ? (
          <>
            <p>
              Unavailable resources cannot receive new bookings. Outstanding
              bookings and active dependent records may prevent this change.
            </p>
            <div className="field">
              <label htmlFor="catalog-status">New status</label>
              <select
                id="catalog-status"
                value={status}
                disabled={pending || uncertain}
                onChange={(event) => setStatus(event.target.value)}
              >
                {[
                  "active",
                  "inactive",
                  ...(["assets", "instances"].includes(kind)
                    ? ["retired"]
                    : []),
                ]
                  .filter((value) => value !== record?.status)
                  .map((value) => (
                    <option key={value}>{value}</option>
                  ))}
              </select>
            </div>
          </>
        ) : (
          <>
            {kind === "assets" && (
              <p className="muted">
                Tracking mode is permanent. Individual stock is counted from
                tagged items. Inventory reductions must first resolve
                outstanding requests.
              </p>
            )}
            {lookupBusy && (
              <Loading label="Loading categories and departments…" />
            )}
            {lookupPaths.length > 0 && lookups.error && (
              <ErrorState
                error={lookups.error}
                retry={() => void lookups.refetch()}
              />
            )}
            <fieldset
              disabled={
                pending ||
                uncertain ||
                lookupBusy ||
                (lookupPaths.length > 0 && !!lookups.error)
              }
            >
              {config.fields
                .filter(
                  (field) =>
                    !(
                      kind === "assets" &&
                      values.tracking_mode === "individual" &&
                      ["total_quantity", "usable_quantity"].includes(field.key)
                    ),
                )
                .map((field) => (
                  <div className="field" key={field.key}>
                    <label htmlFor={`catalog-${field.key}`}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </label>
                    {field.choices || field.lookup ? (
                      <select
                        id={`catalog-${field.key}`}
                        value={values[field.key]}
                        required={field.required}
                        disabled={field.key === "tracking_mode" && !!record}
                        onChange={(event) =>
                          setValues({
                            ...values,
                            [field.key]: event.target.value,
                          })
                        }
                      >
                        {field.lookup ? (
                          <>
                            <option value="">
                              Select {field.label.toLowerCase()}
                            </option>
                            {!!record?.[field.key] &&
                              !lookups.data?.[field.lookup]?.some(
                                (row) =>
                                  Number(row.id) === Number(record[field.key]),
                              ) && (
                                <option value={String(record[field.key])}>
                                  Current #{record[field.key]} (inactive or
                                  unavailable)
                                </option>
                              )}
                            {lookups.data?.[field.lookup]?.map((row) => (
                              <option key={row.id} value={row.id}>
                                {catalogName(row)}
                              </option>
                            ))}
                          </>
                        ) : (
                          field.choices?.map((value) => (
                            <option key={value} value={value}>
                              {value === "quantity"
                                ? "Quantity pool"
                                : value === "individual"
                                  ? "Individually tagged"
                                  : value}
                            </option>
                          ))
                        )}
                      </select>
                    ) : field.key === "description" ? (
                      <textarea
                        id={`catalog-${field.key}`}
                        rows={3}
                        value={values[field.key]}
                        onChange={(event) =>
                          setValues({
                            ...values,
                            [field.key]: event.target.value,
                          })
                        }
                      />
                    ) : (
                      <input
                        id={`catalog-${field.key}`}
                        type={field.number !== undefined ? "number" : "text"}
                        min={field.number}
                        max={
                          field.number !== undefined ? 4294967295 : undefined
                        }
                        step={field.number !== undefined ? 1 : undefined}
                        required={field.required}
                        value={values[field.key]}
                        onChange={(event) =>
                          setValues({
                            ...values,
                            [field.key]: event.target.value,
                          })
                        }
                      />
                    )}
                  </div>
                ))}
            </fieldset>
          </>
        )}
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <div className="action-buttons">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => close()}
          >
            {uncertain ? "Close and check catalog" : "Cancel"}
          </Button>
          <Button
            type="submit"
            disabled={
              pending ||
              uncertain ||
              lookupBusy ||
              (!statusOnly && lookupPaths.length > 0 && !!lookups.error)
            }
          >
            {pending
              ? "Saving…"
              : statusOnly
                ? "Confirm status change"
                : `Save ${catalogLabels[kind]}`}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
