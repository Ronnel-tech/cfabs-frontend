import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/session";
import {
  accountLabels,
  accountName,
  accountPayload,
  activeAccount,
} from "../lib/administration";
import type { Account, AccountOperation, Role } from "../lib/administration";
import type { CatalogRecord } from "../lib/catalog";
import { catalogName } from "../lib/catalog";
import AdminDialog from "./AdminDialog";
import { ErrorState, Loading } from "./ui";

export default function AccountEditor({
  operation,
  account,
  onClose,
}: {
  operation: AccountOperation;
  account?: Account;
  onClose: (message?: string) => void;
}) {
  const { user } = useAuth();
  const canAssignRole = !!user?.permissions.includes("role.manage");
  const [values, setValues] = useState<Record<string, string>>({
    first_name: account?.first_name ?? "",
    last_name: account?.last_name ?? "",
    username: "",
    email: "",
    password: "",
    role_id: String(account?.role_id ?? ""),
    department_id: String(account?.department_id ?? ""),
  });
  const needsDepartments = ["create", "department"].includes(operation);
  const needsRoles = ["create", "role"].includes(operation);
  const options = useQuery({
    queryKey: ["admin-options", operation],
    enabled: needsDepartments || needsRoles,
    queryFn: async ({ signal }) => {
      const [roles, departments] = await Promise.all([
        needsRoles
          ? api.request<Role[]>("/roles", { signal })
          : Promise.resolve([]),
        needsDepartments
          ? (async () => {
              const all: CatalogRecord[] = [];
              for (let page = 1; ; page++) {
                const batch = await api.request<CatalogRecord[]>(
                  `/departments?per_page=100&page=${page}`,
                  { signal },
                );
                all.push(...batch);
                if (batch.length < 100) return all;
              }
            })()
          : Promise.resolve([]),
      ]);
      return { roles, departments };
    },
  });
  const loading = (needsDepartments || needsRoles) && options.isPending;
  const failed = (needsDepartments || needsRoles) && !!options.error;
  const noDepartments = needsDepartments && options.isSuccess && options.data.departments.length === 0;
  function field(key: string, label: string, type = "text") {
    return (
      <div className="field">
        <label htmlFor={`admin-${key}`}>{label}</label>
        <input
          id={`admin-${key}`}
          type={type}
          value={values[key]}
          required
          autoComplete={type === "password" ? "new-password" : "off"}
          onChange={(event) =>
            setValues({ ...values, [key]: event.target.value })
          }
        />
      </div>
    );
  }
  function selection(key: "role_id" | "department_id", label: string) {
    const items =
      key === "role_id"
        ? options.data?.roles.map((row) => ({
            id: row.id,
            name: row.role_name.replaceAll("_", " "),
          }))
        : options.data?.departments.map((row) => ({
            id: row.id,
            name: catalogName(row),
          }));
    return (
      <div className="field">
        <label htmlFor={`admin-${key}`}>{label}</label>
        <select
          id={`admin-${key}`}
          value={values[key]}
          required
          disabled={key === "department_id" && noDepartments}
          onChange={(event) =>
            setValues({ ...values, [key]: event.target.value })
          }
        >
          <option value="">Select {label.toLowerCase()}</option>
          {account &&
            values[key] === String(account[key]) &&
            !items?.some((row) => Number(row.id) === Number(account[key])) && (
              <option value={values[key]}>
                Current #{values[key]} (unavailable)
              </option>
            )}
          {items?.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </div>
    );
  }
  const roleName =
    options.data?.roles
      .find((row) => Number(row.id) === Number(values.role_id))
      ?.role_name.replaceAll("_", " ") || "faculty employee";
  const departmentName = options.data?.departments.find(
    (row) => Number(row.id) === Number(values.department_id),
  );
  return (
    <AdminDialog
      title={accountLabels[operation]}
      onClose={onClose}
      ready={!loading && !failed && !noDepartments}
      prepare={() => ({
        path:
          operation === "create"
            ? "/users"
            : `/users/${account!.id}${operation === "profile" ? "" : `/${operation}`}`,
        method: operation === "create" ? "POST" : "PATCH",
        body: accountPayload(operation, values, canAssignRole, account),
      })}
      review={
        <>
          <h3>
            {account
              ? accountName(account)
              : `${values.first_name} ${values.last_name}`}
          </h3>
          {operation === "create" && (
            <>
              <p>
                {values.username} · {values.email}
              </p>
              <p>
                New active account ·{" "}
                {canAssignRole ? roleName : "faculty employee"}
              </p>
              <p>
                The initial password will be set as entered. It is never shown
                in this review.
              </p>
            </>
          )}
          {operation === "profile" && (
            <p>
              Name: {values.first_name} {values.last_name}
            </p>
          )}
          {(operation === "create" || operation === "department") && (
            <p>
              Department:{" "}
              {departmentName
                ? catalogName(departmentName)
                : `#${values.department_id}`}
            </p>
          )}
          {operation === "role" && (
            <>
              <p>
                Role: {account?.role_name?.replaceAll("_", " ")} → {roleName}
              </p>
              <p>
                This replaces the account’s current role and changes its live
                access. Existing refresh tokens are revoked; the account may
                need to sign in again.
              </p>
            </>
          )}
          {operation === "status" && (
            <p>
              {account && activeAccount(account)
                ? "Deactivate this account? It will lose access to authenticated requests."
                : "Reactivate this account? Its assigned role and permissions will become available again."}
            </p>
          )}
        </>
      }
    >
      {account && (
        <p className="muted">
          {accountName(account)} · {account.username}
        </p>
      )}
      {loading && <Loading label="Loading account options…" />}
      {failed && (
        <ErrorState
          error={options.error!}
          retry={() => void options.refetch()}
        />
      )}
      {noDepartments && (
        <div className="notice" role="status">
          <p>No active departments are available. An active department is required to create an account or change its department.</p>
          {user?.permissions.includes("department.manage") ? (
            <p><Link className="underline" to="/manage/departments">Manage departments</Link> to create or activate one, then return to this form.</p>
          ) : (
            <p>Ask an administrator with department management access to create or activate a department.</p>
          )}
        </div>
      )}
      {!loading && !failed && !noDepartments && (
        <>
          {["create", "profile"].includes(operation) && (
            <>
              {field("first_name", "First name")}
              {field("last_name", "Last name")}
            </>
          )}
          {operation === "create" && (
            <>
              {field("username", "Username")}
              {field("email", "Email address", "email")}
              {field("password", "Initial password", "password")}
              <p className="muted">
                Use 12–72 bytes. Password spaces are preserved. No default
                password is provided.
              </p>
              {canAssignRole ? (
                selection("role_id", "Role")
              ) : (
                <p className="notice">
                  New accounts receive the faculty employee role. Assigning
                  another role requires role management access.
                </p>
              )}
            </>
          )}
          {operation === "role" && selection("role_id", "Role")}
          {needsDepartments && selection("department_id", "Department")}
          {operation === "status" && (
            <p>
              {account && activeAccount(account) ? "Deactivate" : "Reactivate"}{" "}
              this account? Your own account status cannot be changed here.
            </p>
          )}
        </>
      )}
    </AdminDialog>
  );
}
