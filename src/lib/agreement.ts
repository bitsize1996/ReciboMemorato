import { n } from "./finance";

/** Everything written in the service agreement. All of it can be changed per booking. */
export interface AgreementTerms {
  businessName: string;
  clientName: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  serviceTime: string;
  durationHours: string;
  theme: string;
  backdrop: string;
  serviceText: string;
  packageLabel: string;
  /** What the package includes, one item per line. */
  inclusions: string;
  totalRate: string;
  reservationFee: string;
  rescheduleNoticeDays: string;
  graceMinutes: string;
  pauseLimitMinutes: string;
  extraPauseFee: string;
  extraPrintFee: string;
  overtimeRate: string;
  /** Extra overtime charge per hour when the package has the Magnet add-on. Leave empty to leave the sentence out. */
  magnetOvertime: string;
  spaceNeeded: string;
  powerNeeded: string;
  // Optional clauses
  includeSetupClause: boolean;
  setupMinutes: string;
  includeDamageClause: boolean;
  includePhotoUseClause: boolean;
  includeGalleryClause: boolean;
  galleryDays: string;
  includeForceMajeure: boolean;
  includeUnpaidBalanceClause: boolean;
  includeStaffMeal: boolean;
  staffMealHours: string;
  /** A travel fee for far venues. Both must be filled in for the sentence to appear. */
  travelFee: string;
  travelArea: string;
  includePowerClause: boolean;
  additionalTerms: string;
  representativeName: string;
  includeSignature: boolean;
  agreementDate: string;
}

/** The wording and amounts used when you have not saved your own. */
export const DEFAULT_TERMS = {
  businessName: "Recibo Memorato Photobooth",
  serviceText:
    "agrees to provide photobooth service including booth setup, camera, printer, backdrop, props (if applicable), and on-site attendant during the agreed service duration.",
  reservationFee: "1000",
  rescheduleNoticeDays: "3",
  graceMinutes: "10–15",
  pauseLimitMinutes: "30",
  extraPauseFee: "1000",
  extraPrintFee: "50",
  overtimeRate: "1000",
  magnetOvertime: "700",
  spaceNeeded: "2.5m x 2.5m",
  powerNeeded: "One 220V power outlet",
  includeSetupClause: true,
  setupMinutes: "60",
  includeDamageClause: true,
  includePhotoUseClause: true,
  includeGalleryClause: false,
  galleryDays: "30",
  includeForceMajeure: true,
  includeUnpaidBalanceClause: false,
  includeStaffMeal: false,
  staffMealHours: "4",
  travelFee: "",
  travelArea: "",
  includePowerClause: true,
  additionalTerms: "",
  includeSignature: true,
} satisfies Partial<AgreementTerms>;

/** Amounts are shown without cents unless they have some, like the original agreement. */
export function money(value: unknown): string {
  const amount = n(value);
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export interface SaleForAgreement {
  customer_name: string;
  event_name: string | null;
  event_date: string | null;
  event_time: string | null;
  event_venue?: string | null;
  event_theme?: string | null;
  backdrop?: string | null;
  service_hours?: unknown;
  package_name_snapshot: string | null;
  selling_price: unknown;
  discount: unknown;
  packages?: { included_services?: string | null } | null;
  sale_addons?: { name_snapshot: string; quantity?: unknown; total_price: unknown }[] | null;
}

/** "3 hours, 50 prints" or one item per line becomes a list of items. */
export function splitList(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\n|;|,/)
    .map((part) => part.replace(/^[-•*✓]\s*/, "").trim())
    .filter(Boolean);
}

