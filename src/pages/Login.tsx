import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import { Link, Navigate } from "react-router";
import { Brand, Button } from "../components/ui";
import { useAuth } from "../lib/session";
import { GoogleButton } from "../components/GoogleButton";

export default function Login() {
  const { user, expired, signIn, googleSignIn } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    document.title = "Sign in · CFABS";
  }, []);
  if (user) return <Navigate to="/" replace />;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await signIn(
        String(data.get("email")).trim(),
        String(data.get("password")),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-intro" aria-label="Campus booking service">
        <Brand />
        <div className="intro-copy">
          <p className="eyebrow">A shared campus. A simpler day.</p>
          <h2>
            Make room
            <br />
            for what’s next.
          </h2>
          <p>
            One workspace for campus facilities, shared equipment, and the
            people who use them.
          </p>
          <div className="intro-rule" />
          <div className="intro-detail">
            <span>01</span>
            <p>
              <strong>Plan with confidence</strong>See availability before
              requesting a space or asset.
            </p>
          </div>
          <div className="intro-detail">
            <span>02</span>
            <p>
              <strong>Stay in the loop</strong>Keep approvals, decisions, and
              reminders in one place.
            </p>
          </div>
        </div>
        <p className="intro-footer">
          Campus Facility &amp; Asset Booking System
        </p>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <p className="eyebrow">Your campus workspace</p>
          <h1>Welcome back</h1>
          <p className="muted">Sign in with your campus account to continue.</p>
          {expired && (
            <p className="notice" role="status">
              Your session ended. Sign in again to continue.
            </p>
          )}
          <form onSubmit={submit} aria-busy={pending}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@campus.edu"
                required
                maxLength={255}
                disabled={pending}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={pending}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
              <span aria-hidden="true">→</span>
            </Button>
          </form>
          <p className="recovery-link"><Link to="/forgot-password">Forgot your password?</Link></p>
          <div className="google-login-option">
            <p className="muted">Or use your linked Google account</p>
            <GoogleButton intent="login" disabled={pending} onBusy={setPending} onCredential={googleSignIn} />
            <p className="muted">First time? Sign in with your campus password, then link Google in My account.</p>
          </div>
          <p className="login-help">
            Need access or help signing in?
            <br />
            Contact your campus system administrator.
          </p>
        </div>
        <p className="login-footer">Designed for the way your campus works.</p>
      </section>
    </main>
  );
}
