import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { api } from '../lib/api'
import { useAuth } from '../lib/session'
import { campusDate } from '../lib/types'
import { auditParams, auditValues, emptyAuditFilters } from '../lib/audit'
import type { AuditResult } from '../lib/audit'
import { Button, EmptyState, ErrorState, Loading, PageHeading } from '../components/ui'

export default function Audit() {
  const { user } = useAuth()
  const permitted = !!user?.permissions.includes('audit.view')
  const [values, setValues] = useState(emptyAuditFilters)
  const [filters, setFilters] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const query = useQuery({ queryKey: ['audit', filters, page], staleTime: 0, enabled: permitted, queryFn: ({ signal }) => {
    const params = new URLSearchParams(filters)
    params.set('page', String(page)); params.set('per_page', '20')
    return api.request<AuditResult>(`/audit-logs?${params}`, { signal })
  } })
  if (!permitted) return <Navigate to="/" replace />
  return <><PageHeading eyebrow="Administrative history" title="Audit history">Review who changed a record, when it happened, and the values recorded by the system.</PageHeading>
    <form className="report-filters" onSubmit={event => {
      event.preventDefault()
      try { const params = auditParams(values); setFilters(params); setPage(1); setError('') }
      catch (failure) { setError((failure as Error).message) }
    }}><fieldset><legend>Filter history</legend>
      <div className="field"><label htmlFor="audit-start">Period start · Asia/Manila</label><input id="audit-start" type="datetime-local" value={values.start} onChange={event => setValues({ ...values, start: event.target.value })} /></div>
      <div className="field"><label htmlFor="audit-end">Period end · Asia/Manila</label><input id="audit-end" type="datetime-local" value={values.end} onChange={event => setValues({ ...values, end: event.target.value })} /></div>
      <div className="field"><label htmlFor="audit-actor">Actor account ID</label><input id="audit-actor" type="text" inputMode="numeric" pattern="[1-9][0-9]*" placeholder="All accounts" value={values.actor_user_id} onChange={event => setValues({ ...values, actor_user_id: event.target.value })} /></div>
      <div className="field"><label htmlFor="audit-entity">Entity type · exact match</label><input id="audit-entity" placeholder="e.g. facility_booking" value={values.entity_type} onChange={event => setValues({ ...values, entity_type: event.target.value })} /></div>
      <div className="field"><label htmlFor="audit-action">Action · exact match</label><input id="audit-action" placeholder="e.g. facility_booking.completed" value={values.action} onChange={event => setValues({ ...values, action: event.target.value })} /></div>
    </fieldset><p className="muted">Leave both dates empty for the preceding 30 days, or provide both boundaries. The end is exclusive. Empty text fields include all matching records.</p>{error && <p className="notice notice-error" role="alert">{error}</p>}<div className="action-buttons"><Button type="submit">Apply filters</Button><Button type="button" variant="secondary" onClick={() => { setValues(emptyAuditFilters()); setFilters(''); setPage(1); setError('') }}>Reset filters</Button></div></form>
    <div className="section-toolbar"><p className="muted">{query.data ? `${query.data.pagination.total} matching ${query.data.pagination.total === 1 ? 'record' : 'records'}` : 'Loading records'} · newest first · read-only</p><Button variant="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh</Button></div>
    <p className="refresh-caption">History refreshes every 30 seconds while visible. All times use Asia/Manila.</p>
    {query.isPending ? <Loading label="Loading audit history…" /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : query.data?.records.length ? <ul className="record-list audit-list">{query.data.records.map(row => <li key={row.id}><div><p className="eyebrow">{campusDate(row.created_at, true)} · #{row.id}</p><h2>{row.action}</h2><p className="muted">{row.actor_user_id === null ? 'System' : `Account #${row.actor_user_id}`} · {row.entity_type} #{row.entity_id ?? '—'}</p><details><summary>View recorded changes</summary><h3>Before</h3><pre>{auditValues(row.old_values_json)}</pre><h3>After</h3><pre>{auditValues(row.new_values_json)}</pre></details></div></li>)}</ul> : <EmptyState title="No matching audit records">Adjust the filters or choose another period.</EmptyState>}
    <div className="pagination"><Button variant="secondary" disabled={page === 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page}</span><Button variant="secondary" disabled={!query.data || page * 20 >= query.data.pagination.total || query.isFetching} onClick={() => setPage(page + 1)}>Next</Button></div>
  </>
}
