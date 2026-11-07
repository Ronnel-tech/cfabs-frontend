import { campusInstant } from './availability.ts'
import type { Resource, ResourceKind } from './availability.ts'
import { utcInstant } from './handovers.ts'

export type MaintenanceResource = Resource & { usable_quantity?: number }
export type MaintenanceItem = { id: number; asset_tag: string; serial_number: string | null; status: string; condition_status: string }
export type MaintenanceRecord = { id: number; facility_id?: number; asset_id?: number; asset_instance_id?: number | null; asset_tag?: string | null; quantity_affected?: number; start_datetime: string; end_datetime?: string; expected_completion?: string | null; status: string; reason: string; completed_by: number | null; completed_at?: string | null; actual_completion?: string | null }
export const maintenancePath = (kind: ResourceKind) => `/${kind}-maintenance`
export const maintenanceEnd = (kind: ResourceKind, row: MaintenanceRecord) => kind === 'facility' ? row.end_datetime : row.expected_completion
export function maintenancePhase(kind: ResourceKind, row: MaintenanceRecord, now = Date.now()) {
  if (!['scheduled', 'in_progress'].includes(row.status)) return row.status
  if (utcInstant(row.start_datetime) > now) return 'Scheduled'
  const end = maintenanceEnd(kind, row)
  return end && utcInstant(end) <= now ? 'Overdue · still blocking' : 'Currently active'
}
export function maintenanceActions(row: MaintenanceRecord, permitted: boolean, now = Date.now()): ('complete' | 'cancel')[] {
  if (!permitted || !['scheduled', 'in_progress'].includes(row.status)) return []
  return utcInstant(row.start_datetime) <= now ? ['complete', 'cancel'] : ['cancel']
}
export function maintenancePayload(kind: ResourceKind, resource: MaintenanceResource | undefined, values: Record<string, string>, items: MaintenanceItem[] = [], now = Date.now()) {
  if (!resource) throw new Error('Choose a resource from the current catalog.')
  const start = campusInstant(values.start ?? ''), end = values.end ? campusInstant(values.end) : null
  if (!start || (values.end && !end) || (kind === 'facility' && !end)) throw new Error('Choose valid start and end dates. Facilities require an end date.')
  if (end && (Date.parse(end) <= Date.parse(start) || Date.parse(end) <= now)) throw new Error('Expected completion must be after the start and in the future.')
  const reason = (values.reason ?? '').trim()
  if (!reason || new TextEncoder().encode(reason).length > 4000) throw new Error('Reason is required and must be at most 4000 bytes.')
  const result: Record<string, string | number> = { [`${kind}_id`]: Number(resource.id), start_datetime: start, reason }
  if (end) result[kind === 'facility' ? 'end_datetime' : 'expected_completion'] = end
  if (kind === 'asset') {
    if (resource.tracking_mode === 'individual') {
      if (!items.some(item => Number(item.id) === Number(values.item_id)) || !/^[1-9]\d*$/.test(values.item_id ?? '')) throw new Error('Select a specific item belonging to this asset.')
      result.asset_instance_id = Number(values.item_id); result.quantity_affected = 1
    } else if (resource.tracking_mode === 'quantity') {
      const quantity = Number(values.quantity)
      if (!/^[1-9]\d*$/.test(values.quantity ?? '') || !Number.isSafeInteger(quantity) || quantity > 4294967295 || quantity > Number(resource.usable_quantity ?? 0)) throw new Error('Affected quantity must be a positive whole number within usable stock.')
      result.quantity_affected = quantity
    } else throw new Error('Refresh this asset to load its tracking mode.')
  }
  return result
}
