import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/session';
import { api } from '../lib/api';
import { problemAdmin, type Problem } from '../lib/problems';
import { campusDate } from '../lib/types';
import { Button, EmptyState, ErrorState, Loading, PageHeading } from '../components/ui';

export default function AssetProblems() {
  const { user } = useAuth();
  const admin = problemAdmin(user?.role_name, user?.permissions ?? []);
  const staff = user?.permissions.includes('asset.maintenance.manage');
  const [scope, setScope] = useState(admin ? 'all' : 'mine');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['problem-reports', scope, status, page], queryFn: ({ signal }) => api.request<Problem[]>(`/asset-problem-reports?scope=${scope}&page=${page}&per_page=20${status ? `&status=${status}` : ''}`, { signal }) });
  return <><PageHeading eyebrow="Asset care" title="Asset problem reports">Report equipment problems and track administrator review, custodian assignment, and maintenance progress.</PageHeading>
    <div className="section-toolbar"><div className="action-buttons"><div className="field inline-field"><label htmlFor="problem-scope">Show reports</label><select id="problem-scope" value={scope} onChange={event => { setScope(event.target.value); setPage(1); }}><option value="mine">My reports</option>{staff && <option value="assigned">Assigned to me</option>}{admin && <option value="all">All reports</option>}</select></div><div className="field inline-field"><label htmlFor="problem-status">Status</label><select id="problem-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{['submitted', 'assigned', 'in_progress', 'resolved', 'rejected'].map(value => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</select></div></div><div className="action-buttons"><Button variant="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh</Button>{user?.permissions.includes('asset.view') && <Link className="button button-primary" to="/asset-problems/new">Report an asset problem</Link>}</div></div>
    <p className="refresh-caption">Only system administrators review and assign reports. Assigned custodians can update their work. Submitting a report does not reserve or block inventory.</p>
    {query.isPending ? <Loading label="Loading problem reports…" /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : query.data?.length ? <ul className="record-list">{query.data.map(row => <li key={row.id}><div><p className="eyebrow">Report #{row.id} · {row.status.replace('_', ' ')}</p><h2><Link to={`/asset-problems/${row.id}`}>{row.asset_name}{row.asset_tag ? ` · ${row.asset_tag}` : ''}</Link></h2><p>{row.description.slice(0, 160)}{row.description.length > 160 ? '…' : ''}</p><p className="muted">{row.quantity_affected} unit(s) · {row.assigned_name ? `Assigned to ${row.assigned_name}` : 'Awaiting assignment'} · {campusDate(row.created_at, true)}</p></div></li>)}</ul> : <EmptyState title="No problem reports">Adjust the filters or report an asset problem.</EmptyState>}
    <div className="pagination"><Button variant="secondary" disabled={page === 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page}</span><Button variant="secondary" disabled={(query.data?.length ?? 0) < 20 || query.isFetching} onClick={() => setPage(page + 1)}>Next</Button></div>
  </>;
}
