import { NextRequest, NextResponse } from "next/server";
import { WTZ_SYNTHESIS_PROMPT } from "@/lib/systemPrompts";

export async function POST(req: NextRequest) {
  const { prompt, claudeResponse, chatgptResponse } = await req.json();

  if (!prompt || !claudeResponse || !chatgptResponse) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const userMessage = `User question: ${prompt}

Claude's response:
${claudeResponse}

ChatGPT's response:
${chatgptResponse}`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: WTZ_SYNTHESIS_PROMPT,
      messages: [{ role: "user", content: userMessage }],
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

  // Extract <takeaways>[...]</takeaways> and the synthesis before it
  const takeawaysMatch = text.match(/<takeaways>([\s\S]*?)<\/takeaways>/);
  let takeaways: string[] = [];
  let synthesis = text;

  if (takeawaysMatch) {
    try {
      takeaways = JSON.parse(takeawaysMatch[1].trim());
    } catch {
      takeaways = [];
    }
    synthesis = text.replace(/<takeaways>[\s\S]*?<\/takeaways>/, "").trim();
  }

  return NextResponse.json({ synthesis, takeaways });
}
