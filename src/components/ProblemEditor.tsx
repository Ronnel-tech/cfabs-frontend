import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { problemChange, problemNames, type Problem, type ProblemAction } from '../lib/problems';
import AdminDialog from './AdminDialog';
import { ErrorState, Loading } from './ui';

type Custodian = { id: number; username: string; first_name: string | null; last_name: string | null };
export default function ProblemEditor({ report, action, onClose }: { report: Problem; action: ProblemAction; onClose: (feedback?: string) => void }) {
  const [fields, setFields] = useState({ notes: '', assigned_to: String(report.assigned_to || ''), end: '' });
  const people = useQuery({ queryKey: ['problem-assignees'], enabled: action === 'assign', queryFn: async ({ signal }) => {
    const all: Custodian[] = [];
    for (let page = 1; ; page++) { const batch = await api.request<Custodian[]>(`/asset-problem-assignees?page=${page}&per_page=100`, { signal }); all.push(...batch); if (batch.length < 100) return all; }
  } });
  return <AdminDialog title={problemNames[action]} ready={action !== 'assign' || (!!people.data?.length && !people.error)} onClose={onClose} refreshSession={false}
    refreshKeys={['problem-reports', 'problem-report', 'maintenance', 'availability', 'calendar-events', 'notifications']}
    successMessage="Report updated. Current status and notifications have been refreshed."
    reviewNote="Starting work must fit available stock and existing confirmed bookings. Refresh the report if another staff member has changed it."
    prepare={() => ({ path: `/asset-problem-reports/${report.id}/${action}`, method: 'POST', body: problemChange(report, action, fields) })}
    review={<><p>Report #{report.id} · {report.asset_name}{report.asset_tag ? ` · ${report.asset_tag}` : ''}</p><p>{problemNames[action]}</p>{action === 'assign' && <p>Custodian: {people.data?.find(person => Number(person.id) === Number(fields.assigned_to))?.username}</p>}{fields.notes && <p className="preserve-lines">{fields.notes}</p>}{action === 'start' && <p>Start now; {report.quantity_affected} unit(s) affected. Expected completion: {fields.end ? `${fields.end.replace('T', ' ')} · Asia/Manila` : 'Open-ended until explicitly completed or cancelled'}.</p>}</>}>
    <p>Report #{report.id} · {report.asset_name}</p>
    {action === 'assign' && (people.isPending ? <Loading label="Loading eligible custodians…" /> : people.error ? <ErrorState error={people.error} retry={() => void people.refetch()} /> : <div className="field"><label htmlFor="problem-assignee">Asset custodian</label><select id="problem-assignee" value={fields.assigned_to} required onChange={event => setFields({ ...fields, assigned_to: event.target.value })}><option value="">Choose a custodian</option>{people.data?.map(person => <option key={person.id} value={person.id}>{[person.first_name, person.last_name].filter(Boolean).join(' ') || person.username} · #{person.id}</option>)}</select>{!people.data?.length && <p className="notice">No eligible custodians. Create or activate an asset custodian with maintenance permission in Access administration.</p>}</div>)}
    {action === 'start' ? <><p className="notice">Work starts now and creates a maintenance block. Committed booking conflicts must be resolved first.</p><div className="field"><label htmlFor="problem-end">Expected completion (optional)</label><input id="problem-end" type="datetime-local" value={fields.end} onChange={event => setFields({ ...fields, end: event.target.value })} /><p className="muted">Asia/Manila. Leave empty for open-ended work.</p></div></> : <div className="field"><label htmlFor="problem-notes">{action === 'resolve' ? 'Resolution notes' : action === 'reject' ? 'Reason for rejection' : 'Notes for the reporter and custodian'}</label><textarea id="problem-notes" rows={4} required value={fields.notes} onChange={event => setFields({ ...fields, notes: event.target.value })} /></div>}
    {action === 'resolve' && <p className="notice">This completes linked maintenance. It does not automatically repair damaged inventory or reactivate assets.</p>}
  </AdminDialog>;
}
