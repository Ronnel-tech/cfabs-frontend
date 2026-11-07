type GoogleIdentity = {
  initialize: (options: { client_id: string; nonce: string; auto_select: boolean; callback: (result: { credential?: string }) => void }) => void;
  renderButton: (element: HTMLElement, options: { type: string; theme: string; size: string; text: string; width: number }) => void;
};
declare global {
  interface Window { google?: { accounts: { id: GoogleIdentity } } }
}

let loading: Promise<GoogleIdentity> | null = null;

// Load the provider's maintained client directly; never store Google credentials.
export function loadGoogle(): Promise<GoogleIdentity> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(fail, 15_000);
    function fail() {
      window.clearTimeout(timer);
      script.remove();
      loading = null;
      reject(new Error('Google could not load. Check your connection or use your campus password.'));
    }
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timer);
      const identity = window.google?.accounts.id;
      if (identity) resolve(identity);
      else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}

export type GoogleConfig = { enabled: boolean; client_id: string };
export type GoogleChallenge = { nonce: string; challenge_token: string; expires_in: number };
