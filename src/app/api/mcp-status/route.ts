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

function looksLikeProjectName(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  // reject JSON structural fragments like ": [", "  ]", etc.
  if (/^[\s:[\]{},]+$/.test(t)) return false;
  if (/^[:[{\]},\n]/.test(t)) return false;
  return true;
}

function extractProjects(text: string): string[] {
  const trimmed = text.trim();

  // Try parsing the full text as JSON first
  try {
    const parsed = JSON.parse(trimmed);
    const found = firstStringArray(parsed);
    if (found) return found.filter(looksLikeProjectName);
    if (typeof parsed === "string" && looksLikeProjectName(parsed)) return [parsed];
  } catch {
    // not valid JSON as-is
  }

  // If the text has a JSON prefix garbage, try starting from the first { or [
  const jsonStart = trimmed.search(/[{[]/);
  if (jsonStart > 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart));
      const found = firstStringArray(parsed);
      if (found) return found.filter(looksLikeProjectName);
    } catch {
      // still not valid
    }
  }

  // Extract quoted string values — skip JSON keys (followed by :)
  const quoted = [...trimmed.matchAll(/"([^"\\]+)"(?!\s*:)/g)]
    .map((m) => m[1])
    .filter(looksLikeProjectName);
  if (quoted.length > 0) return quoted;

  // Plain text fallback: split on newlines
  return trimmed.split("\n").map((s) => s.trim()).filter(looksLikeProjectName);
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
