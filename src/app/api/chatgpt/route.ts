import { NextRequest, NextResponse } from "next/server";
import { WTZ_SYSTEM_PROMPT } from "@/lib/systemPrompts";
import { fetchMcpContext } from "@/lib/mcpTools";

export async function POST(req: NextRequest) {
  const { prompt, systemPrompt } = await req.json();

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const mcpContext = await fetchMcpContext(prompt);
  const baseSystem = systemPrompt ?? WTZ_SYSTEM_PROMPT;
  const finalSystem = mcpContext ? baseSystem + "\n\n" + mcpContext : baseSystem;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        { role: "system", content: finalSystem },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!openaiRes.ok) {
    const errBody = await openaiRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: errBody?.error?.message ?? `OpenAI API error ${openaiRes.status}` },
      { status: openaiRes.status }
    );
  }

  const data = await openaiRes.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";

  return NextResponse.json({
    text,
    usage: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0,
    },
  });
}
