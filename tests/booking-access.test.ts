import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRequest } from '../src/lib/booking-access.ts';
import { dashboardMode } from '../src/lib/dashboard.ts';
import { workspaceNavigation } from '../src/lib/workspace-navigation.ts';
import type { Profile } from '../src/lib/types';

const profile = (role_name: string, permissions: string[]): Profile => ({ id: 1, username: 'test', email: 'test@example.invalid', first_name: null, last_name: null, role_name, department_id: 1, permissions });

test('requesters require the matching booking grant', () => {
  const user = profile('faculty_employee', ['facility_booking.create']);
  assert.equal(canRequest(user, 'facility'), true);
  assert.equal(canRequest(user, 'asset'), false);
  assert.equal(canRequest(null, 'facility'), false);
});
test('staff cannot book even with stale creation grants', () => {
  for (const role of ['system_admin', 'booking_admin', 'asset_custodian']) {
    const user = profile(role, ['facility_booking.create', 'asset_booking.create']);
    assert.equal(canRequest(user, 'facility'), false);
    assert.equal(canRequest(user, 'asset'), false);
  }
});
test('dashboard presentation follows role and current review permissions', () => {
  assert.equal(dashboardMode(profile('system_admin', [])), 'administration');
  assert.equal(dashboardMode(profile('booking_admin', ['facility_booking.view_all'])), 'facility');
  assert.equal(dashboardMode(profile('asset_custodian', ['asset_booking.view_all'])), 'asset');
  assert.equal(dashboardMode(profile('booking_admin', [])), 'staff');
  assert.equal(dashboardMode(profile('faculty_employee', [])), 'personal');
  assert.equal(dashboardMode(profile('custom', ['facility_booking.view_all','asset_booking.view_all'])), 'operations');
});

test('requester navigation focuses on booking and personal work', () => {
  const links = workspaceNavigation(profile('faculty_employee', ['facility.view', 'asset.view', 'facility_booking.create', 'asset_booking.create']));
  assert.ok(links.some(link => link.label === 'Book a facility'));
  assert.ok(links.some(link => link.label === 'Borrow assets'));
  assert.ok(links.some(link => link.to === '/requests'));
  assert.equal(links.some(link => link.to.startsWith('/manage') || link.to === '/review'), false);
});
test('facility navigation removes asset browsing and borrowing controls', () => {
  const links = workspaceNavigation(profile('booking_admin', ['facility.view', 'asset.view', 'facility.create', 'facility_booking.view_all', 'facility_booking.create', 'asset_booking.create', 'facility.maintenance.manage', 'report.facility.view']));
  assert.ok(links.some(link => link.label === 'Facility requests'));
  assert.ok(links.some(link => link.to === '/manage/facilities'));
  assert.equal(links.some(link => ['/facilities','/assets','/requests','/calendar','/asset-qr','/asset-problems'].includes(link.to)), false);
});
test('custodian navigation focuses on inventory, handovers and repairs', () => {
  const links = workspaceNavigation(profile('asset_custodian', ['facility.view', 'asset.view', 'asset.create', 'asset_booking.view_all', 'asset_booking.create', 'asset.maintenance.manage', 'report.asset.view']));
  assert.ok(links.some(link => link.label === 'Asset requests & handovers'));
  assert.ok(links.some(link => link.to === '/manage/assets'));
  assert.ok(links.some(link => link.label === 'Scan for handover'));
  assert.equal(links.some(link => ['/facilities','/assets','/requests','/calendar','/manage/facilities'].includes(link.to)), false);
});
test('administrator navigation exposes authorized management tools and no booking browser', () => {
  const user = profile('system_admin', ['facility.view','asset.view','facility.create','asset.create','user.manage','role.manage','department.manage','audit.view','report.asset.view']);
  const links = workspaceNavigation(user);
  for (const to of ['/administration/accounts','/administration/roles','/manage/departments','/manage/facilities','/manage/assets','/reports','/audit']) assert.ok(links.some(link => link.to === to));
  assert.equal(links.some(link => ['/facilities','/assets','/requests','/calendar'].includes(link.to)), false);
  const restricted = workspaceNavigation(profile('system_admin', []));
  assert.equal(restricted.some(link => link.to.startsWith('/administration') || link.to.startsWith('/manage') || link.to === '/audit' || link.to === '/reports'), false);
});
