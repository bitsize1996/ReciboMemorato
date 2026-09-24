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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
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

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">Owner access</p>
        <h1>{mode === "signin" ? "Sign in" : "Create your owner account"}</h1>
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
        {message ? <p className="auth-message">{message}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
        <button
          type="button"
          className="auth-switch"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
