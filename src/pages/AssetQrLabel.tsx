import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../lib/api';
import { useAuth } from '../lib/session';
import type { QrLabel } from '../lib/qr';
import { Button, ErrorState, Loading, PageHeading } from '../components/ui';

export default function AssetQrLabel() {
  const { kind = '', id = '' } = useParams();
  const { user } = useAuth();
  const valid = ['asset', 'asset-instance'].includes(kind) && /^[1-9]\d*$/.test(id);
  const permitted = user?.permissions.includes('asset.view');
  const manage = user?.permissions.includes('asset.update');
  const [action, setAction] = useState<'revoke' | 'regenerate' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const picture = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const query = useQuery({ queryKey: ['qr-label', kind, id], enabled: valid && permitted, queryFn: ({ signal }) => api.request<QrLabel>(`/qr-labels/${kind}/${id}`, { signal }) });
  useEffect(() => { if (action) dialog.current?.showModal(); }, [action]);
  if (!valid || !permitted) return <Navigate to="/assets" replace />;
  const label = query.data;
  async function change() {
    if (!label || !action || busy.current) return;
    busy.current = true; setPending(true); setError(''); setMessage('');
    try {
      await api.request<QrLabel>(`/qr-labels/${kind}/${id}`, { method: 'POST', body: JSON.stringify({ action, expected_identifier: label.identifier }) });
      setMessage(action === 'revoke' ? 'Label revoked. Printed copies can no longer be used for new handovers.' : 'New label generated. Replace all printed copies of the old label.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update this label. Refresh its current status before trying again.'); }
    finally { await query.refetch(); busy.current = false; setPending(false); setAction(null); dialog.current?.close(); }
  }
  function download() {
    const svg = picture.current?.querySelector('svg');
    if (!svg || !label) return;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    const link = document.createElement('a'); link.href = url; link.download = `cfabs-${kind}-${id}.svg`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="qr-label-page">
    <div className="no-print"><PageHeading eyebrow="Asset identification" title="Asset QR label">Download or print this label for the asset. A QR code identifies equipment; it grants no booking or custody permissions.</PageHeading><Link to="/asset-qr">← Asset scanner</Link></div>
    {query.isPending ? <Loading label="Loading asset label…" /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : label && <>
      <section className="surface qr-label" aria-label="Printable asset label"><p className="eyebrow">CFABS · {label.resource.kind === 'asset' ? 'Asset group' : 'Tagged item'}</p><h2>{label.resource.name}</h2><p className="qr-asset-code">{label.resource.code}</p>{label.revoked ? <p className="notice notice-error" role="status">This label is revoked.</p> : <div ref={picture}><QRCodeSVG value={label.payload} size={240} level="M" marginSize={4} title={`CFABS asset label: ${label.resource.code}`} /></div>}<p className="muted">{label.resource.kind === 'asset' ? 'One label for this pool. Confirm the quantity at each handover.' : 'Identify this exact tagged item at each handover.'}</p>{!label.resource.active && <p className="notice">This asset is inactive. Its QR code cannot currently be resolved.</p>}</section>
      <div className="action-buttons no-print"><Button disabled={label.revoked || pending || query.isFetching} onClick={download}>Download SVG</Button><Button variant="secondary" disabled={label.revoked || pending || query.isFetching} onClick={() => window.print()}>Print label</Button><Button variant="secondary" disabled={pending || query.isFetching} onClick={() => void query.refetch()}>Refresh</Button>{manage && <><Button variant="secondary" disabled={pending || query.isFetching} onClick={() => setAction('regenerate')}>Regenerate label</Button><Button variant="quiet" disabled={label.revoked || pending || query.isFetching} onClick={() => setAction('revoke')}>Revoke label</Button></>}</div>
    </>}
    {message && <p className="notice no-print" role="status">{message}</p>}{error && <p className="notice notice-error no-print" role="alert">{error}</p>}
    <dialog ref={dialog} className="decision-dialog no-print" aria-labelledby="qr-confirm-title" onCancel={event => { if (busy.current) event.preventDefault(); else setAction(null); }}><h2 id="qr-confirm-title">{action === 'revoke' ? 'Revoke this label?' : 'Replace this label?'}</h2><p>Existing printed copies will stop working for new scans. Booking records and recorded handovers will be preserved.</p><div className="action-buttons"><Button variant="secondary" autoFocus disabled={pending} onClick={() => { setAction(null); dialog.current?.close(); }}>Keep current label</Button><Button disabled={pending} onClick={() => void change()}>{pending ? 'Updating…' : action === 'revoke' ? 'Revoke label' : 'Generate replacement'}</Button></div></dialog>
  </div>;
}
