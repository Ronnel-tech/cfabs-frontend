import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/session'
import { resourceName } from '../lib/availability'
import type { ResourceKind } from '../lib/availability'
import { maintenancePath, maintenancePayload } from '../lib/maintenance'
import type { MaintenanceItem, MaintenanceRecord, MaintenanceResource } from '../lib/maintenance'
import { campusDate } from '../lib/types'
import AdminDialog from './AdminDialog'
import { ErrorState, Loading } from './ui'

export default function MaintenanceEditor({ kind, resources, record, action, onClose }: { kind: ResourceKind; resources: MaintenanceResource[]; record?: MaintenanceRecord; action?: 'complete' | 'cancel'; onClose: (message?: string) => void }) {
  const { user } = useAuth()
  const [values, setValues] = useState({ resource_id: '', start: '', end: '', reason: '', quantity: '1', item_id: '' })
  const resource = resources.find(row => Number(row.id) === Number(values.resource_id))
  const individual = kind === 'asset' && resource?.tracking_mode === 'individual'
  const items = useQuery({ queryKey: ['maintenance-items', values.resource_id], enabled: !record && individual, queryFn: async ({ signal }) => {
    const all: MaintenanceItem[] = []
    for (let page = 1; ; page++) {
      const batch = await api.request<MaintenanceItem[]>(`/assets/${values.resource_id}/instances?per_page=100&page=${page}${user?.permissions.includes('asset.update') ? '&include_inactive=1' : ''}`, { signal })
      all.push(...batch)
      if (batch.length < 100) return all
    }
  } })
  const ready = !!record || (!!resource && (!individual || (!!items.data && !items.error && !items.isFetching)))
  const closeTitle = action === 'complete' ? 'Complete maintenance' : 'Cancel maintenance'
  const resourceId = record?.[kind === 'facility' ? 'facility_id' : 'asset_id']
  const existingResource = resources.find(row => Number(row.id) === Number(resourceId))
  return <AdminDialog title={record ? closeTitle : 'Schedule maintenance'} onClose={onClose} ready={ready} refreshSession={false} refreshKeys={['maintenance', 'availability', 'facility-schedule', 'calendar-events', 'dashboard', 'notifications', 'reports']} successMessage={record ? (action === 'complete' ? 'Maintenance completed. Availability has been refreshed.' : 'Maintenance cancelled. Availability has been refreshed.') : 'Maintenance scheduled. Availability has been refreshed.'} reviewNote="The server rechecks your permission, maintenance timing, stock, and committed booking conflicts before saving." prepare={() => {
    if (record) return { path: `${maintenancePath(kind)}/${record.id}/${action}`, method: 'PATCH', body: {} }
    return { path: maintenancePath(kind), method: 'POST', body: maintenancePayload(kind, resource, values, items.data) }
  }} review={record ? <><h3>Maintenance #{record.id}</h3><p>{existingResource ? resourceName(existingResource) : `${kind === 'facility' ? 'Facility' : 'Asset'} #${resourceId}`}</p><p>{record.reason}</p>{record.asset_instance_id && <p>Asset tag: {record.asset_tag || `Record #${record.asset_instance_id}`} · {record.quantity_affected} item</p>}<p>{action === 'complete' ? 'Confirm that the work is finished. This closes the maintenance block; damaged or inactive inventory still needs its existing condition/status workflow.' : 'Cancel this maintenance block? This does not cancel any booking or restore previously rejected requests.'}</p></> : <>
    <h3>{resource ? resourceName(resource) : 'Campus resource'}</h3><p>Start: {values.start.replace('T', ' ')} · Asia/Manila</p><p>Expected completion: {values.end ? `${values.end.replace('T', ' ')} · Asia/Manila` : 'Open-ended — blocks until explicitly closed'}</p>
    {kind === 'asset' && <p>{individual ? `Tag: ${items.data?.find(row => Number(row.id) === Number(values.item_id))?.asset_tag} · 1 item` : `${values.quantity} units affected`}</p>}<p>{values.reason}</p><p>Committed bookings must be resolved first. Pending requests stay pending and affected requesters are notified.</p>
  </>}>
    {record ? <><p>Maintenance #{record.id} · {record.status}</p><p>{record.reason}</p><p>Started: {campusDate(record.start_datetime, true)}</p><p>{action === 'complete' ? 'Only confirm completion when the work is finished. Future maintenance can be cancelled instead.' : 'Review cancellation before removing this maintenance block.'}</p></> : <>
      <p className="muted">All dates use Asia/Manila. Maintenance is not restricted to requester booking hours or the 30-day booking window.</p>
      <div className="field"><label htmlFor="maintenance-resource">{kind === 'facility' ? 'Facility' : 'Asset'}</label><select id="maintenance-resource" required value={values.resource_id} onChange={event => setValues({ ...values, resource_id: event.target.value, item_id: '', quantity: '1' })}><option value="">Select a resource</option>{resources.map(row => <option key={row.id} value={row.id}>{resourceName(row)} · #{row.id} · {row.status}</option>)}</select></div>
      <div className="field"><label htmlFor="maintenance-start">Start date and time</label><input id="maintenance-start" type="datetime-local" required value={values.start} onChange={event => setValues({ ...values, start: event.target.value })} /><p className="muted">You may record work that has already started.</p></div>
      <div className="field"><label htmlFor="maintenance-end">Expected completion{kind === 'asset' ? ' (optional)' : ''}</label><input id="maintenance-end" type="datetime-local" required={kind === 'facility'} value={values.end} onChange={event => setValues({ ...values, end: event.target.value })} /><p className="muted">{kind === 'asset' ? 'Leave empty for open-ended work. A provided end must be in the future.' : 'Choose an end after the start and in the future.'} Overdue work remains unavailable until explicitly closed.</p></div>
      {kind === 'asset' && resource && (individual ? <>
        {items.isPending ? <Loading label="Loading asset tags…" /> : items.error ? <ErrorState error={items.error} retry={() => void items.refetch()} /> : <div className="field"><label htmlFor="maintenance-item">Specific asset tag</label><select id="maintenance-item" required value={values.item_id} onChange={event => setValues({ ...values, item_id: event.target.value })}><option value="">Select one item</option>{items.data?.map(item => <option key={item.id} value={item.id}>{item.asset_tag} · {item.condition_status} · {item.status}</option>)}</select>{!items.data?.length && <p className="notice">No visible tagged items. Update permission is needed to include inactive items.</p>}</div>}
      </> : <div className="field"><label htmlFor="maintenance-quantity">Affected quantity</label><input id="maintenance-quantity" type="number" min={1} max={Number(resource.usable_quantity ?? 0)} step={1} required value={values.quantity} onChange={event => setValues({ ...values, quantity: event.target.value })} /><p className="muted">Usable baseline: {resource.usable_quantity ?? 0}. Dated maintenance reduces availability separately; the server also checks reservations and other maintenance.</p></div>)}
      <div className="field"><label htmlFor="maintenance-reason">Reason for maintenance</label><textarea id="maintenance-reason" rows={4} required value={values.reason} onChange={event => setValues({ ...values, reason: event.target.value })} /></div>
    </>}
  </AdminDialog>
}
