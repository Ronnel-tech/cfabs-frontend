import { useState } from "react";
import { Link, Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/session";
import type { Role } from "../lib/administration";
import RoleEditor from "../components/RoleEditor";
import GrantEditor from "../components/GrantEditor";
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeading,
} from "../components/ui";

export default function Roles() {
  const { user } = useAuth();
  const canEdit = !!user?.permissions.includes("role.manage"),
    canReadGrants = !!user?.permissions.includes("permission.manage");
  const [editor, setEditor] = useState<{
    type: "details" | "grants";
    role?: Role;
  } | null>(null);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["admin-roles"],
    enabled: canEdit || canReadGrants,
    queryFn: ({ signal }) => api.request<Role[]>("/roles", { signal }),
  });
  if (!canEdit && !canReadGrants) return <Navigate to="/" replace />;
  const close = (feedback?: string) => {
    setEditor(null);
    if (feedback) setMessage(feedback);
  };
  return (
    <>
      <PageHeading eyebrow="Access administration" title="Roles & permissions">
        Maintain shared roles and review the exact permissions assigned to each
        one.
      </PageHeading>
      <nav className="catalog-navigation" aria-label="Administration sections">
        {user?.permissions.includes("user.manage") && (
          <Link to="/administration/accounts">Accounts</Link>
        )}
        <Link to="/administration/roles" aria-current="page">
          Roles &amp; permissions
        </Link>
      </nav>
      <p className="notice">
        A role name does not imply approval access. Decisions require explicit
        booking permissions. Keep at least one active account with user.manage,
        role.manage, and permission.manage.
      </p>
      <div className="section-toolbar catalog-toolbar">
        <p className="muted">Roles are shared by their assigned accounts.</p>
        <div className="action-buttons">
          <Button
            variant="secondary"
            disabled={query.isFetching || !!editor}
            onClick={() => void query.refetch()}
          >
            Refresh
          </Button>
          {canEdit && (
            <Button disabled={!!editor} onClick={() => setEditor({ type: "details" })}>
              Create role
            </Button>
          )}
        </div>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {query.isPending ? (
        <Loading label="Loading roles…" />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <ul className="record-list catalog-records">
          {query.data.map((role) => (
            <li key={role.id}>
              <div>
                <h2>{role.role_name.replaceAll("_", " ")}</h2>
                <p className="muted">
                  #{role.id} · {role.role_name}
                </p>
                {role.description && <p>{role.description}</p>}
              </div>
              <div className="action-buttons">
                {canEdit && (
                  <Button
                    variant="secondary"
                    onClick={() => setEditor({ type: "details", role })}
                  >
                    Edit role<span className="sr-only"> {role.role_name}</span>
                  </Button>
                )}
                {canReadGrants && (
                  <Button
                    variant="secondary"
                    onClick={() => setEditor({ type: "grants", role })}
                  >
                    {canEdit ? "Edit permissions" : "View permissions"}
                    <span className="sr-only"> for {role.role_name}</span>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No roles">
          Create a role if your access allows it.
        </EmptyState>
      )}
      {editor?.type === "details" && (
        <RoleEditor role={editor.role} onClose={close} />
      )}
      {editor?.type === "grants" && editor.role && (
        <GrantEditor
          role={editor.role}
          editable={canEdit && canReadGrants}
          onClose={close}
        />
      )}
    </>
  );
}
