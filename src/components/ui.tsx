import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props} />
  );
}

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        C<span />
      </span>
      <span>
        CFABS<span className="brand-subtitle">Campus bookings</span>
      </span>
    </span>
  );
}

export function Loading({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div className="notice notice-error" role="alert">
      <p>{error.message}</p>
      <Button variant="secondary" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol" aria-hidden="true">
        —
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <p className="muted">{children}</p>}
    </header>
  );
}
