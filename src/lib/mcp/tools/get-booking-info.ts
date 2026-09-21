import { defineTool } from "@lovable.dev/mcp-js";
import { brand } from "../content";

export default defineTool({
  name: "get_booking_info",
  title: "Get booking info",
  description:
    "Explain how to book Recibo Memorato and return the public contact link used for inquiries.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const info = {
      brand: brand.name,
      by: brand.by,
      tagline: brand.tagline,
      howToBook:
        "Send a message with your event details (date, location, and the setup you're interested in). You'll get a confirmation and be guided through the next steps.",
      contactLabel: brand.contactLabel,
      contactUrl: brand.contactUrl,
      pricing: "Pricing is shared on request — no public price list yet.",
    };
    return {
      content: [
        {
          type: "text" as const,
          text: `${info.brand} by ${info.by} — ${info.tagline}\n\n${info.howToBook}\n\nContact (${info.contactLabel}): ${info.contactUrl}\n${info.pricing}`,
        },
      ],
      structuredContent: { booking: info },
    };
  },
});
