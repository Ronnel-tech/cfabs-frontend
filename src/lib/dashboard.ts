import type { Dashboard, Profile } from './types';

export function dashboardMode(user: Profile | null): Dashboard['scope'] {
  if (user?.role_name === 'system_admin') return 'administration';
  const facility = user?.permissions.includes('facility_booking.view_all');
  const asset = user?.permissions.includes('asset_booking.view_all');
  if (facility && asset) return 'operations';
  if (facility) return 'facility';
  if (asset) return 'asset';
  return ['booking_admin', 'asset_custodian'].includes(user?.role_name ?? '') ? 'staff' : 'personal';
}

export const dashboardCopy = {
  personal: { title: 'My booking overview', intro: 'Track your requests, upcoming reservations, and equipment returns.' },
  facility: { title: 'Facility operations', intro: 'Review facility requests and monitor campus space reservations.' },
  asset: { title: 'Asset custody', intro: 'Review asset requests, coordinate handovers, and follow up on overdue returns.' },
  administration: { title: 'System administration', intro: 'Manage campus accounts and resources, and monitor booking activity.' },
  operations: { title: 'Booking operations', intro: 'Review facility and asset requests and monitor reservations and custody.' },
  staff: { title: 'Staff workspace', intro: 'Use your assigned management tools. Booking creation is reserved for requesters.' },
};
