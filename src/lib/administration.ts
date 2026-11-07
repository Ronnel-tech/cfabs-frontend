export type Account = {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  department_id: number | null;
  role_id: number | null;
  role_name: string | null;
  is_active: number | string;
  last_login_at: string | null;
};
export type Role = {
  id: number;
  role_name: string;
  description: string | null;
};
export type Permission = {
  id: number;
  permission_key: string;
  description: string | null;
};
export type AccountOperation =
  | "create"
  | "profile"
  | "department"
  | "role"
  | "status";
export const accountLabels: Record<AccountOperation, string> = {
  create: "Create account",
  profile: "Edit name",
  role: "Change role",
  department: "Change department",
  status: "Change account status",
};
export const accountName = (account: Account) =>
  [account.first_name, account.last_name].filter(Boolean).join(" ") ||
  account.username;
export const activeAccount = (account: Account) =>
  Number(account.is_active) === 1;
export function accountActions(
  account: Account,
  actor: { id: number; permissions: string[] },
): AccountOperation[] {
  if (!actor.permissions.includes("user.manage")) return [];
  return [
    "profile",
    "department",
    ...(actor.permissions.includes("role.manage") ? ["role" as const] : []),
    ...(Number(account.id) !== Number(actor.id) ? ["status" as const] : []),
  ];
}
const bytes = (value: string) => new TextEncoder().encode(value).length;
export function validatePassword(password: string) {
  if (bytes(password) < 12 || bytes(password) > 72 || password.includes("\0"))
    throw new Error("Password must contain 12–72 bytes without NUL characters.");
}
function requiredText(value: string, label: string, maximum: number) {
  const text = value.trim();
  if (!text || bytes(text) > maximum)
    throw new Error(
      `${label} is required and must be at most ${maximum} bytes.`,
    );
  return text;
}
function positiveId(value: string, label: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new Error(`Select a valid ${label}.`);
  return Number(value);
}
export function accountPayload(
  operation: AccountOperation,
  values: Record<string, string>,
  canAssignRole: boolean,
  account?: Account,
) {
  if (operation === "status") {
    if (!account) throw new Error("Select an account first.");
    return { is_active: !activeAccount(account) };
  }
  if (operation === "role") {
    if (!canAssignRole)
      throw new Error("Role assignment requires role management access.");
    const role_id = positiveId(values.role_id, "role");
    if (account && role_id === Number(account.role_id))
      throw new Error("Select a different role.");
    return { role_id };
  }
  if (operation === "department") {
    const department_id = positiveId(values.department_id, "department");
    if (account && department_id === Number(account.department_id))
      throw new Error("Select a different department.");
    return { department_id };
  }
  const names = {
    first_name: requiredText(values.first_name ?? "", "First name", 100),
    last_name: requiredText(values.last_name ?? "", "Last name", 100),
  };
  if (operation === "profile") {
    const changes = Object.fromEntries(
      Object.entries(names).filter(
        ([key, value]) => account?.[key as keyof Account] !== value,
      ),
    );
    if (!Object.keys(changes).length) throw new Error("No changes to save.");
    return changes;
  }
  const username = values.username ?? "",
    email = (values.email ?? "").trim(),
    password = values.password ?? "";
  if (!/^[A-Za-z0-9_.-]{3,100}$/.test(username))
    throw new Error(
      "Username must contain 3–100 letters, digits, dots, underscores or hyphens.",
    );
  if (bytes(email) > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid email address.");
  validatePassword(password);
  return {
    ...names,
    username,
    email,
    password,
    department_id: positiveId(values.department_id, "department"),
    ...(canAssignRole ? { role_id: positiveId(values.role_id, "role") } : {}),
  };
}
export function rolePayload(values: Record<string, string>, original?: Role) {
  if (!/^[a-z][a-z0-9_]{2,79}$/.test(values.role_name ?? ""))
    throw new Error(
      "Role names must use 3–80 lowercase letters, digits or underscores, starting with a letter.",
    );
  const description = values.description?.trim() || null;
  if (description && bytes(description) > 255)
    throw new Error("Description must be at most 255 bytes.");
  const body = { role_name: values.role_name, description };
  const changes = Object.fromEntries(
    Object.entries(body).filter(
      ([key, value]) => !original || original[key as keyof Role] !== value,
    ),
  );
  if (!Object.keys(changes).length) throw new Error("No changes to save.");
  return changes;
}
export function permissionChanges(before: string[], after: string[]) {
  if (after.length > 200 || new Set(after).size !== after.length)
    throw new Error("Select at most 200 distinct registered permissions.");
  return {
    added: after.filter((key) => !before.includes(key)).sort(),
    removed: before.filter((key) => !after.includes(key)).sort(),
  };
}
export const samePermissions = (left: string[], right: string[]) =>
  left.length === right.length && left.every((key) => right.includes(key));
export function permissionDescription(key: string) {
  const split = key.lastIndexOf(".");
  const domains: Record<string, string> = {
    asset_booking: "asset bookings",
    facility_booking: "facility bookings",
    asset: "assets",
    facility: "facilities",
    "asset.category": "asset categories",
    "facility.category": "facility categories",
    "asset.condition": "asset condition and losses",
    "asset.maintenance": "asset maintenance",
    "facility.maintenance": "facility maintenance",
    "asset.policy": "asset policies",
    "facility.policy": "facility policies",
    department: "departments",
    user: "campus accounts",
    role: "roles",
    permission: "role permissions",
    audit: "audit history",
    "report.asset": "asset reports",
    "report.facility": "facility reports",
  };
  const actions: Record<string, string> = {
    view: "View",
    view_all: "View all",
    create: "Create",
    update: "Edit",
    deactivate: "Deactivate",
    manage: "Manage",
    approve: "Approve",
    reject: "Reject",
    cancel_any: "Cancel other users’",
    release: "Release assets for",
    return: "Record returns for",
  };
  const domain = domains[key.slice(0, split)],
    action = actions[key.slice(split + 1)];
  return domain && action ? `${action} ${domain}` : key;
}
