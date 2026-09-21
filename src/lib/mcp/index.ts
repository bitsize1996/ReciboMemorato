import { defineMcp } from "@lovable.dev/mcp-js";
import listServices from "./tools/list-services";
import searchFaqs from "./tools/search-faqs";
import getBookingInfo from "./tools/get-booking-info";

export default defineMcp({
  name: "memory-proof-studio",
  title: "Memory Proof Studio",
  version: "0.1.0",
  instructions:
    "Public information tools for Recibo Memorato by The Bitsize Sibs, a receipt-style photobooth and keepsake printing studio. Use `list_services` for the service lineup, `search_faqs` for common questions, and `get_booking_info` for how to book and the contact link.",
  tools: [listServices, searchFaqs, getBookingInfo],
});
