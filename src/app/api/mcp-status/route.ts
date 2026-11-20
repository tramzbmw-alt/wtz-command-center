import { NextResponse } from "next/server";
import { callTool } from "@/lib/mcpClient";

function firstStringArray(val: unknown): string[] | null {
  if (Array.isArray(val)) {
    const strings = val.filter((v) => typeof v === "string") as string[];
    if (strings.length > 0) return strings;
    // array of objects — recurse into each
    for (const item of val) {
      const found = firstStringArray(item);
      if (found) return found;
    }
  }
  if (val && typeof val === "object") {
    for (const v of Object.values(val as Record<string, unknown>)) {
      const found = firstStringArray(v);
      if (found) return found;
    }
  }
  return null;
}

function extractProjects(text: string): string[] {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    const found = firstStringArray(parsed);
    if (found) return found.filter(Boolean);
    // parsed but no string arrays — treat as a single name if it's a plain string
    if (typeof parsed === "string" && parsed) return [parsed];
    // JSON parsed with no usable data — fall through to regex
  } catch {
    // not JSON
  }
  // extract quoted string values only — negative lookahead skips JSON keys ("key":)
  const quoted = [...trimmed.matchAll(/"([^"\\]+)"(?!\s*:)/g)].map((m) => m[1]);
  if (quoted.length > 0) return quoted.filter(Boolean);
  // plain text fallback: split on newlines
  return trimmed.split("\n").map((s) => s.trim()).filter(Boolean);
}

export async function GET() {
  try {
    const result = await callTool("list_projects", {});

    // Join all text content items — handles chunked/streaming MCP responses
    const text =
      result?.content
        ?.filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("") ?? "";

    let projects: string[] = [];
    if (text) {
      projects = extractProjects(text);
    } else if (result) {
      // No content[].text — try walking the result object directly
      const found = firstStringArray(result);
      if (found) projects = found.filter(Boolean);
    }

    const status = projects.length > 0 ? "ok" : "degraded";
    return NextResponse.json({ status, projects });
  } catch {
    return NextResponse.json({ status: "down", projects: [] });
  }
}
