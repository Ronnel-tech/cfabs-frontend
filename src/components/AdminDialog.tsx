import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { Button } from "./ui";

export type AdminWrite = {
  path: string;
  method: "POST" | "PATCH" | "PUT";
  body: object;
  beforeSave?: () => Promise<void>;
};
export default function AdminDialog({
  title,
  children,
  prepare,
  review,
  onClose,
  ready = true,
  refreshKeys = ["admin-accounts", "admin-roles", "admin-grants"],
  refreshSession = true,
  successMessage = "Changes saved. Current account access will refresh automatically.",
  reviewNote = "The server rechecks your access and protects the last active account with all three administration permissions.",
}: {
  title: string;
  children: ReactNode;
  prepare: () => AdminWrite;
  review: ReactNode;
  onClose: (message?: string) => void;
  ready?: boolean;
  refreshKeys?: string[];
  refreshSession?: boolean;
  successMessage?: string;
  reviewNote?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const cache = useQueryClient();
  const [attempt, setAttempt] = useState<AdminWrite | null>(null);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    dialog.current?.querySelector("h2")?.focus();
  }, []);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || uncertain || !ready) return;
    if (!attempt) {
      try {
        setAttempt(prepare());
        setError("");
      } catch (failure) {
        setError((failure as Error).message);
      }
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    let succeeded = false,
      submitted = false;
    try {
      await attempt.beforeSave?.();
      submitted = true;
      await api.request(attempt.path, {
        method: attempt.method,
        body: JSON.stringify(attempt.body),
      });
      succeeded = true;
    } catch (failure) {
      if (
        submitted &&
        (!(failure instanceof ApiError) ||
          failure.status === 0 ||
          failure.status >= 500)
      ) {
        setUncertain(true);
        setError(
          "The result could not be confirmed. Close and refresh the list to check the current state before submitting again.",
        );
      } else {
        setError((failure as Error).message);
        setAttempt(null);
      }
    } finally {
      // A role change may affect this session too; reuse the provider's guarded refresh.
      if (submitted && refreshSession) window.dispatchEvent(new Event("cfabs:profile-refresh"));
      await Promise.all(
        refreshKeys.map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
      busy.current = false;
      setPending(false);
    }
    if (succeeded) onClose(successMessage);
  }
  return (
    <dialog
      ref={dialog}
      className="decision-dialog admin-dialog"
      aria-labelledby="admin-dialog-title"
      onCancel={(event) => {
        if (busy.current) event.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={submit} aria-busy={pending}>
        <h2 id="admin-dialog-title" tabIndex={-1}>
          {attempt ? "Review changes" : title}
        </h2>
        {attempt ? (
          <div className="admin-review">
            {review}
            <p className="muted">
              {reviewNote}
            </p>
          </div>
        ) : (
          <fieldset disabled={pending || uncertain}>{children}</fieldset>
        )}
        {error && (
          <p role="alert" className="notice notice-error">
            {error}
          </p>
        )}
        <div className="action-buttons">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onClose()}
          >
            {uncertain ? "Close and check list" : "Cancel"}
          </Button>
          {attempt && !uncertain && (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setAttempt(null);
                setError("");
              }}
            >
              Go back
            </Button>
          )}
          <Button type="submit" disabled={pending || uncertain || !ready}>
            {pending
              ? "Saving…"
              : attempt
                ? "Confirm changes"
                : "Review changes"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
