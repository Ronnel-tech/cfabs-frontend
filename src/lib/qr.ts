export type QrLabel = {
  identifier: string;
  payload: string;
  revoked: boolean;
  resource: {
    kind: 'asset' | 'asset-instance';
    id: number;
    asset_id: number;
    name: string;
    code: string;
    status: string;
    active: boolean;
    condition_status: string | null;
  };
};
export function problemQrPath(label: QrLabel): string {
  const params = new URLSearchParams({ asset_id: String(label.resource.asset_id), qr_identifier: label.identifier });
  if (label.resource.kind === 'asset-instance') params.set('asset_instance_id', String(label.resource.id));
  return `/asset-problems/new?${params}`;
}

export function qrIdentifier(value: string): string {
  const match = /^(?:cfabs:qr:)?([a-f0-9]{48})$/.exec(value.trim());
  if (!match) throw new Error('Scan a CFABS asset label or paste its identifier.');
  return match[1]!;
}

export function addQrSelection(labels: QrLabel[], label: QrLabel, asset: number, individual: boolean, eligible: number[]): QrLabel[] {
  if (label.revoked || !label.resource.active) throw new Error('This label or asset is unavailable.');
  if (Number(label.resource.asset_id) !== Number(asset)) throw new Error('This label belongs to a different asset.');
  if (individual !== (label.resource.kind === 'asset-instance')) throw new Error(individual ? 'Scan the label of a specific tagged item.' : 'Scan this asset group’s label.');
  if (individual && !eligible.includes(Number(label.resource.id))) throw new Error('This item is not eligible for the current batch.');
  if (labels.some(row => row.identifier === label.identifier || (row.resource.kind === label.resource.kind && Number(row.resource.id) === Number(label.resource.id)))) throw new Error('This item has already been scanned.');
  return individual ? [...labels, label] : [label];
}

export function handoverQr(labels: QrLabel[], individual: boolean, selected: number[]): { qr_identifiers?: string[] } {
  if (!labels.length) return {};
  if (individual) {
    const scanned = labels.map(row => Number(row.resource.id)).sort((a, b) => a - b);
    const chosen = [...selected].sort((a, b) => a - b);
    if (scanned.length !== chosen.length || scanned.some((id, index) => id !== chosen[index])) throw new Error('Scan every selected item, or clear the scans to record a manual batch.');
  }
  return { qr_identifiers: labels.map(row => row.identifier).sort() };
}
