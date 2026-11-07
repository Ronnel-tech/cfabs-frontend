import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRequest } from '../src/lib/booking-access.ts';
import { dashboardMode } from '../src/lib/dashboard.ts';
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
