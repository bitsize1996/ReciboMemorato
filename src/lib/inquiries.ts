import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const INQUIRY_STATUSES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["quoted", "Quoted"],
  ["booked", "Booked"],
  ["completed", "Completed"],
  ["lost", "Lost"],
] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number][0];

export const INQUIRY_SOURCES = [
  ["website", "Website form"],
  ["messenger", "Messenger"],
  ["phone", "Phone / text"],
  ["referral", "Referral"],
  ["walk_in", "Walk-in"],
  ["other", "Other"],
] as const;

export const statusName = (status: string) =>
  INQUIRY_STATUSES.find(([key]) => key === status)?.[1] ?? status;
export const sourceName = (source: string) =>
  INQUIRY_SOURCES.find(([key]) => key === source)?.[1] ?? source;
export const inquiryCode = (num: number) => `INQ-${String(num).padStart(4, "0")}`;

export interface InquiryRow {
  id: string;
  inquiry_number: number;
  name: string;
  contact: string | null;
  email: string | null;
  contact_method: string;
  event_type: string | null;
  theme: string | null;
  backdrop: string | null;
  event_time: string | null;
  service_hours: number | null;
  event_date: string | null;
  venue: string | null;
  guests: number | null;
  package_id: string | null;
  package_interest: string | null;
  message: string | null;
  source: string;
  status: InquiryStatus;
  quoted_amount: number | null;
  internal_notes: string | null;
  sale_id: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

/** All inquiries (admin only — the database refuses everyone else). */
export function useInquiries() {
  return useQuery({
    queryKey: ["biz", "inquiries"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InquiryRow[];
    },
  });
}
