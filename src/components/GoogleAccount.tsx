import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from './ui';
import { GoogleButton } from './GoogleButton';

type LinkedGoogle = { google_email: string; linked_at: string } | null;

export function GoogleAccount() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ['google-link'], queryFn: ({ signal }) => api.request<LinkedGoogle>('/auth/google/link', { signal }), retry: false });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (confirming) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirming]);

  async function link(credential: string, challenge_token: string) {
    setError('');
    setMessage('');
    const linked = await api.request<LinkedGoogle>('/auth/google/link', { method: 'POST', body: JSON.stringify({ credential, challenge_token, password }) });
    setPassword('');
    queryClient.setQueryData(['google-link'], linked);
    setMessage('Google account linked. You can now use Google Sign-In.');
  }
  async function unlink(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.request('/auth/google/unlink', { method: 'POST', body: JSON.stringify({ password }) });
      queryClient.setQueryData(['google-link'], null);
      setPassword('');
      setConfirming(false);
      setMessage('Google account unlinked. Continue signing in with your campus password.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not unlink Google. Try again.');
    } finally { setBusy(false); }
  }
  return <section className="surface profile google-account">
    <h2>Google Sign-In</h2>
    <p className="muted">Link a school Google account or personal Gmail account to your existing campus account. Your campus role and access stay the same.</p>
    {status.isPending ? <p role="status">Loading linked account…</p> : status.error ? <>
      <p className="notice notice-error" role="alert">{status.error.message}</p>
      <Button type="button" variant="secondary" onClick={() => void status.refetch()}>Retry</Button>
    </> : status.data ? <>
      <p>Linked to <strong>{status.data.google_email}</strong></p>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => { setError(''); setPassword(''); setConfirming(true); }}>Unlink Google account</Button>
    </> : <>
      <p className="muted">Confirm your campus password, then choose the Google account you want to link.</p>
      <div className="field">
        <label htmlFor="google-link-password">Campus password</label>
        <input id="google-link-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
      </div>
      <GoogleButton intent="link" disabled={busy || !password} onBusy={setBusy} onCredential={link} />
    </>}
    {message && <p className="notice notice-success" role="status">{message}</p>}
    <dialog ref={dialog} className="decision-dialog" aria-labelledby="unlink-google-title" onCancel={(event) => { if (busy) event.preventDefault(); else { setConfirming(false); setPassword(''); } }}>
      <form onSubmit={unlink} aria-busy={busy}>
        <h2 id="unlink-google-title">Unlink Google account?</h2>
        <p>This prevents future Google sign-ins. Existing sessions remain active. You can still sign in with your campus password.</p>
        <div className="field">
          <label htmlFor="google-unlink-password">Confirm campus password</label>
          <input id="google-unlink-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
        </div>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <div className="action-buttons">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => { setConfirming(false); setPassword(''); }}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Unlinking…' : 'Unlink Google'}</Button>
        </div>
      </form>
    </dialog>
  </section>;
}
