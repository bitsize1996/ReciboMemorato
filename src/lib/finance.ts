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
  sale_addons?: { total_price: unknown }[] | null;
}

export function saleTotals(s: SaleTotalsInput) {
  const addons = (s.sale_addons ?? []).reduce((a, x) => a + n(x.total_price), 0);
  const netRevenue = n(s.selling_price) + addons - n(s.discount);
  const materials = (s.sale_materials ?? []).reduce((a, m) => a + n(m.total_cost), 0);
  const expenses = (s.sale_expenses ?? []).reduce((a, e) => a + n(e.amount), 0);
  const totalCost = materials + expenses;
  const profit = netRevenue - totalCost;
  return { netRevenue, addons, materials, expenses, totalCost, profit, margin: margin(profit, netRevenue) };
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


export const EXPENSE_KINDS = [
  ["one_time", "One-time"],
  ["recurring", "Recurring"],
] as const;

export const RECURRENCES = [
  ["weekly", "Every week"],
  ["monthly", "Every month"],
  ["yearly", "Every year"],
] as const;

export const recurrenceLabel = (r: string | null | undefined) =>
  RECURRENCES.find(([k]) => k === r)?.[1] ?? "";

type ExpenseLike = {
  expense_date: string;
  kind?: string | null;
  recurrence?: string | null;
  ends_on?: string | null;
};

function addPeriod(start: Date, recurrence: string, k: number): Date {
  const y = start.getFullYear();
  const m = start.getMonth();
  const d = start.getDate();
  if (recurrence === "weekly") return new Date(y, m, d + 7 * k);
  const months = recurrence === "yearly" ? 12 * k : k;
  const target = new Date(y, m + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d, lastDay));
}

/** How many times an expense falls inside a date range (a recurring one repeats). */
export function expenseOccurrences(e: ExpenseLike, range: { from: string; to: string }): number {
  if (e.kind !== "recurring" || !e.recurrence) return inRange(e.expense_date, range) ? 1 : 0;
  const [y, m, d] = e.expense_date.split("-").map(Number);
  const start = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const upper = [range.to || iso(new Date()), e.ends_on || ""].filter(Boolean).sort()[0]!;
  let count = 0;
  for (let k = 0; k < 1200; k += 1) {
    const day = iso(addPeriod(start, e.recurrence, k));
    if (day > upper) break;
    if (!range.from || day >= range.from) count += 1;
  }
  return count;
}

export const MOVEMENT_LABELS: Record<string, string> = {
  sale: "Used in a sale",
  restock: "Restock",
  adjustment: "Adjustment",
};

/** Value of the stock on hand at today's cost per unit. */
export const stockValue = (stock: unknown, unitCost: unknown) => Math.max(n(stock), 0) * n(unitCost);

type BusinessExpenseLike = ExpenseLike & { sale_id?: string | null; amount: unknown };

/** Business expenses (not tied to one booking) inside a date range; recurring ones repeat. */
export function businessExpenseTotals(expenses: BusinessExpenseLike[], range: { from: string; to: string }) {
  let oneTime = 0;
  let recurring = 0;
  for (const e of expenses) {
    if (e.sale_id) continue;
    const amount = n(e.amount) * expenseOccurrences(e, range);
    if (e.kind === "recurring") recurring += amount;
    else oneTime += amount;
  }
  return { oneTime, recurring, total: oneTime + recurring };
}

export const SALE_TYPES = [
  ["event", "Photobooth event"],
  ["made_to_order", "Made to order"],
  ["popup", "Pop-up"],
  ["other", "Other"],
] as const;

export type SaleType = (typeof SALE_TYPES)[number][0];

export const saleTypeLabel = (t: string | null | undefined) =>
  SALE_TYPES.find(([key]) => key === t)?.[1] ?? "Photobooth event";

/** The sale type a package belongs to. */
export const saleTypeOfPackage = (serviceType: string | null | undefined): SaleType =>
  serviceType === "made_to_order" ? "made_to_order" : serviceType === "popup_print" ? "popup" : "event";

/** Sales, revenue and profit for each kind of sale, for the Overview and Reports. */
export function salesByType(
  rows: { sale_type?: string | null; totals: { netRevenue: number; profit: number } }[],
) {
  const map = new Map<string, { type: string; label: string; count: number; revenue: number; profit: number }>();
  for (const [key, label] of SALE_TYPES) map.set(key, { type: key, label, count: 0, revenue: 0, profit: 0 });
  for (const row of rows) {
    const key = row.sale_type ?? "event";
    const entry = map.get(key) ?? { type: key, label: saleTypeLabel(key), count: 0, revenue: 0, profit: 0 };
    entry.count += 1;
    entry.revenue += row.totals.netRevenue;
    entry.profit += row.totals.profit;
    map.set(key, entry);
  }
  return [...map.values()].filter((entry) => entry.count > 0);
}
