import { emptyReportFilters, reportParams } from './reports.ts'

export type AuditFilters = { start: string; end: string; actor_user_id: string; entity_type: string; action: string }
export const emptyAuditFilters = (): AuditFilters => ({ start: '', end: '', actor_user_id: '', entity_type: '', action: '' })
export function auditParams(values: AuditFilters) {
  const params = new URLSearchParams(reportParams('facility', { ...emptyReportFilters(), start: values.start, end: values.end }))
  const actor = values.actor_user_id.trim()
  if (actor) {
    if (!/^[1-9]\d*$/.test(actor) || !Number.isSafeInteger(Number(actor))) throw new Error('Actor account ID must be a positive whole number.')
    params.set('actor_user_id', actor)
  }
  for (const [key, limit] of [['entity_type', 80], ['action', 100]] as const) {
    const value = values[key].trim()
    if (!value) continue
    if (new TextEncoder().encode(value).length > limit) throw new Error(`${key === 'action' ? 'Action' : 'Entity type'} must be at most ${limit} bytes.`)
    params.set(key, value)
  }
  return params.toString()
}
export type AuditRecord = { id: number; actor_user_id: number | null; entity_type: string; entity_id: number | null; action: string; old_values_json: string | null; new_values_json: string | null; created_at: string }
export type AuditResult = { records: AuditRecord[]; pagination: { total: number; page: number; per_page: number } }
export function auditValues(value: string | null) {
  if (value === null) return 'No recorded values'
  try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
}
