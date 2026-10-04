export const PRODUCT_TAGS: { key: string; label: string }[] = [
  { key: "sintra", label: "Sintra board" },
  { key: "instax", label: "Instax prints" },
  { key: "other", label: "Other" },
];

export const productLabel = (key: string) => PRODUCT_TAGS.find((p) => p.key === key)?.label ?? key;

export interface ShowcaseItem {
  id: string;
  title: string;
  product: string;
  imageUrl: string;
  caption: string | null;
  customerLabel: string | null;
  completedOn: string | null;
}
