import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { claimAdmin, getAdminStatus } from "@/lib/events.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin | Recibo Memorato" },
      { name: "description", content: "Private Recibo Memorato business dashboard." },
      { property: "og:title", content: "Admin | Recibo Memorato" },
      { property: "og:description", content: "Private business dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/sales", label: "Sales" },
  { to: "/admin/packages", label: "Packages" },
  { to: "/admin/materials", label: "Materials" },
  { to: "/admin/expenses", label: "Expenses" },
  { to: "/admin/reports", label: "Reports" },
  { to: "/admin/events", label: "Gallery" },
  { to: "/admin/customize", label: "Customize" },
  { to: "/admin/settings", label: "Settings" },
] as const;

function AdminLayout() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const status = useQuery({ queryKey: ["admin-status"], queryFn: () => getAdminStatus() });
  const claim = useMutation({
    mutationFn: () => claimAdmin(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-status"] }),
  });

  if (status.isPending) return <div className="admin-shell admin-center">Loading…</div>;
  if (!status.data?.isAdmin) {
    return (
      <div className="admin-shell admin-center">
        <div className="adm-card" style={{ maxWidth: 420 }}>
          <h1>Owner access</h1>
          {status.data?.canClaim ? (
            <>
              <p>No owner has been set yet. Claim it with this account.</p>
              <Button onClick={() => claim.mutate()} disabled={claim.isPending}>
                Make this account the owner
              </Button>
            </>
          ) : (
            <p>This account doesn't have admin access.</p>
          )}
          <p><Link to="/">Back to website</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className={`adm-side ${open ? "is-open" : ""}`}>
        <div className="adm-brand">RECIBO MEMORATO <span>ADMIN</span></div>
        <nav>
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item }}
              activeProps={{ className: "is-active" }}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link to="/" className="adm-back">View website</Link>
      </aside>
      <div className="adm-main">
        <button type="button" className="adm-menu" onClick={() => setOpen(!open)}>☰ Menu</button>
        <Outlet />
      </div>
    </div>
  );
}
