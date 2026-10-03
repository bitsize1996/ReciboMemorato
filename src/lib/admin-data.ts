import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { saleTotals } from "./finance";

// All reads below go through the signed-in session; the database only returns
// rows to admin accounts (row-level security), so nothing leaks to visitors.

export function useSales() {
  return useQuery({
    queryKey: ["biz", "sales"],
    queryFn: async () => {
      // Add-ons only exist once their database setup has been run; fall back without them.
      const run = (fields: string) =>
        (supabase as any).from("sales").select(fields).order("booking_date", { ascending: false });
      let result = await run("*, packages(name), sale_materials(total_cost), sale_expenses(amount), sale_addons(total_price)");
      if (result.error) result = await run("*, packages(name), sale_materials(total_cost), sale_expenses(amount)");
      if (result.error) throw result.error;
      type Row = Database["public"]["Tables"]["sales"]["Row"] & {
        packages: { name: string } | null;
        sale_materials: { total_cost: number }[];
        sale_expenses: { amount: number }[];
        sale_addons?: { total_price: number }[];
        event_theme?: string | null;
        event_venue?: string | null;
      };
      return ((result.data ?? []) as Row[]).map((s) => ({ ...s, totals: saleTotals(s) }));
    },
  });
}

export type SaleRow = NonNullable<ReturnType<typeof useSales>["data"]>[number];

export function useMaterials() {
  return useQuery({
    queryKey: ["biz", "materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePackages() {
  return useQuery({
    queryKey: ["biz", "packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("*, package_materials(id, quantity, material_id, materials(name, unit, current_unit_cost, current_stock))")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface ExpenseRow {
  id: string;
  sale_id: string | null;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  notes: string | null;
  kind: string | null;
  recurrence: string | null;
  ends_on: string | null;
  sales: { id: string; sale_number: number; customer_name: string } | null;
}

export function useExpenses() {
  return useQuery({
    queryKey: ["biz", "expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_expenses")
        .select("*, sales(id, sale_number, customer_name)")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ExpenseRow[];
    },
  });
}

export interface AddonRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  sort_order: number;
}

/** Add-ons you offer (empty until their database setup has been run). */
export function useAddons() {
  return useQuery({
    queryKey: ["biz", "addons"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("addons")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) return { ready: false, rows: [] as AddonRow[] };
      return { ready: true, rows: (data ?? []) as AddonRow[] };
    },
  });
}
