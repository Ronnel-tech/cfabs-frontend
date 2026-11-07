import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/session';
import { problemActions, problemNames, type Problem, type ProblemAction } from '../lib/problems';
import { campusDate } from '../lib/types';
import ProblemEditor from '../components/ProblemEditor';
import { Button, ErrorState, Loading, PageHeading } from '../components/ui';

function PrivatePhoto({ id }: { id: number }) {
  const [url, setUrl] = useState(''); const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  const current = useRef(''); const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); if (current.current) URL.revokeObjectURL(current.current); }, []);
  async function view() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setPending(true); setError('');
    try { const blob = await api.download(`/asset-problem-reports/${id}/photo`, controller.signal, 'jpeg'); if (!controller.signal.aborted) { current.current = URL.createObjectURL(blob); setUrl(current.current); } }
    catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load photo.'); }
    finally { request.current = null; if (!controller.signal.aborted) setPending(false); }
  }
  return <div className="problem-photo">{url ? <><img src={url} alt="Photo attached by the asset problem reporter" /><Button variant="quiet" onClick={() => { URL.revokeObjectURL(current.current); current.current = ''; setUrl(''); }}>Hide photo</Button></> : <Button variant="secondary" disabled={pending} onClick={() => void view()}>{pending ? 'Loading photo…' : 'View private photo'}</Button>}{error && <p className="notice notice-error" role="alert">{error}</p>}</div>;
}

export default function AssetProblemDetails() {
  const { id = '' } = useParams(); const { user } = useAuth();
  const [action, setAction] = useState<ProblemAction | null>(null); const [message, setMessage] = useState('');
  const query = useQuery({ queryKey: ['problem-report', id], queryFn: ({ signal }) => api.request<Problem>(`/asset-problem-reports/${id}`, { signal }) });
  const row = query.data;
  return <><Link to="/asset-problems">← Asset problem reports</Link>{query.isPending ? <Loading label="Loading problem report…" /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : row && <>
    <PageHeading eyebrow={`Asset problem report #${row.id}`} title={row.asset_name}>{row.asset_tag || row.asset_code} · {row.quantity_affected} unit(s) affected</PageHeading>
    <section className="surface problem-details"><div className="section-toolbar"><h2>{row.status.replace('_', ' ')}</h2><Button variant="secondary" disabled={query.isFetching || !!action} onClick={() => void query.refetch()}>Refresh</Button></div><p className="preserve-lines">{row.description}</p><dl className="profile"><dt>Reported</dt><dd>{campusDate(row.created_at, true)} · account #{row.reporter_id}</dd><dt>Assigned custodian</dt><dd>{row.assigned_name || 'Not assigned'}</dd><dt>Last update</dt><dd>{campusDate(row.updated_at, true)}</dd>{row.staff_notes && <><dt>Latest notes</dt><dd className="preserve-lines">{row.staff_notes}</dd></>}{row.resolution && <><dt>Resolution</dt><dd className="preserve-lines">{row.resolution}</dd></>}</dl>
      {!!Number(row.has_photo) && <PrivatePhoto key={row.id} id={row.id} />}
      {user?.permissions.includes('asset.view') && <p><Link to={`/assets/${row.asset_id}`}>Check asset availability</Link></p>}
      {row.maintenance_id && user?.permissions.includes('asset.maintenance.manage') && <p><Link to="/maintenance/asset">Linked maintenance #{row.maintenance_id}</Link></p>}
      <div className="action-buttons">{user && problemActions(row, user).map(value => <Button key={value} variant="secondary" disabled={!!action} onClick={() => setAction(value)}>{problemNames[value]}</Button>)}</div>
    </section>{message && <p className="notice" role="status">{message}</p>}{action && <ProblemEditor report={row} action={action} onClose={feedback => { setAction(null); if (feedback) setMessage(feedback); }} />}
  </>}</>;
}
