import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accountActions, accountPayload, permissionChanges, permissionDescription, rolePayload, samePermissions } from '../src/lib/administration.ts'
import type { Account } from '../src/lib/administration.ts'
const account: Account = { id: 1, username: 'staff', email: 'staff@example.invalid', first_name: 'Sam', last_name: 'Lee', department_id: 2, role_id: 3, role_name: 'staff', is_active: '1', last_login_at: null }
const values = { first_name: 'Sam', last_name: 'Lee', username: 'sam.lee', email: ' sam@example.invalid ', password: '  long secret password  ', department_id: '2', role_id: '3' }
test('account operations enforce separate grants and hide self-status changes', () => {
  assert.deepEqual(accountActions(account, { id: 2, permissions: [] }), [])
  assert.deepEqual(accountActions(account, { id: 1, permissions: ['user.manage'] }), ['profile', 'department'])
  assert.deepEqual(accountActions(account, { id: 2, permissions: ['user.manage', 'role.manage'] }), ['profile', 'department', 'role', 'status'])
})
test('new accounts preserve password bytes and omit role assignment without its grant', () => {
  const data = accountPayload('create', values, false)
  assert.equal(data.password, values.password)
  assert.equal(data.email, 'sam@example.invalid')
  assert.equal('role_id' in data, false)
  assert.equal(accountPayload('create', values, true).role_id, 3)
  assert.throws(() => accountPayload('role', values, false), /requires/)
})
test('passwords honor UTF-8 byte boundaries, whitespace and NUL constraints', () => {
  for (const password of ['short', 'é'.repeat(37), 'validlongpassword\0']) assert.throws(() => accountPayload('create', { ...values, password }, true), /Password/)
  assert.equal(accountPayload('create', { ...values, password: 'é'.repeat(36) }, true).password, 'é'.repeat(36))
})
test('account identity, names and department are validated before review', () => {
  for (const change of [{ username: 'a b' }, { email: 'invalid' }, { first_name: ' ' }, { last_name: 'é'.repeat(51) }, { department_id: '0' }, { role_id: '' }]) assert.throws(() => accountPayload('create', { ...values, ...change }, true))
})
test('name edits submit changed fields only; status payload is boolean', () => {
  assert.deepEqual(accountPayload('profile', { ...values, first_name: 'Toni' }, false, account), { first_name: 'Toni' })
  assert.throws(() => accountPayload('profile', values, false, account), /No changes/)
  assert.deepEqual(accountPayload('status', {}, false, account), { is_active: false })
  assert.deepEqual(accountPayload('status', {}, false, { ...account, is_active: 0 }), { is_active: true })
  assert.throws(() => accountPayload('role', values, true, account), /different role/)
  assert.throws(() => accountPayload('department', values, true, account), /different department/)
})
test('role names follow backend syntax; optional descriptions can be cleared', () => {
  for (const role_name of ['ab', 'Admin', '1staff', 'staff role', 'a'.repeat(81)]) assert.throws(() => rolePayload({ role_name }))
  assert.deepEqual(rolePayload({ role_name: 'event_staff', description: '' }), { role_name: 'event_staff', description: null })
  const original = { id: 1, role_name: 'event_staff', description: 'Old' }
  assert.deepEqual(rolePayload({ role_name: 'event_staff', description: '' }, original), { description: null })
  assert.throws(() => rolePayload({ role_name: 'event_staff', description: 'é'.repeat(128) }), /255 bytes/)
})
test('grant review distinguishes additions/removals and rejects duplicate or excessive keys', () => {
  assert.deepEqual(permissionChanges(['a', 'b'], ['b', 'c']), { added: ['c'], removed: ['a'] })
  assert.equal(samePermissions(['a', 'b'], ['b', 'a']), true)
  assert.equal(samePermissions(['a', 'b'], ['a', 'c']), false)
  assert.throws(() => permissionChanges([], ['a', 'a']))
  assert.throws(() => permissionChanges([], Array.from({ length: 201 }, (_, index) => String(index))))
})
test('permission hints explain registered actions without inferring extra grants', () => {
  assert.equal(permissionDescription('asset_booking.release'), 'Release assets for asset bookings')
  assert.equal(permissionDescription('permission.manage'), 'Manage role permissions')
  assert.equal(permissionDescription('unknown.key'), 'unknown.key')
})
