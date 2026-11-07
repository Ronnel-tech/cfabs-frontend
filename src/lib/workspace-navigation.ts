import type { Profile } from './types';
import { canRequest } from './booking-access.ts';
import { canManage } from './catalog.ts';

export type WorkspaceLink = { to: string; label: string; icon: string };

export function workspaceNavigation(user: Profile): WorkspaceLink[] {
  const links: WorkspaceLink[] = [{ to: '/', label: 'Dashboard', icon: '▦' }];
  const has = (permission: string) => user.permissions.includes(permission);
  const admin = user.role_name === 'system_admin';
  const facilityStaff = user.role_name === 'booking_admin';
  const assetStaff = user.role_name === 'asset_custodian';
  const requester = canRequest(user, 'facility') || canRequest(user, 'asset');
  const add = (to: string, label: string, icon: string) => links.push({ to, label, icon });

  if (canRequest(user, 'facility') && has('facility.view')) add('/facilities', 'Book a facility', '▥');
  if (canRequest(user, 'asset') && has('asset.view')) add('/assets', 'Borrow assets', '▧');
  if (requester) {
    add('/requests', 'My requests', '▤');
    if (has('facility.view') || has('asset.view')) add('/calendar', 'Availability calendar', '▦');
  }

  const facilityReview = has('facility_booking.view_all');
  const assetReview = has('asset_booking.view_all');
  if (facilityReview || assetReview) add('/review', facilityReview && assetReview ? 'Request review' : facilityReview ? 'Facility requests' : 'Asset requests & handovers', '✓');

  if (has('user.manage')) add('/administration/accounts', 'User accounts', '○');
  if (has('role.manage') || has('permission.manage')) add('/administration/roles', 'Roles & permissions', '○');
  if (canManage('departments', user.permissions)) add('/manage/departments', 'Departments', '▥');
  if (canManage('facilities', user.permissions) && !assetStaff) add('/manage/facilities', 'Manage facilities', '▥');
  if (canManage('assets', user.permissions) && !facilityStaff) add('/manage/assets', 'Manage assets', '▧');
  if (has('asset.view') && !facilityStaff) add('/asset-qr', assetStaff ? 'Scan for handover' : 'Scan asset label', '▧');
  if (!facilityStaff) add('/asset-problems', admin ? 'Review asset problems' : assetStaff ? 'Asset repair work' : 'My asset reports', '!');
  if (has('facility.maintenance.manage')) add('/maintenance/facility', 'Facility maintenance', '⚒');
  if (has('asset.maintenance.manage')) add('/maintenance/asset', 'Asset maintenance', '⚒');
  if (has('report.facility.view') || has('report.asset.view')) {
    add('/reports', admin ? 'Reports & exports' : facilityStaff ? 'Facility reports' : assetStaff ? 'Asset reports' : 'Reports', '▤');
  }
  if (has('audit.view')) add('/audit', 'Audit history', '▤');
  add('/notifications', 'Notifications', '◷');
  add('/account', 'My account', '○');
  return links;
}