const clock = (minutes: number): string => {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, "0")} ${suffix}`;
};

/** "14:00" with 2 hours becomes "2:00 PM – 4:00 PM". Anything else typed by hand is kept as written. */
export function serviceWindow(start: string | null | undefined, hours: number): string {
  const text = (start ?? "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match || !(hours > 0)) return text;
  const from = Number(match[1]) * 60 + Number(match[2]);
  return `${clock(from)} – ${clock(from + hours * 60)}`;
}

/** A first draft of the terms for a booking, from the booking itself and your saved defaults. */
export function termsFromSale(
  sale: SaleForAgreement,
  defaults: Partial<AgreementTerms> | null | undefined,
  representativeName: string,
): AgreementTerms {
  const addons = sale.sale_addons ?? [];
  const total = n(sale.selling_price) + addons.reduce((a, x) => a + n(x.total_price), 0) - n(sale.discount);
  const label = [sale.package_name_snapshot ?? "Photobooth service", ...addons.map((a) => a.name_snapshot)].join(" + ");
  const hasMagnet = /magnet/i.test(label);
  const base = { ...DEFAULT_TERMS, ...(defaults ?? {}) };
  const hours = n(sale.service_hours);
  const inclusions = [
    ...splitList(sale.packages?.included_services),
    ...addons.map((a) => `Add-on: ${a.name_snapshot}${n(a.quantity) > 1 ? ` × ${n(a.quantity)}` : ""}`),
  ].join("\n");
  return {
    ...base,
    clientName: sale.customer_name,
    eventName: sale.event_name ?? "",
    eventDate: sale.event_date ?? "",
    eventLocation: sale.event_venue ?? "",
    serviceTime: serviceWindow(sale.event_time, hours),
    durationHours: hours > 0 ? String(hours) : "",
    theme: sale.event_theme ?? "",
    backdrop: sale.backdrop ?? "",
    packageLabel: label,
    inclusions,
    totalRate: String(total),
    // Only mention the Magnet overtime when this booking actually includes the Magnet add-on.
    magnetOvertime: hasMagnet ? base.magnetOvertime : "",
    representativeName: defaults?.representativeName ?? representativeName,
    agreementDate: new Date().toISOString().slice(0, 10),
  };
}

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "note"; text: string };

/** The agreement's clauses, in order. Text can include **bold** parts. */
export function agreementBlocks(t: AgreementTerms): Block[] {
  const reservation = n(t.reservationFee);
  const balance = Math.max(n(t.totalRate) - reservation, 0);
  const blocks: Block[] = [];
  let number = 0;
  const section = (title: string) => blocks.push({ kind: "heading", text: `${(number += 1)}. ${title}` });
  const paragraph = (text: string) => blocks.push({ kind: "paragraph", text });
  const bullet = (text: string) => blocks.push({ kind: "bullet", text });

  section("Service");
  paragraph(`${t.businessName} ${t.serviceText.trim()}`);

  const included = splitList(t.inclusions);
  if (included.length > 0) {
    section("Package Inclusions");
    paragraph(`**${t.packageLabel || "The package"}** includes:`);
    included.forEach(bullet);
  }

  section("Payment");
  paragraph(`Total Package Rate: **${money(t.totalRate)}**${t.packageLabel ? ` (${t.packageLabel})` : ""}`);
  paragraph("Payment Terms:");
  bullet(`${money(reservation)} reservation fee to confirm the booking`);
  bullet(`Remaining balance${balance > 0 ? ` (${money(balance)})` : ""} must be paid on or before the event day`);
  if (t.includeUnpaidBalanceClause) bullet("Service may not start until the remaining balance has been paid");
  blocks.push({
    kind: "note",
    text: `**Reservation fee is non-refundable** but may be rescheduled once with at least ${t.rescheduleNoticeDays} days notice.`,
  });

  section("Service Time & Pauses");
  paragraph("Photobooth service will start at the agreed service time and will run continuously for the full booked duration.");
  paragraph(
    "If the client or organizer requests a temporary pause due to program activities (speeches, performances, games, etc.), the service time will continue to run.",
  );
  paragraph(
    `A ${t.graceMinutes} minute grace pause may be allowed. If the pause exceeds ${t.pauseLimitMinutes} minutes, an additional ${money(t.extraPauseFee)} fee will be charged on top of the package rate. Idle time does not extend the original service duration.`,
  );
  paragraph(
    `**The photobooth includes unlimited photo sessions during the service period. Guests may use the booth as many times as they wish. However, the package does not include unlimited prints. If additional copies of the same photo are requested, a fee of ${money(t.extraPrintFee)} per extra print will apply. Guests may also return to the booth and take another photo session at no extra charge during the service hours.**`,
  );

  section("Overtime");
  paragraph(
    `Additional time will be charged at ${money(t.overtimeRate)} per hour.${
      n(t.magnetOvertime) > 0
        ? ` If your package includes the Magnet add-on, an additional ${money(t.magnetOvertime)} per hour will apply.`
        : ""
    } Overtime must be paid before the extension.`,
  );

  section("Client Requirements");
  paragraph(`Client agrees to provide: (1) Minimum ${t.spaceNeeded} space, (2) ${t.powerNeeded}, and (3) Safe and accessible area.`);
  if (t.includeSetupClause && n(t.setupMinutes) > 0) {
    bullet(
      `The photobooth will be set up about ${n(t.setupMinutes)} minutes before the service time. The client or venue will allow access to the area at that time so the service can start on schedule.`,
    );
  }
  if (t.includeDamageClause) {
    bullet("The client is responsible for any damage to the photobooth equipment, props or backdrop caused by guests or venue conditions during the event.");
  }
  if (t.includeStaffMeal && n(t.staffMealHours) > 0) {
    bullet(`For events longer than ${n(t.staffMealHours)} hours, the client will provide a meal for the on-site attendant.`);
  }
  if (n(t.travelFee) > 0 && t.travelArea.trim()) {
    bullet(`A travel fee of ${money(t.travelFee)} applies for venues outside ${t.travelArea.trim()}.`);
  }

  if (t.includePhotoUseClause || t.includeGalleryClause) {
    section("Photos & Digital Copies");
    if (t.includePhotoUseClause) {
      paragraph(
        `Photos taken at the booth may be used by ${t.businessName} for its portfolio and social media. If the client does not agree, please tell us in writing before the event date.`,
      );
    }
    if (t.includeGalleryClause && n(t.galleryDays) > 0) {
      paragraph(
        `Digital copies will be shared through an online gallery and stay available for at least ${n(t.galleryDays)} days after the event, so guests should download their copies within that time.`,
      );
    }
  }

  if (t.includePowerClause) {
    section("Power Interruption");
    paragraph("The service provider is **not liable for interruptions due to power outages or venue electrical issues**.");
  }

  if (t.includeForceMajeure) {
    section("Events Beyond Our Control");
    paragraph(
      "Neither party is liable for failure to perform because of events beyond reasonable control, such as severe weather, calamities or government restrictions. In that case the event will be rescheduled to a date both parties agree on.",
    );
  }

  if (t.additionalTerms.trim()) {
    section("Additional Terms");
    for (const line of t.additionalTerms.trim().split(/\n+/)) paragraph(line.trim());
  }

  section("Agreement");
  paragraph("By signing, both parties agree to the terms above.");
  return blocks;
}

/** What the service agreement is saved as when it is stored with a booking. */
export const AGREEMENT_STATUSES = [
  ["draft", "Draft"],
  ["sent", "Sent to client"],
  ["signed", "Signed"],
] as const;

export const agreementStatusLabel = (status: string | null | undefined) =>
  AGREEMENT_STATUSES.find(([key]) => key === status)?.[1] ?? "Draft";

/** Terms worth reusing for every booking (not the client or event details). */
export function defaultsFromTerms(t: AgreementTerms): Partial<AgreementTerms> {
  return {
    businessName: t.businessName,
    serviceText: t.serviceText,
    reservationFee: t.reservationFee,
    rescheduleNoticeDays: t.rescheduleNoticeDays,
    graceMinutes: t.graceMinutes,
    pauseLimitMinutes: t.pauseLimitMinutes,
    extraPauseFee: t.extraPauseFee,
    extraPrintFee: t.extraPrintFee,
    overtimeRate: t.overtimeRate,
    magnetOvertime: t.magnetOvertime || DEFAULT_TERMS.magnetOvertime,
    spaceNeeded: t.spaceNeeded,
    powerNeeded: t.powerNeeded,
    includeSetupClause: t.includeSetupClause,
    setupMinutes: t.setupMinutes,
    includeDamageClause: t.includeDamageClause,
    includePhotoUseClause: t.includePhotoUseClause,
    includeGalleryClause: t.includeGalleryClause,
    galleryDays: t.galleryDays,
    includeForceMajeure: t.includeForceMajeure,
    includeUnpaidBalanceClause: t.includeUnpaidBalanceClause,
    includeStaffMeal: t.includeStaffMeal,
    staffMealHours: t.staffMealHours,
    travelFee: t.travelFee,
    travelArea: t.travelArea,
    includePowerClause: t.includePowerClause,
    additionalTerms: t.additionalTerms,
    includeSignature: t.includeSignature,
    representativeName: t.representativeName,
  };
}

/** The agreement fields that come from the booking, with the names shown when they have changed. */
export const BOOKING_FIELDS: [keyof AgreementTerms, string][] = [
  ["clientName", "client name"],
  ["eventName", "event name"],
  ["eventDate", "event date"],
  ["eventLocation", "location"],
  ["serviceTime", "service time"],
  ["durationHours", "hours of service"],
  ["theme", "theme"],
  ["backdrop", "backdrop"],
  ["packageLabel", "package"],
  ["inclusions", "package inclusions"],
  ["totalRate", "total rate"],
];

/** Which booking details differ between a saved agreement and the booking as it is now. */
export function bookingChanges(fresh: AgreementTerms, saved: Partial<AgreementTerms>): [keyof AgreementTerms, string][] {
  return BOOKING_FIELDS.filter(([key]) => String(fresh[key] ?? "") !== String(saved[key] ?? ""));
}
