import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetPayload, resetToken } from '../src/lib/password-recovery.ts';

const token = 'a'.repeat(64);
test('reset credentials are accepted only from a well-formed fragment', () => {
  assert.equal(resetToken(`#token=${token}`), token);
  assert.equal(resetToken('#token=short'), '');
  assert.equal(resetToken('#token=%3Cscript%3E'), '');
  assert.equal(resetToken(''), '');
});
test('reset payload preserves password spaces and requires confirmation', () => {
  assert.deepEqual(resetPayload(token, '  my new password  ', '  my new password  '), { token, password: '  my new password  ', confirmation: '  my new password  ' });
  assert.throws(() => resetPayload(token, 'my new password', 'different'), /match/);
  assert.throws(() => resetPayload('', 'my new password', 'my new password'), /invalid/);
});
test('reset password policy shares account creation UTF-8 byte limits', () => {
  const unicode = 'é'.repeat(36);
  assert.doesNotThrow(() => resetPayload(token, unicode, unicode));
  assert.throws(() => resetPayload(token, `${unicode}x`, `${unicode}x`), /72/);
  assert.throws(() => resetPayload(token, 'short', 'short'), /12/);
  assert.throws(() => resetPayload(token, 'password\0value', 'password\0value'), /NUL/);
});
