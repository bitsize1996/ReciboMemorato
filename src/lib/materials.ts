/** The product lines a material can be used for. Standard and high-angle photobooths share the same supplies. */
export const MATERIAL_GROUPS: { key: string; label: string }[] = [
  { key: "receipt", label: "Receipt photobooth" },
  { key: "booth", label: "Standard & high-angle photobooth" },
  { key: "instax", label: "Instax printing" },
  { key: "sintra", label: "Sintra board" },
];

export const groupLabel = (key: string) => MATERIAL_GROUPS.find((g) => g.key === key)?.label ?? key;

const SHARED = "Shared supplies";
const UNASSIGNED = "Not assigned yet";

/** The single heading a material is listed under in pickers. */
export function materialHeading(usedFor: unknown): string {
  const tags = Array.isArray(usedFor) ? (usedFor as string[]).filter((t) => MATERIAL_GROUPS.some((g) => g.key === t)) : [];
  if (tags.length === 0) return UNASSIGNED;
  if (tags.length === 1) return groupLabel(tags[0]!);
  return SHARED;
}

/** Heading order for pickers: each product line, then shared, then unassigned. */
export const HEADING_ORDER = [...MATERIAL_GROUPS.map((g) => g.label), SHARED, UNASSIGNED];

export function usedForOf(material: { used_for?: unknown }): string[] {
  return Array.isArray(material.used_for) ? (material.used_for as string[]) : [];
}
