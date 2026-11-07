import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { loadGoogle } from '../lib/google';
import type { GoogleConfig, GoogleChallenge } from '../lib/google';
import { Button } from './ui';

export function GoogleButton({ intent, disabled, onCredential, onBusy }: {
  intent: 'login' | 'link';
  disabled: boolean;
  onCredential: (credential: string, challenge: string) => Promise<void>;
  onBusy: (value: boolean) => void;
}) {
  const config = useQuery({ queryKey: ['google-config'], queryFn: ({ signal }) => api.request<GoogleConfig>('/auth/google/config', { signal }), staleTime: 300_000, retry: false });
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ disabled, onCredential, onBusy });
  useEffect(() => { latest.current = { disabled, onCredential, onBusy }; });
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!config.data?.enabled) return;
    const controller = new AbortController();
    let active = true;
    let used = false;
    let timer: number | undefined;
    const element = host.current;
    void Promise.all([
      loadGoogle(),
      api.request<GoogleChallenge>('/auth/google/challenge', { method: 'POST', body: JSON.stringify({ intent }), signal: controller.signal }),
    ]).then(([identity, challenge]) => {
      if (!active || !element) return;
      identity.initialize({
        client_id: config.data.client_id,
        nonce: challenge.nonce,
        auto_select: false,
        callback: (result) => {
          if (!active || used || latest.current.disabled || !result.credential) return;
          used = true;
          window.clearTimeout(timer);
          latest.current.onBusy(true);
          void latest.current.onCredential(result.credential, challenge.challenge_token).catch((failure: unknown) => {
            if (active) setError(failure instanceof Error ? failure.message : 'Google sign-in failed. Try again.');
          }).finally(() => {
            latest.current.onBusy(false);
            if (active) {
              setReady(false);
              element.replaceChildren();
            }
          });
        },
      });
      element.replaceChildren();
      identity.renderButton(element, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', width: Math.min(350, Math.max(200, element.clientWidth)) });
      setReady(true);
      timer = window.setTimeout(() => {
        if (active && !used) { setReady(false); setError(''); setAttempt((value) => value + 1); }
      }, (challenge.expires_in - 30) * 1000);
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : 'Google sign-in could not start.');
    });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
      element?.replaceChildren();
    };
  }, [attempt, config.data, intent]);

  if (config.isPending) return <p className="muted" role="status">Checking Google Sign-In…</p>;
  if (config.data && !config.data.enabled) return <p className="muted">Google Sign-In is not yet configured.</p>;
  return <div className="google-signin">
    <div ref={host} inert={disabled} aria-busy={!ready && !error} />
    {!ready && !error && !config.error && <p className="muted" role="status">Preparing Google Sign-In…</p>}
    {(error || config.error) && <p className="notice notice-error" role="alert">{error || config.error?.message}</p>}
    {(error || config.error) && <Button type="button" variant="secondary" disabled={disabled} onClick={() => {
      setReady(false);
      setError('');
      if (config.error) void config.refetch();
      else setAttempt((value) => value + 1);
    }}>Try Google again</Button>}
  </div>;
}
