import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { saleTotals } from "./finance";

// All reads below go through the signed-in session; the database only returns
// rows to admin accounts (row-level security), so nothing leaks to visitors.

export function useSales() {
  return useQuery({
    queryKey: ["biz", "sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, packages(name), sale_materials(total_cost), sale_expenses(amount)")
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((s) => ({ ...s, totals: saleTotals(s) }));
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
        .select("*, package_materials(id, quantity, material_id, materials(name, unit, current_unit_cost))")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
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
      return data ?? [];
    },
  });
}
