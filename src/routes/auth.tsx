import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in | Recibo Memorato" },
      { name: "description", content: "Owner sign in for the Recibo Memorato memory archive." },
      { property: "og:title", content: "Sign in | Recibo Memorato" },
      { property: "og:description", content: "Owner access to the memory archive." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage("Check your email for the password reset link.");
      return;
    }

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/admin` },
          });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (!result.data.session) {
      setMessage("Check your email to confirm the account, then sign in.");
      return;
    }
    navigate({ to: "/admin" });
  }

  const heading = mode === "forgot" ? "Reset your password" : mode === "signup" ? "Create your owner account" : "Sign in";

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">Owner access</p>
        <h1>{heading}</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            required
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {mode !== "forgot" ? (
          <label>
            Password
            <input
              type="password"
              value={password}
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        ) : null}
        {message ? <p className="auth-message">{message}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "forgot"
              ? "Send reset email"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
        </Button>
        {mode === "signin" ? (
          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setMode("forgot");
              setMessage(null);
            }}
          >
            Forgot your password?
          </button>
        ) : (
          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setMode("signin");
              setMessage(null);
            }}
          >
            {mode === "forgot" ? "Back to sign in" : "Already have an account? Sign in"}
          </button>
        )}
      </form>
    </main>
  );
}
