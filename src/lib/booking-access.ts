import type { Profile } from './types';
import type { ResourceKind } from './availability';

export function canRequest(user: Profile | null | undefined, kind: ResourceKind): boolean {
  return !!user && !['system_admin', 'booking_admin', 'asset_custodian'].includes(user.role_name ?? '')
    && user.permissions.includes(`${kind}_booking.create`);
}
