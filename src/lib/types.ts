export type Profile = {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_name: string | null;
  department_id: number | null;
  permissions: string[];
};
export type Dashboard = {
  scope: 'personal' | 'facility' | 'asset' | 'administration' | 'operations' | 'staff';
  catalog_totals: Partial<Record<'users' | 'departments' | 'facilities' | 'assets', number>> | null;
  start_utc: string;
  end_utc: string;
  facility_bookings: Record<string, number>;
  asset_bookings: Record<string, number>;
  overdue_assets: {
    id: number;
    booking_reference: string;
    outstanding_quantity: number;
    expected_return: string;
  }[];
};
export type Notice = {
  id: number;
  title: string;
  message: string;
  is_read: number | string;
  notification_type: string;
  created_at: string;
};

export const displayName = (user: Profile) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;
export const roleName = (user: Profile) =>
  (user.role_name || "Campus member").replaceAll("_", " ");
export function campusDate(value: string, time = false) {
  const date = new Date(
    value.replace(" ", "T") + (/[zZ]|[+-]\d\d:\d\d$/.test(value) ? "" : "Z"),
  );
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}
