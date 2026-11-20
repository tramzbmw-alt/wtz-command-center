import { callTool } from "./mcpClient";

const TOOL_MAP: Array<{
  keywords: string[];
  tool: string;
  label: string;
  args?: Record<string, unknown>;
  project: "selah" | "weetramz";
}> = [
  // ── Selah House ──────────────────────────────────────────────────────────
  {
    keywords: ["stays", "upcoming", "selah"],
    tool: "selah_get_upcoming_stays",
    label: "Upcoming Stays",
    project: "selah",
  },
  {
    keywords: ["booking", "bookings", "reservations", "reservation"],
    tool: "selah_get_booking_requests",
    label: "Booking Requests",
    project: "selah",
  },
  {
    keywords: ["availability", "available", "calendar"],
    tool: "selah_check_availability",
    label: "Availability",
    project: "selah",
  },
  {
    keywords: ["maintenance"],
    tool: "selah_get_open_maintenance",
    label: "Open Maintenance",
    project: "selah",
  },

  // ── WeeTramz ─────────────────────────────────────────────────────────────
  {
    keywords: ["trip", "trips", "distance", "miles", "how long", "drive time", "duration", "how far", "speed", "route time"],
    tool: "wtz_get_trip_stats",
    label: "WeeTramz Trip Stats",
    project: "weetramz",
  },
  {
    keywords: ["route", "routes", "active route", "schedule", "pickup time", "drop off time"],
    tool: "wtz_get_active_routes",
    label: "Active Routes",
    project: "weetramz",
  },
  {
    keywords: ["shuttle", "airport", "shuttle available", "shuttle booking"],
    tool: "wtz_check_shuttle_availability",
    label: "Shuttle Availability",
    project: "weetramz",
  },
  {
    keywords: ["price", "pricing", "fare", "cost", "rate", "rates", "zone", "hill zone", "how much"],
    tool: "wtz_get_pricing",
    label: "WeeTramz Pricing",
    project: "weetramz",
  },
  {
    keywords: ["quote", "quotes", "quote request", "estimate"],
    tool: "wtz_get_recent_quotes",
    label: "Recent Quotes",
    project: "weetramz",
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
    toCall.map(async ({ tool, label, args }) => {
      const result = await callTool(tool, args ?? {});
      const text = result.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n")
        .trim();
      return { label, text };
    })
  );

  const selahSections = results
    .filter(
      (r, i): r is PromiseFulfilledResult<{ label: string; text: string }> =>
        r.status === "fulfilled" && !!r.value.text && toCall[i].project === "selah"
    )
    .map(({ value }) => `### ${value.label}\n${value.text}`);

  const wtzSections = results
    .filter(
      (r, i): r is PromiseFulfilledResult<{ label: string; text: string }> =>
        r.status === "fulfilled" && !!r.value.text && toCall[i].project === "weetramz"
    )
    .map(({ value }) => `### ${value.label}\n${value.text}`);

  const parts: string[] = [];
  if (selahSections.length > 0) parts.push(`## Live Data from Selah House\n\n${selahSections.join("\n\n")}`);
  if (wtzSections.length > 0) parts.push(`## Live Data from WeeTramz\n\n${wtzSections.join("\n\n")}`);

  return parts.join("\n\n");
}
