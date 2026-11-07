import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/session'
import { resourceName, resourcePath } from '../lib/availability'
import type { ResourceKind } from '../lib/availability'
import { maintenanceActions, maintenanceEnd, maintenancePath, maintenancePhase } from '../lib/maintenance'
import type { MaintenanceRecord, MaintenanceResource } from '../lib/maintenance'
import { campusDate } from '../lib/types'
import MaintenanceEditor from '../components/MaintenanceEditor'
import { Button, EmptyState, ErrorState, Loading, PageHeading } from '../components/ui'

export default function Maintenance({ kind }: { kind: ResourceKind }) {
  const { user } = useAuth()
  const permitted = !!user?.permissions.includes(`${kind}.maintenance.manage`)
  const canBrowse = !!user?.permissions.includes(`${kind}.view`)
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState('')
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [editor, setEditor] = useState<{ record?: MaintenanceRecord; action?: 'complete' | 'cancel' } | null>(null)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer) }, [])
  const resources = useQuery({ queryKey: ['maintenance-resources', kind, user?.permissions.includes(`${kind}.update`)], enabled: permitted && canBrowse, queryFn: async ({ signal }) => {
    const all: MaintenanceResource[] = []
    for (let next = 1; ; next++) {
      const batch = await api.request<MaintenanceResource[]>(`/${resourcePath(kind)}?per_page=100&page=${next}${user?.permissions.includes(`${kind}.update`) ? '&include_inactive=1' : ''}`, { signal })
      all.push(...batch)
      if (batch.length < 100) return all
    }
  } })
  const query = useQuery({ queryKey: ['maintenance', kind, page, filter], enabled: permitted, queryFn: ({ signal }) => api.request<MaintenanceRecord[]>(`${maintenancePath(kind)}?page=${page}&per_page=20${filter ? `&resource_id=${filter}` : ''}`, { signal }) })
  if (!permitted) return <Navigate to={user?.permissions.includes(`${kind === 'facility' ? 'asset' : 'facility'}.maintenance.manage`) ? `/maintenance/${kind === 'facility' ? 'asset' : 'facility'}` : '/'} replace />
  return <><PageHeading eyebrow="Campus operations" title="Maintenance management">Schedule work, track affected stock, and explicitly close maintenance when it is finished.</PageHeading>
    <nav className="catalog-navigation" aria-label="Maintenance sections">{(['facility', 'asset'] as const).filter(value => user?.permissions.includes(`${value}.maintenance.manage`)).map(value => <Link key={value} to={`/maintenance/${value}`} aria-current={value === kind ? 'page' : undefined}>{value === 'facility' ? 'Facilities' : 'Assets'}</Link>)}</nav>
    <p className="notice">Unfinished work keeps blocking availability after its expected end. Completion closes the maintenance block; it does not repair damaged stock or reactivate resources automatically.</p>
    <div className="section-toolbar catalog-toolbar"><h2>{kind === 'facility' ? 'Facility maintenance' : 'Asset maintenance'}</h2><div className="action-buttons"><Button variant="secondary" disabled={query.isFetching || !!editor} onClick={() => { void query.refetch(); if (canBrowse) void resources.refetch() }}>Refresh</Button><Button disabled={!!editor || !canBrowse || !resources.data?.length || !!resources.error || resources.isFetching} onClick={() => setEditor({})}>Schedule maintenance</Button></div></div>
    {!canBrowse && <p className="muted">Resource browsing requires {kind}.view. You can inspect and close listed maintenance; scheduling through this screen needs resource browsing access.</p>}
    {canBrowse && resources.error && <ErrorState error={resources.error} retry={() => void resources.refetch()} />}
    <form className="maintenance-filter" onSubmit={event => { event.preventDefault(); setFilter(draft); setPage(1) }}><div className="field"><label htmlFor="maintenance-filter">Filter by {kind}</label>{canBrowse && resources.data ? <select id="maintenance-filter" value={draft} onChange={event => setDraft(event.target.value)}><option value="">All resources</option>{resources.data.map(row => <option key={row.id} value={row.id}>{resourceName(row)} · #{row.id}</option>)}</select> : <input id="maintenance-filter" type="text" inputMode="numeric" pattern="[1-9][0-9]*" placeholder="Resource ID (optional)" value={draft} onChange={event => setDraft(event.target.value)} />}</div><Button type="submit" variant="secondary" disabled={!!editor || query.isFetching}>Apply filter</Button></form>
    <p className="refresh-caption">All statuses · newest first · refreshes every 30 seconds while visible. Dates use Asia/Manila.</p>
    {message && <p className="notice" role="status">{message}</p>}
    {query.isPending ? <Loading label="Loading maintenance…" /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : query.data?.length ? <ul className="record-list maintenance-records">{query.data.map(row => {
      const id = row[kind === 'facility' ? 'facility_id' : 'asset_id'], resource = resources.data?.find(value => Number(value.id) === Number(id)), end = maintenanceEnd(kind, row), completion = kind === 'facility' ? row.completed_at : row.actual_completion
      return <li key={row.id}><div><p className="eyebrow">Maintenance #{row.id} · {row.status}</p><h2>{resource ? resourceName(resource) : `${kind === 'facility' ? 'Facility' : 'Asset'} #${id}`}</h2><p className="muted">{maintenancePhase(kind, row, now)}</p><p>{row.reason}</p><p className="muted">Start: {campusDate(row.start_datetime, true)}<br />Expected completion: {end ? campusDate(end, true) : 'Open-ended'}</p>{kind === 'asset' && <p className="muted">Affected: {row.quantity_affected} {row.asset_instance_id ? `item · ${row.asset_tag || `Tag record #${row.asset_instance_id}`}` : 'units'}</p>}{completion && <p className="muted">Completed: {campusDate(completion, true)} · Staff #{row.completed_by}</p>}{canBrowse && <Link to={`/${resourcePath(kind)}/${id}`}>Check resource availability</Link>}</div><div className="action-buttons">{maintenanceActions(row, permitted, now).map(action => <Button key={action} disabled={!!editor} variant="secondary" onClick={() => setEditor({ record: row, action })}>{action === 'complete' ? 'Complete work' : 'Cancel work'}<span className="sr-only"> #{row.id}</span></Button>)}</div></li>
    })}</ul> : <EmptyState title="No maintenance on this page">Adjust the resource filter, return to the previous page, or schedule work.</EmptyState>}
    <div className="pagination"><Button variant="secondary" disabled={page === 1 || query.isFetching || !!editor} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page}</span><Button variant="secondary" disabled={(query.data?.length ?? 0) < 20 || query.isFetching || !!editor} onClick={() => setPage(page + 1)}>Next</Button></div>
    {editor && <MaintenanceEditor kind={kind} resources={resources.data ?? []} {...editor} onClose={feedback => { setEditor(null); if (feedback) setMessage(feedback) }} />}
  </>
}
