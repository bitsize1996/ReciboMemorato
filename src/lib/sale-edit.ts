import { n } from "./finance";

export interface SaleEditInput {
  old: { quantity: unknown; selling_price: unknown; payment_status: string; amount_paid: unknown };
  /** What was typed in the edit form. */
  next: { quantity: unknown; selling_price: unknown; discount: unknown };
  /** The package price for one item, when the package was replaced and you chose to reset from it. */
  resetPackagePrice: number | null;
  reprice: boolean;
  /** Total of the add-ons already on the sale. */
  addonsTotal: number;
}

export interface SaleEditResult {
  quantity: number;
  price: number;
  /** How much the materials and package costs scale by (1 = no change). */
  ratio: number;
  paymentStatus: string;
}

/** Works out the new quantity, price and payment status for an edited sale. */
export function computeSaleEdit(input: SaleEditInput): SaleEditResult {
  const oldQty = n(input.old.quantity) || 1;
  const quantity = Math.max(1, Math.round(n(input.next.quantity)) || 1);

  // The price follows the quantity unless a different price was typed.
  let price = n(input.next.selling_price);
  const priceTyped = price !== n(input.old.selling_price);
  if (quantity !== oldQty && input.reprice && !priceTyped) {
    price = Math.round((n(input.old.selling_price) / oldQty) * quantity * 100) / 100;
  }
  if (input.resetPackagePrice !== null) price = input.resetPackagePrice * quantity;

  // Keep the payment status honest when the amount to pay changed.
  const net = price + input.addonsTotal - n(input.next.discount);
  const paid = n(input.old.amount_paid);
  let paymentStatus = input.old.payment_status;
  if (paymentStatus === "fully_paid" && net - paid > 0.005) paymentStatus = "partially_paid";
  else if (paymentStatus === "partially_paid" && net > 0 && paid >= net - 0.005) paymentStatus = "fully_paid";

  return { quantity, price, ratio: quantity / oldQty, paymentStatus };
}
