import { NextRequest, NextResponse } from "next/server";
import { WTZ_SYSTEM_PROMPT } from "@/lib/systemPrompts";

export async function POST(req: NextRequest) {
  const { prompt, systemPrompt } = await req.json();

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured — replace the placeholder in .env.local" },
      { status: 500 }
    );
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: systemPrompt ?? WTZ_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: errBody?.error?.message ?? `Anthropic API error ${anthropicRes.status}` },
      { status: anthropicRes.status }
    );
  }

  const data = await anthropicRes.json();
  const text: string = data.content?.[0]?.text ?? "";

  return NextResponse.json({ text, usage: data.usage });
}
