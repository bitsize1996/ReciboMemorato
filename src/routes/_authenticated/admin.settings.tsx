import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { resetMyPassword } from "@/lib/auth.functions";
import { useBusinessInfo } from "@/lib/messages";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const biz = useBusinessInfo();
  const [infoDraft, setInfoDraft] = useState<{ email: string; pay: string } | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoBusy, setInfoBusy] = useState(false);
  const info = infoDraft ?? { email: biz.data?.email ?? "", pay: biz.data?.paymentInstructions ?? "" };

  async function saveInfo(event: React.FormEvent) {
    event.preventDefault();
    setInfoBusy(true);
    setInfoMessage(null);
    const { error } = await (supabase as any).from("business_info").upsert({
      id: 1,
      contact_email: info.email.trim() || null,
      payment_instructions: info.pay.trim() || null,
      updated_at: new Date().toISOString(),
    });
    setInfoBusy(false);
    if (error) return setInfoMessage("Could not save. The one-time setup for business details may not have been run yet.");
    setInfoDraft(null);
    setInfoMessage("Saved.");
    qc.invalidateQueries({ queryKey: ["biz", "business-info"] });
  }

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPwMessage(null);
    setPwError(null);
    if (password !== confirm) {
      setPwError("The two passwords don't match.");
      return;
    }
    setPwBusy(true);
    try {
      await resetMyPassword({ data: { password } });
      setPwMessage("Password updated.");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not update the password.");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="adm-page">
      <header className="adm-head"><h1>Settings</h1></header>
      <section className="adm-card">
        <h2>Account</h2>
        <p>Signed in as <strong>{user.email}</strong> (owner).</p>
        <p className="adm-hint">Currency: Philippine Peso (₱).</p>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </section>
      <section className="adm-card">
        <h2>Business details</h2>
        <p className="adm-hint">Used when you email or copy an invoice or an inquiry reply. Only you can see this page.</p>
        <form className="adm-form" onSubmit={saveInfo}>
          <label className="adm-wide">
            Your Recibo Memorato Gmail address
            <input
              type="email"
              placeholder="yourname@gmail.com"
              value={info.email}
              onChange={(e) => setInfoDraft({ ...info, email: e.target.value })}
            />
          </label>
          <label className="adm-wide">
            How customers pay (GCash number, bank details…)
            <textarea
              rows={4}
              placeholder={"GCash: 0917 000 0000 (Name)\nBDO: 0000 0000 00"}
              value={info.pay}
              onChange={(e) => setInfoDraft({ ...info, pay: e.target.value })}
            />
          </label>
          {infoMessage ? <p className="adm-hint adm-wide">{infoMessage}</p> : null}
          <div className="adm-row">
            <Button type="submit" disabled={infoBusy}>{infoBusy ? "Saving…" : "Save details"}</Button>
          </div>
        </form>
      </section>
      <section className="adm-card">
        <h2>Change password</h2>
        <form className="adm-form" onSubmit={changePassword}>
          <label className="adm-line">
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
          <label className="adm-line">
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
          {pwMessage ? <p className="adm-hint">{pwMessage}</p> : null}
          {pwError ? <p className="adm-error">{pwError}</p> : null}
          <Button type="submit" disabled={pwBusy}>
            {pwBusy ? "Saving…" : "Update password"}
          </Button>
        </form>
      </section>
    </div>
  );
}
