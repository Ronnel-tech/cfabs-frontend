import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { resetPayload, resetToken } from '../lib/password-recovery';
import { Brand, Button, ErrorState, Loading } from '../components/ui';

export default function PasswordRecovery({ mode }: { mode: 'request' | 'confirm' }) {
  const confirming = mode === 'confirm';
  const [token, setToken] = useState(() => confirming ? resetToken(window.location.hash) : '');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const config = useQuery({
    queryKey: ['password-reset-config'], enabled: !confirming,
    queryFn: ({ signal }) => api.request<{ enabled: boolean }>('/auth/password-reset/config', { signal }),
    retry: false, refetchInterval: false,
  });
  useEffect(() => {
    document.title = `${confirming ? 'Choose a new password' : 'Reset password'} · CFABS`;
    if (confirming) window.history.replaceState(window.history.state, '', window.location.pathname);
  }, [confirming]);
  const disabled = pending || (!confirming && (!config.data?.enabled || config.isPending || !!config.error));
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError('');
    let body;
    try {
      body = confirming
        ? resetPayload(token, String(data.get('password')), String(data.get('confirmation')))
        : { email: String(data.get('email')).trim() };
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Check the form.'); return; }
    setPending(true);
    try {
      await api.request(`/auth/password-reset/${mode}`, { method: 'POST', body: JSON.stringify(body) });
      form.reset();
      if (confirming) {
        setToken('');
        api.setTokens(null);
        window.dispatchEvent(new Event('cfabs:expired'));
        setMessage('Password changed. Sign in with your new password. Previous sessions have been invalidated.');
      } else setMessage('If an active campus account matches this address, a reset email will be sent. Check your inbox and spam folder.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not complete this request. Try again.'); }
    finally { setPending(false); }
  }
  return <main className="recovery-layout">
    <Brand />
    <section className="surface recovery-panel" aria-labelledby="recovery-title">
      <Link className="back-link" to="/login">← Back to sign in</Link>
      <h1 id="recovery-title">{confirming ? 'Choose a new password' : 'Reset your password'}</h1>
      <p className="muted">{confirming ? 'Your reset link works once and expires after 30 minutes.' : 'Enter your campus account email to receive a single-use reset link.'}</p>
      {message ? <>
        <p className="notice notice-success" role="status">{message}</p>
        <Link className="button button-primary" to="/login">Return to sign in</Link>
      </> : confirming && !token ? <>
        <p className="notice notice-error" role="alert">This reset link is missing or invalid. Request a new link to continue.</p>
        <Link className="button button-primary" to="/forgot-password">Request a new reset link</Link>
      </> : <>
        {!confirming && config.isPending && <Loading label="Checking password reset service…" />}
        {!confirming && config.error && <ErrorState error={config.error} retry={() => void config.refetch()} />}
        {!confirming && config.data && !config.data.enabled && <p className="notice" role="status">Password reset email is not configured yet. Contact campus administration for help signing in.</p>}
        <form onSubmit={submit} aria-busy={pending}>
          <fieldset disabled={disabled}>
            {confirming ? <>
              <div className="field"><label htmlFor="recovery-password">New password</label><input id="recovery-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required aria-describedby="recovery-policy" /></div>
              <div className="field"><label htmlFor="recovery-confirmation">Confirm new password</label><input id="recovery-confirmation" name="confirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required /></div>
              <label className="recovery-show"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />Show passwords</label>
              <p className="muted" id="recovery-policy">Use 12–72 bytes. Spaces are preserved. You will need to sign in again after resetting.</p>
            </> : <div className="field"><label htmlFor="recovery-email">Campus email address</label><input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={255} placeholder="you@campus.edu" required /></div>}
            {error && <p className="notice notice-error" role="alert">{error}</p>}
            <Button type="submit" className="w-full">{pending ? 'Please wait…' : confirming ? 'Save new password' : 'Send reset link'}</Button>
          </fieldset>
        </form>
      </>}
    </section>
    <p className="muted recovery-footer">Campus Facility &amp; Asset Booking System</p>
  </main>;
}
