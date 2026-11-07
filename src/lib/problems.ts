import { campusInstant } from './availability.ts';
import { qrIdentifier } from './qr.ts';
export type Problem = {
  id: number; asset_id: number; asset_instance_id: number | null; reporter_id: number;
  asset_name: string; asset_code: string; asset_tag: string | null; assigned_name: string | null;
  assigned_to: number | null; maintenance_id: number | null; description: string;
  quantity_affected: number; status: 'submitted' | 'assigned' | 'in_progress' | 'resolved' | 'rejected';
  staff_notes: string | null; resolution: string | null; version: number; has_photo: number;
  created_at: string; updated_at: string; resolved_at: string | null;
};
export type ProblemAction = 'assign' | 'reject' | 'start' | 'progress' | 'resolve';
export const problemAdmin = (role: string | null | undefined, permissions: string[]) => role === 'system_admin' && permissions.includes('asset.maintenance.manage');
export function problemActions(row: Problem, user: { id: number; role_name: string | null; permissions: string[] }): ProblemAction[] {
  if (['resolved', 'rejected'].includes(row.status)) return [];
  const admin = problemAdmin(user.role_name, user.permissions);
  const work = admin || (user.permissions.includes('asset.maintenance.manage') && Number(row.assigned_to) === Number(user.id));
  return [
    ...(admin ? ['assign' as const] : []),
    ...(admin && !row.maintenance_id ? ['reject' as const] : []),
    ...(work && row.status === 'assigned' ? ['start' as const] : []),
    ...(work && row.status === 'in_progress' ? ['progress' as const, 'resolve' as const] : []),
  ];
}
export const problemNames: Record<ProblemAction, string> = { assign: 'Assign custodian', reject: 'Reject report', start: 'Start work', progress: 'Record progress', resolve: 'Resolve report' };
export function problemChange(row: Problem, action: ProblemAction, fields: { notes: string; assigned_to: string; end: string }) {
  const body: Record<string, unknown> = { expected_version: Number(row.version) };
  if (action === 'start') {
    if (fields.end) { const end = campusInstant(fields.end); if (!end || Date.parse(end) <= Date.now()) throw new Error('Choose an expected completion in the future.'); body.expected_completion = end; }
  } else {
    if (!fields.notes.trim() || new TextEncoder().encode(fields.notes.trim()).length > 4000) throw new Error('Enter notes up to 4,000 bytes.');
    body.notes = fields.notes.trim();
    if (action === 'assign') { if (!/^[1-9]\d*$/.test(fields.assigned_to) || !Number.isSafeInteger(Number(fields.assigned_to))) throw new Error('Choose an active asset custodian.'); body.assigned_to = Number(fields.assigned_to); }
  }
  return body;
}
export function problemSubmission(resource: { id: number; tracking_mode: string; total_quantity: number; status: string } | undefined, fields: { item: string; quantity: string; description: string; photo: string; qr: string }, key: string) {
  if (!resource || resource.status !== 'active') throw new Error('Choose an active asset.');
  const individual = resource.tracking_mode === 'individual';
  if (individual && (!/^[1-9]\d*$/.test(fields.item) || !Number.isSafeInteger(Number(fields.item)))) throw new Error('Choose a specific tagged item.');
  const quantity = individual ? 1 : Number(fields.quantity);
  if (!individual && (!/^[1-9]\d*$/.test(fields.quantity) || !Number.isSafeInteger(quantity) || quantity > Number(resource.total_quantity))) throw new Error('Enter an affected quantity within the registered pool.');
  const description = fields.description.trim();
  if (!description || new TextEncoder().encode(description).length > 4000) throw new Error('Describe the problem using up to 4,000 bytes.');
  return { asset_id: Number(resource.id), ...(individual ? { asset_instance_id: Number(fields.item) } : {}), quantity_affected: quantity,
    description, idempotency_key: key, ...(fields.photo ? { photo: fields.photo } : {}), ...(fields.qr ? { qr_identifier: qrIdentifier(fields.qr) } : {}) };
}
