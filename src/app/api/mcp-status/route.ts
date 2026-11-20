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
    const text = result?.content?.[0]?.text ?? "";
    const projects = text ? extractProjects(text) : [];
    const status = projects.length > 0 ? "ok" : "degraded";
    return NextResponse.json({ status, projects });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("401") || msg.includes("403") ? "down" : "down";
    return NextResponse.json({ status, projects: [] });
  }
}
