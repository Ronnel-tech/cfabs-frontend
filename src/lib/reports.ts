import { campusInstant } from './availability.ts'
import { utcInstant } from './handovers.ts'

export type ReportMode = 'facility' | 'asset' | 'inventory'
export type ReportFormat = 'csv' | 'xlsx' | 'pdf'
export const canExportDocuments = (role: string | null | undefined) => role === 'system_admin'
export type ReportFilters = { start: string; end: string; resource_id: string; category_id: string; department_id: string; requester_id: string; status: string; tracking_mode: string }
export const emptyReportFilters = (): ReportFilters => ({ start: '', end: '', resource_id: '', category_id: '', department_id: '', requester_id: '', status: '', tracking_mode: '' })
export const reportStatuses = (mode: ReportMode) => mode === 'inventory' ? ['active', 'inactive', 'retired', 'maintenance'] : mode === 'facility' ? ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'] : ['PENDING', 'APPROVED', 'READY_FOR_RELEASE', 'RELEASED', 'RETURNED', 'COMPLETED', 'REJECTED', 'CANCELLED']
export function reportParams(mode: ReportMode, values: ReportFilters) {
  const params = new URLSearchParams()
  if (mode !== 'inventory') {
    if (!!values.start !== !!values.end) throw new Error('Provide both a start and end date, or leave both empty for the preceding 30 days.')
    if (values.start && values.end) {
      const start = campusInstant(values.start), end = campusInstant(values.end)
      if (!start || !end || Date.parse(end) <= Date.parse(start)) throw new Error('Choose valid dates with the end after the start.')
      params.set('start', start); params.set('end', end)
    }
  }
  for (const key of ['resource_id', 'category_id', 'department_id', ...(mode === 'inventory' ? [] : ['requester_id'])] as (keyof ReportFilters)[]) {
    const value = values[key].trim()
    if (!value) continue
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Record IDs must be positive whole numbers.')
    params.set(key, value)
  }
  if (values.status) {
    if (!reportStatuses(mode).includes(values.status)) throw new Error('Choose a valid status for this report.')
    params.set('status', values.status)
  }
  if (mode === 'inventory' && values.tracking_mode) {
    if (!['quantity', 'individual'].includes(values.tracking_mode)) throw new Error('Choose a valid tracking mode.')
    params.set('tracking_mode', values.tracking_mode)
  }
  return params.toString()
}
export function reportPath(mode: ReportMode, filters: string, page?: number, format: ReportFormat = 'csv') {
  const params = new URLSearchParams(filters)
  if (page === undefined) { params.delete('page'); params.delete('per_page'); params.set('format', format) }
  else { params.set('page', String(page)); params.set('per_page', '20') }
  return `/reports/${mode === 'facility' ? 'facilities' : mode === 'asset' ? 'assets' : 'inventory'}?${params}`
}
export type OperationalReport = {
  start_utc: string; end_utc: string; bookings_by_status: Record<string, number>
  resources: { resource_id: number; resource_name: string; booking_count: number; reserved_seconds: number }[]
  currently_overdue?: { id: number; booking_reference: string; asset_id: number; requester_id: number; expected_return: string; outstanding_quantity: number }[]
  pagination: { has_more: boolean }
}
export type InventoryReport = {
  records: { resource_id: number; asset_code: string; asset_name: string; tracking_mode: string; category_id: number; owning_department_id: number; status: string; registered_quantity: number; usable_quantity: number }[]
  pagination: { has_more: boolean }
}
export function reportExportPath(mode: ReportMode, filters: string, period?: Pick<OperationalReport, 'start_utc' | 'end_utc'>, format: ReportFormat = 'csv') {
  if (mode === 'inventory') return reportPath(mode, filters, undefined, format)
  if (!period) throw new Error('Load the report before exporting.')
  const start = utcInstant(period.start_utc), end = utcInstant(period.end_utc)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Refresh the report to load a valid reporting period.')
  const params = new URLSearchParams(filters)
  params.set('start', new Date(start).toISOString().replace(/\.\d{3}Z$/, 'Z'))
  params.set('end', new Date(end).toISOString().replace(/\.\d{3}Z$/, 'Z'))
  return reportPath(mode, params.toString(), undefined, format)
}
