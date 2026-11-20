import { NextResponse } from "next/server";
import { callTool } from "@/lib/mcpClient";

function firstStringArray(val: unknown): string[] | null {
  if (Array.isArray(val)) {
    const strings = val.filter((v) => typeof v === "string") as string[];
    if (strings.length > 0) return strings;
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
  if (/^[\s:[\]{},]+$/.test(t)) return false;
  if (/^[:[{\]},\n]/.test(t)) return false;
  return true;
}

function extractProjects(text: string): string[] {
  const trimmed = text.trim();

  try {
    const parsed = JSON.parse(trimmed);
    const found = firstStringArray(parsed);
    if (found) return found.filter(looksLikeProjectName);
    if (typeof parsed === "string" && looksLikeProjectName(parsed)) return [parsed];
  } catch {
    // not valid JSON as-is
  }

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

  const quoted = [...trimmed.matchAll(/"([^"\\]+)"(?!\s*:)/g)]
    .map((m) => m[1])
    .filter(looksLikeProjectName);
  if (quoted.length > 0) return quoted;

  return trimmed.split("\n").map((s) => s.trim()).filter(looksLikeProjectName);
}

type ProjectStatus = "ok" | "error";

interface ProjectHealth {
  name: string;
  status: ProjectStatus;
}

async function checkProjectHealth(name: string): Promise<ProjectHealth> {
  try {
    const result = await callTool("check_project_health", { project: name });
    const text =
      result?.content
        ?.filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("") ?? "";
    const parsed = JSON.parse(text);
    return { name, status: parsed.status === "ok" ? "ok" : "error" };
  } catch {
    return { name, status: "error" };
  }
}

export async function GET() {
  try {
    const listResult = await callTool("list_projects", {});

    const text =
      listResult?.content
        ?.filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("") ?? "";

    let projectNames: string[] = [];
    if (text) {
      projectNames = extractProjects(text);
    } else if (listResult) {
      const found = firstStringArray(listResult);
      if (found) projectNames = found.filter(Boolean);
    }

    if (projectNames.length === 0) {
      return NextResponse.json({ status: "degraded", projects: [] });
    }

    const projects = await Promise.all(projectNames.map(checkProjectHealth));

    const anyError = projects.some((p) => p.status === "error");
    const status = anyError ? "degraded" : "ok";

    return NextResponse.json({ status, projects });
  } catch {
    return NextResponse.json({ status: "down", projects: [] });
  }
}
