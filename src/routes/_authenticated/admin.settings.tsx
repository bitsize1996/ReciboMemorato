import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings | Recibo Memorato Admin" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
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
    </div>
  );
}
