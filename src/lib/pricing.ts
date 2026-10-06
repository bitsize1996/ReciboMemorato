/**
 * Package pricing calculator.
 *
 * Costs are the materials a package uses plus operation costs (labor, transport,
 * electricity…). An operation cost is either a fixed amount or a percent of the
 * selling price (for example a 2.5% payment fee). The target is either a margin
 * (profit as a share of the price) or a markup (profit as a share of the cost).
 */

export type MarginMode = "margin" | "markup";

export interface OpCost {
  label: string;
  /** What was typed: pesos, or a percent when `percent` is true. */
  amount: string;
  percent: boolean;
}

const num = (value: unknown): number => {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
};

export function splitOps(ops: OpCost[]) {
  let fixed = 0;
  let rate = 0;
  for (const op of ops) {
    if (op.percent) rate += num(op.amount) / 100;
    else fixed += num(op.amount);
  }
  return { fixed, rate };
}

/** Operation costs at a given selling price. */
export function opCostAt(ops: OpCost[], price: number): number {
  const { fixed, rate } = splitOps(ops);
  return fixed + rate * price;
}

export interface Suggestion {
  price: number | null;
  /** Why no price could be suggested. */
  problem?: string;
}

/** The selling price that reaches the target margin or markup. */
export function suggestPrice(opts: {
  materialCost: number;
  ops: OpCost[];
  targetPercent: number;
  mode: MarginMode;
  roundTo: number;
}): Suggestion {
  const { fixed, rate } = splitOps(opts.ops);
  const base = opts.materialCost + fixed;
  const target = opts.targetPercent / 100;
  const denominator = opts.mode === "margin" ? 1 - rate - target : 1 - rate * (1 + target);
  if (denominator <= 0) {
    return {
      price: null,
      problem:
        opts.mode === "margin"
          ? "The margin plus percent fees add up to 100% or more, so no price can reach it."
          : "The percent fees are too high for this markup.",
    };
  }
  const raw = opts.mode === "margin" ? base / denominator : (base * (1 + target)) / denominator;
  if (!(raw > 0)) return { price: null, problem: "Add materials or costs first." };
  const price = opts.roundTo > 0 ? Math.ceil(raw / opts.roundTo) * opts.roundTo : raw;
  return { price: Math.round(price * 100) / 100 };
}

export interface Analysis {
  materials: number;
  operations: number;
  totalCost: number;
  profit: number;
  marginPercent: number;
  markupPercent: number;
  breakEven: number | null;
}

/** What a package earns at a given selling price. */
export function analyzePrice(price: number, materialCost: number, ops: OpCost[]): Analysis {
  const operations = opCostAt(ops, price);
  const totalCost = materialCost + operations;
  const profit = price - totalCost;
  const { fixed, rate } = splitOps(ops);
  return {
    materials: materialCost,
    operations,
    totalCost,
    profit,
    marginPercent: price > 0 ? (profit / price) * 100 : 0,
    markupPercent: totalCost > 0 ? (profit / totalCost) * 100 : 0,
    breakEven: rate < 1 ? (materialCost + fixed) / (1 - rate) : null,
  };
}

/** Turns saved JSON back into editable rows; old single "other costs" numbers still show up. */
export function opsFromSaved(saved: unknown, legacyTotal: unknown): OpCost[] {
  if (Array.isArray(saved) && saved.length > 0) {
    return (saved as Partial<OpCost>[]).map((row) => ({
      label: String(row.label ?? ""),
      amount: String(row.amount ?? "0"),
      percent: Boolean(row.percent),
    }));
  }
  const legacy = num(legacyTotal);
  return legacy > 0 ? [{ label: "Other costs", amount: String(legacy), percent: false }] : [];
}

/** Staff, transport and other operation costs are filed under the matching expense category. */
export function expenseCategoryFor(label: string): string {
  const l = label.toLowerCase();
  if (/(labor|labour|salary|salaries|wage|staff|crew|operator|attendant|manpower)/.test(l)) return "Labor";
  if (/(transport|fuel|gas|gasoline|travel|vehicle|grab)/.test(l)) return "Transportation";
  if (/(delivery|courier|lalamove)/.test(l)) return "Delivery";
  if (/(electric|power|utilit|wifi|internet)/.test(l)) return "Utilities";
  return "Operations";
}

export interface SaleExpenseDraft {
  category: string;
  description: string;
  amount: number;
}

/**
 * A package's operation costs for a sale: fixed amounts are multiplied by how many
 * were sold (like the materials), and percent costs are taken from the sale total.
 */
export function saleExpensesFromPackage(
  pkg: { operation_costs?: unknown; estimated_other_costs?: unknown },
  quantity: number,
  saleTotal: number,
): SaleExpenseDraft[] {
  const qty = quantity > 0 ? quantity : 1;
  const rows: SaleExpenseDraft[] = [];
  for (const op of opsFromSaved(pkg.operation_costs, pkg.estimated_other_costs)) {
    const typed = num(op.amount);
    const amount = Math.round((op.percent ? (typed / 100) * saleTotal : typed * qty) * 100) / 100;
    if (amount <= 0) continue;
    const description = op.label.trim() || "Operation cost";
    rows.push({ category: expenseCategoryFor(description), description, amount });
  }
  return rows;
}
