import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addQrSelection, handoverQr, qrIdentifier, type QrLabel } from '../src/lib/qr.ts';
const label = (id = 3, kind: 'asset' | 'asset-instance' = 'asset-instance'): QrLabel => ({ identifier: String(id).padStart(48, '0'), payload: '', revoked: false, resource: { kind, id, asset_id: 9, name: 'Projector', code: `TAG-${id}`, status: 'active', active: true, condition_status: 'good' } });
test('QR parser accepts only CFABS payload or exact lowercase identifier', () => {
  const token = 'a'.repeat(48);
  assert.equal(qrIdentifier(` cfabs:qr:${token} `), token);
  assert.equal(qrIdentifier(token), token);
  for (const value of ['https://evil.invalid/' + token, 'cfabs:qr:' + token + '?x=1', 'A'.repeat(48), 'a'.repeat(47), '']) assert.throws(() => qrIdentifier(value));
});
test('scans respect asset identity and current eligible booking items', () => {
  assert.deepEqual(addQrSelection([], label(), 9, true, [3]), [label()]);
  assert.throws(() => addQrSelection([], label(), 8, true, [3]), /different asset/);
  assert.throws(() => addQrSelection([], label(), 9, true, [4]), /not eligible/);
  assert.throws(() => addQrSelection([], label(), 9, false, []), /asset group/);
  assert.throws(() => addQrSelection([], { ...label(), revoked: true }, 9, true, [3]));
  assert.throws(() => addQrSelection([], { ...label(), resource: { ...label().resource, active: false } }, 9, true, [3]));
});
test('duplicates cannot count twice, including regenerated labels of the same item', () => {
  assert.throws(() => addQrSelection([label()], label(), 9, true, [3]), /already/);
  assert.throws(() => addQrSelection([label()], { ...label(), identifier: 'f'.repeat(48) }, 9, true, [3]), /already/);
  assert.equal(addQrSelection([label()], label(4), 9, true, [3, 4]).length, 2);
});
test('one pooled asset label identifies a quantity group without inventing unit IDs', () => {
  const pool = label(9, 'asset');
  assert.deepEqual(addQrSelection([], pool, 9, false, []), [pool]);
  assert.deepEqual(handoverQr([pool], false, []), { qr_identifiers: [pool.identifier] });
});
test('review requires all selected individual items to match scans exactly', () => {
  assert.deepEqual(handoverQr([], true, [3]), {});
  assert.deepEqual(handoverQr([label(4), label(3)], true, [3, 4]), { qr_identifiers: [label(3).identifier, label(4).identifier] });
  assert.throws(() => handoverQr([label()], true, [3, 4]), /every selected/);
  assert.throws(() => handoverQr([label()], true, [4]), /every selected/);
  assert.throws(() => handoverQr([label()], true, []), /every selected/);
});
