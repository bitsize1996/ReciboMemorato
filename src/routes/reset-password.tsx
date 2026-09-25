import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password | Recibo Memorato" },
      { name: "description", content: "Choose a new password for your Recibo Memorato owner account." },
      { property: "og:title", content: "Set a new password | Recibo Memorato" },
      { property: "og:description", content: "Choose a new password for your Recibo Memorato owner account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)));
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (password !== confirm) {
      setMessage("The two passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    navigate({ to: "/admin" });
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">Owner access</p>
        <h1>Set a new password</h1>
        {hasSession === false ? (
          <p className="auth-message">
            This reset link isn't active. Go back to sign in and request a new password email.
          </p>
        ) : (
          <>
            <label>
              New password
              <input
                type="password"
                value={password}
                required
                minLength={8}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Repeat new password
              <input
                type="password"
                value={confirm}
                required
                minLength={8}
                autoComplete="new-password"
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            {message ? <p className="auth-message">{message}</p> : null}
            <Button type="submit" disabled={busy || hasSession === null}>
              {busy ? "Saving…" : "Save new password"}
            </Button>
          </>
        )}
        <button
          type="button"
          className="auth-switch"
          onClick={() => navigate({ to: "/auth" })}
        >
          Back to sign in
        </button>
      </form>
    </main>
  );
}
