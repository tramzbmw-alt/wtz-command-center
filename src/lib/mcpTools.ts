import { callTool } from "./mcpClient";

const TOOL_MAP: Array<{
  keywords: string[];
  tool: string;
  label: string;
}> = [
  {
    keywords: ["stays", "upcoming", "selah"],
    tool: "selah_get_upcoming_stays",
    label: "Upcoming Stays",
  },
  {
    keywords: ["booking", "bookings", "reservations", "reservation"],
    tool: "selah_get_booking_requests",
    label: "Booking Requests",
  },
  {
    keywords: ["availability", "available", "calendar"],
    tool: "selah_check_availability",
    label: "Availability",
  },
  {
    keywords: ["maintenance"],
    tool: "selah_get_open_maintenance",
    label: "Open Maintenance",
  },
];

export async function fetchMcpContext(prompt: string): Promise<string> {
  if (!process.env.MCP_SERVER_URL || !process.env.WTZ_MCP_TOKEN) return "";

  const lower = prompt.toLowerCase();
  const toCall = TOOL_MAP.filter(({ keywords }) =>
    keywords.some((kw) => lower.includes(kw))
  );

  if (toCall.length === 0) return "";

  const results = await Promise.allSettled(
    toCall.map(async ({ tool, label }) => {
      const result = await callTool(tool);
      const text = result.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n")
        .trim();
      return { label, text };
    })
  );

  const sections = results
    .filter(
      (r): r is PromiseFulfilledResult<{ label: string; text: string }> =>
        r.status === "fulfilled" && !!r.value.text
    )
    .map(({ value }) => `### ${value.label}\n${value.text}`);

  if (sections.length === 0) return "";

  return `## Live Data from Selah House\n\n${sections.join("\n\n")}`;
}
