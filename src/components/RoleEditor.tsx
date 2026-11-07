import { useState } from "react";
import { rolePayload } from "../lib/administration";
import type { Role } from "../lib/administration";
import AdminDialog from "./AdminDialog";

export default function RoleEditor({
  role,
  onClose,
}: {
  role?: Role;
  onClose: (message?: string) => void;
}) {
  const [values, setValues] = useState({
    role_name: role?.role_name ?? "",
    description: role?.description ?? "",
  });
  return (
    <AdminDialog
      title={role ? "Edit role" : "Create role"}
      onClose={onClose}
      prepare={() => ({
        path: role ? `/roles/${role.id}` : "/roles",
        method: role ? "PATCH" : "POST",
        body: rolePayload(values, role),
      })}
      review={
        <>
          <h3>{values.role_name.replaceAll("_", " ")}</h3>
          <p>{values.description || "No description"}</p>
          <p>
            {role
              ? "This updates the role details. Assigned permissions are unchanged."
              : "New roles start with no permissions. Configure their grants separately before assigning accounts."}
          </p>
        </>
      }
    >
      <div className="field">
        <label htmlFor="role-name">Role name</label>
        <input
          id="role-name"
          required
          value={values.role_name}
          onChange={(event) =>
            setValues({ ...values, role_name: event.target.value })
          }
        />
        <p className="muted">
          Use 3–80 lowercase letters, digits or underscores, starting with a
          letter. System role names are protected by the server.
        </p>
      </div>
      <div className="field">
        <label htmlFor="role-description">Description</label>
        <textarea
          id="role-description"
          rows={3}
          value={values.description}
          onChange={(event) =>
            setValues({ ...values, description: event.target.value })
          }
        />
      </div>
    </AdminDialog>
  );
}
