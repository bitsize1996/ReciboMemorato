/** Your services, in the order they appear on the Packages page. */
export const PRODUCT_LINES: { key: string; label: string; kind: "event" | "made_to_order" | "popup" }[] = [
  { key: "receipt", label: "Receipt photobooth", kind: "event" },
  { key: "standard", label: "Standard photobooth", kind: "event" },
  { key: "high_angle", label: "High-angle photobooth", kind: "event" },
  { key: "sintra", label: "Photo Sintra board", kind: "made_to_order" },
  { key: "instax", label: "Instax printing", kind: "made_to_order" },
  { key: "popup", label: "Pop-up photobooth (pay per print)", kind: "popup" },
];

export const lineLabel = (key: string | null | undefined) =>
  PRODUCT_LINES.find((line) => line.key === key)?.label ?? "Other packages";

/** The homepage service cards, in order, and the package group each one links to. */
export const SERVICE_CARD_LINES = ["receipt", "standard", "high_angle", "sintra", "instax"];

export interface PublicPackage {
  id: string;
  name: string;
  description: string | null;
  includedServices: string | null;
  price: number;
  serviceType: "event" | "made_to_order" | "popup_print";
  productLine: string | null;
  popupAvailable: boolean;
  /** Sample photos, first one is the cover. */
  photos: { url: string; caption: string | null }[];
}
