import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../lib/session'
import { api } from '../lib/api'
import { catalogName } from '../lib/catalog'
import type { CatalogRecord } from '../lib/catalog'
import { emptyReportFilters, reportParams, reportStatuses } from '../lib/reports'
import type { ReportMode } from '../lib/reports'
import { Button } from './ui'

export default function ReportFilters({ mode, disabled, onApply }: { mode: ReportMode; disabled: boolean; onApply: (filters: string) => void }) {
  const [values, setValues] = useState(emptyReportFilters)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const kind = mode === 'facility' ? 'facility' : 'asset'
  const permissions = user?.permissions ?? []
  const lookups = useQuery({ queryKey: ['report-lookups', kind, permissions], staleTime: 300_000, refetchInterval: false, refetchOnWindowFocus: false, queryFn: async ({ signal }) => {
    const endpoints = [
      { key: 'department_id', path: 'departments', inactive: permissions.includes('department.manage') },
      { key: 'category_id', path: `${kind}-categories`, inactive: permissions.includes(`${kind}.category.manage`) },
      ...(permissions.includes(`${kind}.view`) ? [{ key: 'resource_id', path: kind === 'facility' ? 'facilities' : 'assets', inactive: permissions.includes(`${kind}.update`) }] : []),
    ]
    return Object.fromEntries(await Promise.all(endpoints.map(async endpoint => {
      const rows: CatalogRecord[] = []
      for (let page = 1; ; page++) {
        const batch = await api.request<CatalogRecord[]>(`/${endpoint.path}?page=${page}&per_page=100${endpoint.inactive ? '&include_inactive=1' : ''}`, { signal })
        rows.push(...batch)
        if (batch.length < 100) return [endpoint.key, rows]
      }
    }))) as Record<string, CatalogRecord[]>
  } })
  return <form className="report-filters" onSubmit={event => {
    event.preventDefault()
    try { const params = reportParams(mode, values); setError(''); onApply(params) }
    catch (failure) { setError((failure as Error).message) }
  }}>
    <fieldset disabled={disabled}><legend>Report filters</legend>
      {mode !== 'inventory' && <><div className="field"><label htmlFor="report-start">Period start · Asia/Manila</label><input id="report-start" type="datetime-local" value={values.start} onChange={event => setValues({ ...values, start: event.target.value })} /></div><div className="field"><label htmlFor="report-end">Period end · Asia/Manila</label><input id="report-end" type="datetime-local" value={values.end} onChange={event => setValues({ ...values, end: event.target.value })} /></div></>}
      {(['resource_id', 'department_id', 'category_id', ...(mode === 'inventory' ? [] : ['requester_id'])] as const).map(key => <div className="field" key={key}><label htmlFor={`report-${key}`}>{key === 'resource_id' ? (mode === 'facility' ? 'Facility ID' : 'Asset ID') : key === 'department_id' ? (mode === 'inventory' ? 'Owning department ID' : 'Requester department ID') : key === 'category_id' ? 'Category ID' : 'Requester account ID'}</label><input id={`report-${key}`} type="text" pattern="[1-9][0-9]*" placeholder="All" list={`report-options-${key}`} value={values[key as keyof typeof values]} onChange={event => setValues({ ...values, [key]: event.target.value })} /><datalist id={`report-options-${key}`}>{lookups.data?.[key]?.map(row => <option key={row.id} value={row.id} label={`${catalogName(row)} · #${row.id}`} />)}</datalist></div>)}
      <div className="field"><label htmlFor="report-status">{mode === 'inventory' ? 'Asset status' : 'Booking status'}</label><select id="report-status" value={values.status} onChange={event => setValues({ ...values, status: event.target.value })}><option value="">All statuses</option>{reportStatuses(mode).map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></div>
      {mode === 'inventory' && <div className="field"><label htmlFor="report-tracking">Tracking mode</label><select id="report-tracking" value={values.tracking_mode} onChange={event => setValues({ ...values, tracking_mode: event.target.value })}><option value="">All tracking modes</option><option value="quantity">Quantity pools</option><option value="individual">Individually tagged</option></select></div>}
    </fieldset>
    <p className="muted">Choose a name suggestion or enter a record’s # ID. Historical IDs can be entered directly. Empty fields include all matching records.{mode !== 'inventory' && ' Leave both dates empty for the preceding 30 days. The end is exclusive.'}</p>
    {lookups.isPending && <p className="muted" role="status">Loading filter suggestions…</p>}{lookups.error && <p className="muted">Suggestions are unavailable. Record ID filters still work. <Button type="button" variant="quiet" onClick={() => void lookups.refetch()}>Retry suggestions</Button></p>}
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <div className="action-buttons"><Button type="submit" disabled={disabled}>Apply filters</Button><Button type="button" variant="secondary" disabled={disabled} onClick={() => { setValues(emptyReportFilters()); setError(''); onApply('') }}>Reset filters</Button></div>
  </form>
}
