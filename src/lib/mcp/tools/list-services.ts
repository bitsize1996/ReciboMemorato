import { defineTool } from "@lovable.dev/mcp-js";
import { services } from "../content";

export default defineTool({
  name: "list_services",
  title: "List services",
  description:
    "List the photobooth and printing services Recibo Memorato offers, with a tagline and description for each.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const items = services.map((s) => ({
      number: s.number,
      title: s.title,
      tagline: s.tagline,
      description: s.body,
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: items.map((s) => `${s.number}. ${s.title} — ${s.tagline}\n${s.description}`).join("\n\n"),
        },
      ],
      structuredContent: { services: items },
    };
  },
});
