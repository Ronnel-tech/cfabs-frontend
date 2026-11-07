import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canManage, catalogPayload } from '../src/lib/catalog.ts'

const pool = { asset_code: 'CHAIRS', asset_name: 'Chairs', category_id: '2', owning_department_id: '3', tracking_mode: 'quantity', total_quantity: '10', usable_quantity: '8', condition_status: 'good', location: '', description: '' }
test('catalog access requires explicit read and write grants', () => {
  assert.equal(canManage('assets', ['asset.create']), false)
  assert.equal(canManage('assets', ['asset.view', 'asset.create']), true)
  assert.equal(canManage('departments', ['department.manage']), true)
  assert.equal(canManage('facilities', ['system_admin']), false)
})
test('pool quantities are whole and usable stock is bounded', () => {
  assert.equal(catalogPayload('assets', pool).usable_quantity, 8)
  for (const quantity of ['1.5', '-1', '4294967296', '']) assert.throws(() => catalogPayload('assets', { ...pool, usable_quantity: quantity }))
  assert.throws(() => catalogPayload('assets', { ...pool, usable_quantity: '11' }), /exceed/)
  assert.throws(() => catalogPayload('assets', { ...pool, condition_status: 'damaged' }), /zero/)
})
test('individual inventory is derived from instances and tracking mode cannot be patched', () => {
  const values = { ...pool, tracking_mode: 'individual' }
  const payload = catalogPayload('assets', values)
  assert.equal('total_quantity' in payload, false)
  assert.equal('usable_quantity' in payload, false)
  const original = { ...payload, id: 1, status: 'active' }
  assert.throws(() => catalogPayload('assets', values, original), /No changes/)
  const change = catalogPayload('assets', { ...values, asset_name: 'Projectors' }, original)
  assert.deepEqual(change, { asset_name: 'Projectors' })
})
test('edits preserve unrelated server state and allow clearing optional text', () => {
  const original = { ...catalogPayload('assets', pool), id: 1, status: 'active', custodian_id: 12 }
  assert.deepEqual(catalogPayload('assets', { ...pool, asset_name: 'Updated' }, original), { asset_name: 'Updated' })
  assert.deepEqual(catalogPayload('departments', { department_code: 'D', department_name: 'Dept', description: '' }, { id: 1, status: 'active', department_code: 'D', department_name: 'Dept', description: 'Old' }), { description: null })
})
test('required text, UTF-8 limits and lookup IDs match backend constraints', () => {
  assert.throws(() => catalogPayload('departments', { department_code: ' ', department_name: 'Dept' }), /required/)
  assert.throws(() => catalogPayload('instances', { asset_tag: 'é'.repeat(31), condition_status: 'good' }), /60 bytes/)
  assert.throws(() => catalogPayload('assets', { ...pool, category_id: '0' }))
  assert.throws(() => catalogPayload('instances', { asset_tag: 'P1', condition_status: 'unknown' }), /valid/)
})
test('facility capacity is positive and optional location fields may be empty', () => {
  const values = { facility_code: 'HALL', facility_name: 'Hall', category_id: '1', capacity: '50', building: '', location_details: '', description: '' }
  assert.equal(catalogPayload('facilities', values).capacity, 50)
  assert.equal(catalogPayload('facilities', values).building, null)
  for (const capacity of ['0', '1.5', '-2']) assert.throws(() => catalogPayload('facilities', { ...values, capacity }))
})
