import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { faqs } from "../content";

export default defineTool({
  name: "search_faqs",
  title: "Search FAQs",
  description:
    "Search the Recibo Memorato frequently asked questions. Omit the query to get every question and answer.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .nullable()
      .describe("Optional keyword to filter questions and answers. Null or empty returns all FAQs."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ query }) => {
    const q = (query ?? "").toLowerCase();
    const matches = q
      ? faqs.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q))
      : faqs;
    const items = matches.map((f) => ({ question: f.question, answer: f.answer }));
    return {
      content: [
        {
          type: "text" as const,
          text: items.length
            ? items.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
            : "No matching FAQ found.",
        },
      ],
      structuredContent: { faqs: items },
    };
  },
});
