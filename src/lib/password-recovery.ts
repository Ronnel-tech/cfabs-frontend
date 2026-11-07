import { validatePassword } from './administration.ts';

export function resetToken(fragment: string): string {
  const token = new URLSearchParams(fragment.replace(/^#/, '')).get('token') ?? '';
  return /^[a-f0-9]{64}$/.test(token) ? token : '';
}
export function resetPayload(token: string, password: string, confirmation: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('This reset link is invalid. Request a new one.');
  validatePassword(password);
  if (password !== confirmation) throw new Error('Passwords must match.');
  return { token, password, confirmation };
}
