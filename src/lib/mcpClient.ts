const MCP_URL = "https://wtz-mcp.vercel.app/api/mcp";

export interface McpContent {
  type: string;
  text?: string;
}

export interface McpResult {
  content?: McpContent[];
  [key: string]: unknown;
}

async function parseSseStream(res: Response): Promise<McpResult> {
  const raw = await res.text();
  // Collect content chunks from every result event — the stream may be chunked
  const allContent: McpContent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const json = JSON.parse(line.slice(6));
      const chunks = json.result?.content;
      if (Array.isArray(chunks)) allContent.push(...chunks);
    } catch {
      // skip malformed SSE lines
    }
  }
  if (allContent.length > 0) return { content: allContent };
  throw new Error("No result found in SSE stream");
}

export async function callTool(
  name: string,
  params: Record<string, unknown> = {}
): Promise<McpResult> {
  const token = process.env.WTZ_MCP_TOKEN;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: params },
    }),
  });

  if (!res.ok) {
    throw new Error(`MCP ${res.status}`);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    return parseSseStream(res);
  }

  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "MCP error");
  return json.result as McpResult;
}
