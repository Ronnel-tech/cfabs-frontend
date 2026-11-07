import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/session';
import type { QrLabel } from '../lib/qr';
import { problemQrPath } from '../lib/qr';
import QrScanner from '../components/QrScanner';
import { PageHeading } from '../components/ui';

export default function AssetQr() {
  const { user } = useAuth();
  const [label, setLabel] = useState<QrLabel | null>(null);
  if (!user?.permissions.includes('asset.view')) return <Navigate to="/" replace />;
  return <>
    <PageHeading eyebrow="Asset identification" title="Scan an asset">Identify a pooled asset group or a specific tagged item. Scanning does not release or return equipment.</PageHeading>
    <section className="surface qr-workspace" aria-label="Asset scanner"><QrScanner onRead={async identifier => { setLabel(null); setLabel(await api.request<QrLabel>(`/qr/${identifier}`)); }} /></section>
    {label && <section className="surface qr-result" aria-label="Identified asset" role="status"><p className="eyebrow">{label.resource.kind === 'asset' ? 'Pooled asset group' : 'Individually tracked item'}</p><h2>{label.resource.name}</h2><p>{label.resource.code} · {label.resource.condition_status} · {label.resource.status}</p><div className="action-buttons"><Link className="button button-secondary" to={`/assets/${label.resource.asset_id}`}>View asset availability</Link><Link className="button button-secondary" to={problemQrPath(label)}>Report a problem</Link>{user.permissions.includes('asset.update') && <Link className="button button-secondary" to={`/asset-qr/${label.resource.kind}/${label.resource.id}`}>View QR label</Link>}{user.permissions.includes('asset_booking.view_all') && <Link to="/review">Open booking review</Link>}</div><p className="muted">To record a release or return, open the approved booking and scan labels in its custody form.</p></section>}
  </>;
}
