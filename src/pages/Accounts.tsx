import { useState } from "react";
import { Link, Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/session";
import {
  accountActions,
  accountLabels,
  accountName,
  activeAccount,
} from "../lib/administration";
import type { Account, AccountOperation } from "../lib/administration";
import { campusDate } from "../lib/types";
import AccountEditor from "../components/AccountEditor";
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeading,
} from "../components/ui";

export default function Accounts() {
  const { user } = useAuth();
  const permitted = !!user?.permissions.includes("user.manage");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{
    operation: AccountOperation;
    account?: Account;
  } | null>(null);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["admin-accounts", page],
    enabled: permitted,
    queryFn: ({ signal }) =>
      api.request<Account[]>(`/users?page=${page}&per_page=20`, { signal }),
  });
  if (!permitted || !user) return <Navigate to="/" replace />;
  return (
    <>
      <PageHeading eyebrow="Access administration" title="Campus accounts">
        Create accounts and maintain names, departments, roles, and active
        status.
      </PageHeading>
      <nav className="catalog-navigation" aria-label="Administration sections">
        <Link to="/administration/accounts" aria-current="page">
          Accounts
        </Link>
        {user.permissions.some((p) =>
          ["role.manage", "permission.manage"].includes(p),
        ) && <Link to="/administration/roles">Roles &amp; permissions</Link>}
      </nav>
      <div className="section-toolbar catalog-toolbar">
        <p className="muted">All accounts · active and inactive</p>
        <div className="action-buttons">
          <Button
            variant="secondary"
            disabled={query.isFetching || !!editor}
            onClick={() => void query.refetch()}
          >
            Refresh
          </Button>
          <Button disabled={!!editor} onClick={() => setEditor({ operation: "create" })}>
            Create account
          </Button>
        </div>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {query.isPending ? (
        <Loading label="Loading accounts…" />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <ul className="record-list catalog-records admin-accounts">
          {query.data.map((account) => (
            <li key={account.id}>
              <div>
                <h2>
                  {accountName(account)}{" "}
                  {Number(account.id) === Number(user.id) && (
                    <span className="muted">(you)</span>
                  )}
                </h2>
                <p>
                  {account.username} · {account.email}
                </p>
                <p className="muted">
                  #{account.id} ·{" "}
                  {activeAccount(account) ? "Active" : "Inactive"} ·{" "}
                  {account.role_name?.replaceAll("_", " ") || "No role"} ·
                  Department{" "}
                  {account.department_id
                    ? `#${account.department_id}`
                    : "unassigned"}
                </p>
                <p className="muted">
                  Last sign-in:{" "}
                  {account.last_login_at
                    ? campusDate(account.last_login_at, true)
                    : "Never"}
                </p>
              </div>
              <div className="action-buttons">
                {accountActions(account, user).map((operation) => (
                  <Button
                    key={operation}
                    variant="secondary"
                    onClick={() => setEditor({ operation, account })}
                  >
                    {accountLabels[operation]}
                    <span className="sr-only"> for {account.username}</span>
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No accounts on this page">
          Return to the previous page or create an account.
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
        <AccountEditor
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
