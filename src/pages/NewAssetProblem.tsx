import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/session';
import { api } from '../lib/api';
import { problemSubmission } from '../lib/problems';
import AdminDialog from '../components/AdminDialog';
import { Button, ErrorState, Loading, PageHeading } from '../components/ui';

type Asset = { id: number; asset_name: string; asset_code: string; tracking_mode: string; total_quantity: number; status: string };
type Item = { id: number; asset_tag: string };
export default function NewAssetProblem() {
  const { user } = useAuth(); const navigate = useNavigate(); const [params] = useSearchParams();
  const allowed = !!user?.permissions.includes('asset.view');
  const key = useRef(crypto.randomUUID());
  const photoInput = useRef<HTMLInputElement>(null);
  const [assetId, setAssetId] = useState(params.get('asset_id') || '');
  const [fields, setFields] = useState({ item: params.get('asset_instance_id') || '', quantity: '1', description: '', photo: '', qr: params.get('qr_identifier') || '' });
  const [photoError, setPhotoError] = useState(''); const [reading, setReading] = useState(false);
  const [submitted, setSubmitted] = useState('');
  const assets = useQuery({ queryKey: ['problem-assets'], enabled: allowed, queryFn: async ({ signal }) => {
    const all: Asset[] = [];
    for (let page = 1; ; page++) { const batch = await api.request<Asset[]>(`/assets?page=${page}&per_page=100`, { signal }); all.push(...batch); if (batch.length < 100) return all; }
  } });
  const resource = assets.data?.find(row => Number(row.id) === Number(assetId));
  const individual = resource?.tracking_mode === 'individual';
  const items = useQuery({ queryKey: ['problem-items', assetId], enabled: allowed && individual, queryFn: async ({ signal }) => {
    const all: Item[] = [];
    for (let page = 1; ; page++) { const batch = await api.request<Item[]>(`/assets/${assetId}/instances?page=${page}&per_page=100`, { signal }); all.push(...batch); if (batch.length < 100) return all; }
  } });
  async function photo(file?: File) {
    setPhotoError(''); setFields(old => ({ ...old, photo: '' }));
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 2097152) { setPhotoError('Choose a JPEG or PNG photo up to 2 MB.'); return; }
    setReading(true);
    try { const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this photo.')); reader.readAsDataURL(file); }); setFields(old => ({ ...old, photo: data })); }
    catch (error) { setPhotoError((error as Error).message); }
    finally { setReading(false); }
  }
  if (!allowed) return <Navigate to="/asset-problems" replace />;
  return <><PageHeading eyebrow="Asset care" title="Report an asset problem">Describe the issue for administrator review. Reporting does not change stock or booking availability.</PageHeading>
    {submitted ? <p className="notice" role="status">{submitted} <Link to="/asset-problems">View my reports</Link></p> : <AdminDialog title="Report an asset problem" onClose={feedback => feedback ? setSubmitted(feedback) : navigate('/asset-problems')} refreshSession={false} refreshKeys={['problem-reports', 'notifications']}
      ready={!!resource && !reading && !photoError && (!individual || (!!items.data && !items.error))} successMessage="Your problem report was submitted for system administrator review."
      reviewNote="The report will be sent to system administrators for review. It does not block asset availability."
      prepare={() => ({ path: '/asset-problem-reports', method: 'POST', body: problemSubmission(resource, fields, key.current) })}
      review={<><h3>{resource?.asset_name}</h3>{individual && <p>Tag: {items.data?.find(row => Number(row.id) === Number(fields.item))?.asset_tag}</p>}<p>{individual ? 1 : fields.quantity} unit(s) affected</p><p className="preserve-lines">{fields.description}</p><p>{fields.photo ? 'One private photo attached.' : 'No photo attached.'}</p></>}>
      {assets.isPending ? <Loading label="Loading assets…" /> : assets.error ? <ErrorState error={assets.error} retry={() => void assets.refetch()} /> : <div className="field"><label htmlFor="problem-asset">Asset</label><select id="problem-asset" value={assetId} required onChange={event => { setAssetId(event.target.value); setFields({ ...fields, item: '', qr: '' }); }}><option value="">Choose an asset</option>{assets.data?.map(row => <option key={row.id} value={row.id}>{row.asset_name} · {row.asset_code}</option>)}</select>{!assets.data?.length && <p className="notice">No active assets are registered. Contact campus administration.</p>}</div>}
      {fields.qr && <p className="notice">Asset identified from a QR label. The label is checked again when you submit.</p>}
      {individual ? items.isPending ? <Loading label="Loading tagged items…" /> : items.error ? <ErrorState error={items.error} retry={() => void items.refetch()} /> : <div className="field"><label htmlFor="problem-item">Specific tagged item</label><select id="problem-item" required value={fields.item} onChange={event => setFields({ ...fields, item: event.target.value, qr: '' })}><option value="">Choose one item</option>{items.data?.map(row => <option key={row.id} value={row.id}>{row.asset_tag}</option>)}</select></div> : <div className="field"><label htmlFor="problem-quantity">Affected quantity</label><input id="problem-quantity" type="number" min={1} max={resource?.total_quantity} step={1} required value={fields.quantity} onChange={event => setFields({ ...fields, quantity: event.target.value })} /></div>}
      <div className="field"><label htmlFor="problem-description">Describe the problem</label><textarea id="problem-description" rows={5} required value={fields.description} onChange={event => setFields({ ...fields, description: event.target.value })} /></div>
      <div className="field"><label htmlFor="problem-photo">Photo (optional)</label><input ref={photoInput} id="problem-photo" type="file" accept="image/jpeg,image/png" disabled={reading} onChange={event => void photo(event.target.files?.[0])} /><p className="muted">JPEG or PNG, up to 2 MB. Photos are visible only to you, authorized system administrators and the assigned custodian.</p>{reading && <p role="status">Reading photo…</p>}{photoError && <p className="notice notice-error" role="alert">{photoError}</p>}{(fields.photo || photoError) && <Button type="button" variant="quiet" disabled={reading} onClick={() => { setFields({ ...fields, photo: '' }); setPhotoError(''); if (photoInput.current) photoInput.current.value = ''; }}>Remove photo</Button>}</div>
    </AdminDialog>}
  </>;
}
