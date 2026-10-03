import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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

const NAV_SECTIONS = [
  { label: null, items: [{ to: "/admin", label: "Overview", exact: true }] },
  {
    label: "Clients & bookings",
    items: [
      { to: "/admin/inquiries", label: "Inquiries" },
      { to: "/admin/sales", label: "Sales" },
      { to: "/admin/calendar", label: "Calendar" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/admin/expenses", label: "Expenses" },
      { to: "/admin/reports", label: "Reports" },
    ],
  },
  {
    label: "Inventory & pricing",
    items: [
      { to: "/admin/packages", label: "Packages" },
      { to: "/admin/materials", label: "Materials" },
    ],
  },
  {
    label: "Website",
    items: [
      { to: "/admin/events", label: "Gallery" },
      { to: "/admin/customize", label: "Customize" },
    ],
  },
  { label: "Account", items: [{ to: "/admin/settings", label: "Settings" }] },
] as const;

function AdminLayout() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const status = useQuery({ queryKey: ["admin-status"], queryFn: () => getAdminStatus() });
  // Number of unanswered inquiries, shown as a badge. Quietly 0 if the table isn't set up yet.
  const newInquiries = useQuery({
    queryKey: ["biz", "inquiries-new"],
    enabled: status.data?.isAdmin === true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("inquiries")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      return error ? 0 : (count ?? 0);
    },
  });
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
          {NAV_SECTIONS.map((section, index) => (
            <div key={section.label ?? `top-${index}`} style={{ display: "grid", gap: 2 }}>
              {section.label ? (
                <p
                  style={{
                    margin: "14px 0 4px",
                    padding: "0 .75rem",
                    fontSize: 11,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    opacity: 0.55,
                  }}
                >
                  {section.label}
                </p>
              ) : null}
              {section.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: "exact" in item }}
                  activeProps={{ className: "is-active" }}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                  {item.to === "/admin/inquiries" && (newInquiries.data ?? 0) > 0 ? (
                    <span
                      style={{
                        marginLeft: 8,
                        padding: "1px 8px",
                        borderRadius: 999,
                        background: "#d40e14",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {newInquiries.data}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
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
