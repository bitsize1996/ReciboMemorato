const pesoFmt = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const peso = (v: unknown) => pesoFmt.format(n(v));

export function margin(profit: number, revenue: number): number | null {
  return revenue > 0 ? (profit / revenue) * 100 : null;
}

export const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(2)}%`);

export interface SaleTotalsInput {
  selling_price: unknown;
  discount: unknown;
  sale_materials?: { total_cost: unknown }[] | null;
  sale_expenses?: { amount: unknown }[] | null;
}

export function saleTotals(s: SaleTotalsInput) {
  const netRevenue = n(s.selling_price) - n(s.discount);
  const materials = (s.sale_materials ?? []).reduce((a, m) => a + n(m.total_cost), 0);
  const expenses = (s.sale_expenses ?? []).reduce((a, e) => a + n(e.amount), 0);
  const totalCost = materials + expenses;
  const profit = netRevenue - totalCost;
  return { netRevenue, materials, expenses, totalCost, profit, margin: margin(profit, netRevenue) };
}

export const PAYMENT_STATUSES = [
  ["unpaid", "Unpaid"],
  ["partially_paid", "Partially Paid"],
  ["fully_paid", "Fully Paid"],
  ["refunded", "Refunded"],
  ["cancelled", "Cancelled"],
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number][0];

export const statusLabel = (s: string) => PAYMENT_STATUSES.find(([k]) => k === s)?.[1] ?? s;

export const EXPENSE_CATEGORIES = [
  "Transportation",
  "Labor",
  "Food",
  "Equipment",
  "Rental",
  "Delivery",
  "Miscellaneous",
];

export const saleCode = (num: number | null) => `#${String(num ?? 0).padStart(4, "0")}`;

export type RangeKey = "today" | "week" | "month" | "year" | "all" | "custom";

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function rangeDates(key: RangeKey, from = "", to = ""): { from: string; to: string } {
  const now = new Date();
  const today = iso(now);
  if (key === "today") return { from: today, to: today };
  if (key === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return { from: iso(d), to: today };
  }
  if (key === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (key === "year") return { from: `${now.getFullYear()}-01-01`, to: today };
  if (key === "custom") return { from, to };
  return { from: "", to: "" };
}

export const inRange = (date: string | null, r: { from: string; to: string }) =>
  !!date && (!r.from || date >= r.from) && (!r.to || date <= r.to);

export const thisMonth = () => rangeDates("month");

export function sumSales(rows: { totals: { netRevenue: number; totalCost: number; profit: number; materials: number; expenses: number } }[]) {
  return rows.reduce(
    (a, s) => ({
      revenue: a.revenue + s.totals.netRevenue,
      cost: a.cost + s.totals.totalCost,
      profit: a.profit + s.totals.profit,
      materials: a.materials + s.totals.materials,
      expenses: a.expenses + s.totals.expenses,
    }),
    { revenue: 0, cost: 0, profit: 0, materials: 0, expenses: 0 },
  );
}

