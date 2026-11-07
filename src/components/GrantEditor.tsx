import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  permissionChanges,
  permissionDescription,
  samePermissions,
} from "../lib/administration";
import type { Permission, Role } from "../lib/administration";
import { Button, ErrorState, Loading } from "./ui";
import AdminDialog from "./AdminDialog";

export default function GrantEditor({
  role,
  editable,
  onClose,
}: {
  role: Role;
  editable: boolean;
  onClose: (message?: string) => void;
}) {
  const [editorId] = useState(() => crypto.randomUUID());
  const query = useQuery({
    queryKey: ["admin-grants", role.id, editorId],
    gcTime: 0,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const [current, registered] = await Promise.all([
        api.request<{ permission_keys: string[] }>(
          `/roles/${role.id}/permissions`,
          { signal },
        ),
        api.request<Permission[]>("/permissions", { signal }),
      ]);
      return { keys: current.permission_keys, registered };
    },
  });
  if (!query.data)
    return (
      <section className="surface" aria-label="Role permissions">
        {query.error ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : (
          <Loading label="Loading role permissions…" />
        )}
        <Button variant="secondary" onClick={() => onClose()}>
          Close
        </Button>
      </section>
    );
  return (
    <GrantForm
      role={role}
      editable={editable}
      baseline={query.data.keys}
      registered={query.data.registered}
      onClose={onClose}
    />
  );
}

function GrantForm({
  role,
  editable,
  baseline: original,
  registered,
  onClose,
}: {
  role: Role;
  editable: boolean;
  baseline: string[];
  registered: Permission[];
  onClose: (message?: string) => void;
}) {
  // Keep one explicit snapshot while editing; polling must never reset selections.
  const [baseline] = useState(original);
  const [selected, setSelected] = useState(original);
  const [filter, setFilter] = useState("");
  const [stale, setStale] = useState(false);
  const changes = permissionChanges(baseline, selected);
  const visible = registered.filter((permission) =>
    `${permission.permission_key} ${permission.description || permissionDescription(permission.permission_key)}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  return (
    <AdminDialog
      title={`Permissions · ${role.role_name.replaceAll("_", " ")}`}
      ready={editable && !stale}
      onClose={onClose}
      prepare={() => {
        if (!editable || stale)
          throw new Error(
            "Close and reopen this role to load current permissions.",
          );
        const delta = permissionChanges(baseline, selected);
        if (!delta.added.length && !delta.removed.length)
          throw new Error("No permission changes to save.");
        if (
          selected.some(
            (key) =>
              !registered.some(
                (permission) => permission.permission_key === key,
              ),
          )
        )
          throw new Error("Select registered permissions only.");
        return {
          path: `/roles/${role.id}/permissions`,
          method: "PUT",
          body: { permission_keys: [...selected].sort() },
          beforeSave: async () => {
            const current = await api.request<{ permission_keys: string[] }>(
              `/roles/${role.id}/permissions`,
            );
            if (!samePermissions(baseline, current.permission_keys)) {
              setStale(true);
              throw new Error(
                "Another administrator changed these permissions. Close and reopen this role before editing again.",
              );
            }
          },
        };
      }}
      review={
        <>
          <h3>{role.role_name.replaceAll("_", " ")}</h3>
          <p>
            This replaces the role’s complete permission set for every assigned
            account, including your own if applicable.
          </p>
          <h3>Add ({changes.added.length})</h3>
          <ul>
            {changes.added.map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
          {!changes.added.length && <p>None</p>}
          <h3>Remove ({changes.removed.length})</h3>
          <ul>
            {changes.removed.map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
          {!changes.removed.length && <p>None</p>}
        </>
      }
    >
      <p className="muted">
        {selected.length} of {registered.length} permissions selected. Changes
        apply to all accounts assigned this role.
      </p>
      {!editable && (
        <p className="notice">
          Read-only access. Replacing permissions requires both role.manage and
          permission.manage.
        </p>
      )}
      {stale && (
        <p className="notice notice-error" role="alert">
          Permissions changed while this form was open. Close and reopen to load
          the latest set.
        </p>
      )}
      <div className="field">
        <label htmlFor="permission-filter">Find a permission</label>
        <input
          id="permission-filter"
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>
      <div className="permission-options">
        {visible.map((permission) => (
          <label key={permission.id}>
            <input
              type="checkbox"
              checked={selected.includes(permission.permission_key)}
              disabled={
                !editable ||
                stale ||
                (!selected.includes(permission.permission_key) &&
                  selected.length >= 200)
              }
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...selected, permission.permission_key]
                    : selected.filter(
                        (key) => key !== permission.permission_key,
                      ),
                )
              }
            />
            <span>
              <strong>{permission.permission_key}</strong>
              <span className="muted">
                {permission.description ||
                  permissionDescription(permission.permission_key)}
              </span>
            </span>
          </label>
        ))}
        {!visible.length && (
          <p className="muted">
            No matching permissions. Other selections are preserved.
          </p>
        )}
      </div>
    </AdminDialog>
  );
}
