"use client";

import { useState } from "react";

function NavIcon({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="nav-icon"
      aria-hidden="true"
    >
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  );
}

function PillIcon({ d }: { d: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2h7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM2 5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8v-1.5H2.5V6H2z" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.5 1.5h4v1.5H3.56L6 5.44 4.94 6.5 2.5 4.06V6H1V1.5h.5zm12 0H9v1.5h1.94L8.5 5.44l1.06 1.06 2.44-2.44V6H13.5V1.5h-.5zM1.5 14.5H6V13H4.06l2.44-2.44-1.06-1.06L3 11.94V10H1.5v4.5zm12 0H9V13h1.94l-2.44-2.44 1.06-1.06 2.44 2.44V10H15.5v4.5z" />
    </svg>
  );
}

type Mode = "claude" | "chatgpt" | "compare";

type ResponseState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string; inputTokens: number; outputTokens: number };

const IDLE: ResponseState = { status: "idle" };

function renderMarkdown(text: string): string {
  return (
    text
      // Escape HTML entities first so raw user content can't inject tags
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Bold: **text**
      .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
      // Italic: *text*
      .replace(/\*([^*\n]+?)\*/g, "<em>$1</em>")
      // Inline code: `code`
      .replace(/`([^`\n]+?)`/g, "<code>$1</code>")
      // Double newline → paragraph gap
      .replace(/\n\n/g, "<br><br>")
      // Single newline → line break
      .replace(/\n/g, "<br>")
  );
}

function cardBodyClass(r: ResponseState) {
  if (r.status === "loading") return "response-body loading";
  if (r.status === "done") return "response-body has-content";
  return "response-body placeholder";
}

function cardBodyText(r: ResponseState, placeholder: string) {
  if (r.status === "loading") return "Thinking…";
  if (r.status === "done") return r.text;
  return placeholder;
}

function tokenLabel(r: ResponseState) {
  if (r.status === "done")
    return `${r.inputTokens} in · ${r.outputTokens} out tokens`;
  return "— tokens";
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("claude");
  const [claudeRes, setClaudeRes] = useState<ResponseState>(IDLE);
  const [chatgptRes, setChatgptRes] = useState<ResponseState>(IDLE);
  const [copiedClaude, setCopiedClaude] = useState(false);
  const [copiedChatgpt, setCopiedChatgpt] = useState(false);

  const isLoading =
    claudeRes.status === "loading" || chatgptRes.status === "loading";

  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    setClaudeRes(IDLE);
    setChatgptRes(IDLE);
  }

  async function fetchClaude(p: string): Promise<ResponseState> {
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      return {
        status: "done",
        text: data.text,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      };
    } catch (e) {
      return {
        status: "done",
        text: `Error: ${(e as Error).message}`,
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }

  async function fetchChatGPT(p: string): Promise<ResponseState> {
    try {
      const res = await fetch("/api/chatgpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      return {
        status: "done",
        text: data.text,
        inputTokens: data.usage?.input ?? 0,
        outputTokens: data.usage?.output ?? 0,
      };
    } catch (e) {
      return {
        status: "done",
        text: `Error: ${(e as Error).message}`,
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }

  async function handleAsk() {
    if (!prompt.trim() || isLoading) return;

    if (mode === "claude") {
      setClaudeRes({ status: "loading" });
      setClaudeRes(await fetchClaude(prompt));
    } else if (mode === "chatgpt") {
      setChatgptRes({ status: "loading" });
      setChatgptRes(await fetchChatGPT(prompt));
    } else {
      // compare — fire both in parallel
      setClaudeRes({ status: "loading" });
      setChatgptRes({ status: "loading" });
      const [c, g] = await Promise.all([
        fetchClaude(prompt),
        fetchChatGPT(prompt),
      ]);
      setClaudeRes(c);
      setChatgptRes(g);
    }
  }

  async function copyText(text: string, setter: (v: boolean) => void) {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 1800);
  }

  const btnText = isLoading
    ? "Asking…"
    : mode === "claude"
    ? "Ask Claude"
    : mode === "chatgpt"
    ? "Ask ChatGPT"
    : "Ask Both";

  const showClaude = mode === "claude" || mode === "compare";
  const showChatgpt = mode === "chatgpt" || mode === "compare";

  return (
    <div className="dashboard">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">
            <span className="logo-wtz">WTz</span>
            <span className="logo-rest"> AI Command Center</span>
          </div>
          <div className="sidebar-logo-accent" />
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>
          <div className="nav-item active" role="menuitem" aria-current="page">
            <NavIcon d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            Ask AI
          </div>
          <div className="nav-item" role="menuitem">
            <NavIcon d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z" />
            Compare Answers
          </div>
          <div className="nav-item" role="menuitem">
            <NavIcon d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            Collaborate Fusion
          </div>

          <div className="nav-section-label">Library</div>
          <div className="nav-item" role="menuitem">
            <NavIcon d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            Projects
          </div>
          <div className="nav-item" role="menuitem">
            <NavIcon d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
            Saved
          </div>
          <div className="nav-item" role="menuitem">
            <NavIcon d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            History
          </div>
          <div className="nav-item" role="menuitem">
            <NavIcon d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 0 0 1.423 1.423L19.5 18.75l-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            Prompts
          </div>

          <div className="nav-section-label">System</div>
          <div className="nav-item" role="menuitem">
            <NavIcon d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            Connectors
            <span
              className="status-dot green"
              style={{ marginLeft: "auto" }}
              title="Connected"
            />
          </div>
          <div className="nav-item" role="menuitem">
            <NavIcon d="M9.594 3.89c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456A1.125 1.125 0 0 1 2.95 18.44l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827A1.125 1.125 0 0 1 1.653 9.4l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            Settings
          </div>
        </nav>

        {/* Connected Models panel */}
        <div className="models-panel">
          <div className="models-panel-title">Connected Models</div>
          <div className="models-card">
            <div className="model-row">
              <div className="model-circle claude-circle">C</div>
              <div className="model-info">
                <div className="model-name">Claude</div>
                <div className="model-provider">Anthropic</div>
              </div>
              <svg
                className="model-check"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label="Connected"
              >
                <path d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="model-row">
              <div className="model-circle chatgpt-circle">{"G"}</div>
              <div className="model-info">
                <div className="model-name">ChatGPT</div>
                <div className="model-provider">OpenAI</div>
              </div>
              <svg
                className="model-check"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label="Connected"
              >
                <path d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div>
            <div className="topbar-title">Ask, Compare, or Collaborate</div>
            <div className="topbar-sub">
              Route your prompt to the right AI — or all of them
            </div>
          </div>
          <div className="avatar" title="Travis R.">
            TR
          </div>
        </header>

        {/* Scrollable area */}
        <div className="content-scroll">
          {/* Prompt card */}
          <div className="prompt-card">
            <textarea
              className="prompt-textarea"
              placeholder="Ask anything… choose a mode below, then hit the button."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAsk();
              }}
              rows={4}
            />
            <div className="prompt-footer">
              <button
                className="btn-primary"
                onClick={handleAsk}
                disabled={!prompt.trim() || isLoading}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1.5 2l13 6-13 6V9.5L11 8 1.5 6.5V2z" />
                </svg>
                {btnText}
              </button>
            </div>
          </div>

          {/* Response Mode selector */}
          <div>
            <div className="section-heading">Response Mode</div>
            <div className="mode-selector">
              <button
                className={`mode-pill${mode === "chatgpt" ? " active" : ""}`}
                onClick={() => switchMode("chatgpt")}
              >
                <PillIcon d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                ChatGPT Only
              </button>
              <button
                className={`mode-pill${mode === "claude" ? " active" : ""}`}
                onClick={() => switchMode("claude")}
              >
                <PillIcon d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                Claude Only
              </button>
              <button
                className="mode-pill disabled"
                disabled
                title="Coming soon"
              >
                <PillIcon d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                Collaborate Both
              </button>
              <button
                className={`mode-pill${mode === "compare" ? " active" : ""}`}
                onClick={() => switchMode("compare")}
              >
                <PillIcon d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" />
                Compare Side-by-Side
              </button>
            </div>
          </div>

          {/* AI Responses */}
          <div>
            <div className="section-heading">AI Responses</div>
            <div className={`responses-grid${mode === "compare" ? " compare" : ""}`}>

              {/* Claude card */}
              {showClaude && (
                <div className="response-card">
                  <div className="response-card-header">
                    <div className="response-card-left">
                      <div className="response-badge claude">C</div>
                      <div>
                        <div className="response-model-name">Claude</div>
                        <div className="response-model-version">Sonnet 4.5 · Anthropic</div>
                      </div>
                    </div>
                    <div className="response-card-actions">
                      <button
                        className="icon-btn"
                        title="Copy response"
                        onClick={() =>
                          claudeRes.status === "done" &&
                          copyText(claudeRes.text, setCopiedClaude)
                        }
                      >
                        <CopyIcon />
                      </button>
                      <button className="icon-btn" title="Expand">
                        <ExpandIcon />
                      </button>
                    </div>
                  </div>
                  <div
                    id="claude-body"
                    className={cardBodyClass(claudeRes)}
                    {...(claudeRes.status === "done"
                      ? { dangerouslySetInnerHTML: { __html: renderMarkdown(claudeRes.text) } }
                      : { children: cardBodyText(claudeRes, "Your Claude response will appear here.") }
                    )}
                  />
                  <div className="response-footer">
                    <span className="token-count">{tokenLabel(claudeRes)}</span>
                    <button
                      className="btn-copy"
                      onClick={() =>
                        claudeRes.status === "done" &&
                        copyText(claudeRes.text, setCopiedClaude)
                      }
                    >
                      <CopyIcon size={12} />
                      {copiedClaude ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {/* ChatGPT card */}
              {showChatgpt && (
                <div className="response-card">
                  <div className="response-card-header">
                    <div className="response-card-left">
                      <div className="response-badge chatgpt">G</div>
                      <div>
                        <div className="response-model-name">ChatGPT</div>
                        <div className="response-model-version">GPT-4o · OpenAI</div>
                      </div>
                    </div>
                    <div className="response-card-actions">
                      <button
                        className="icon-btn"
                        title="Copy response"
                        onClick={() =>
                          chatgptRes.status === "done" &&
                          copyText(chatgptRes.text, setCopiedChatgpt)
                        }
                      >
                        <CopyIcon />
                      </button>
                      <button className="icon-btn" title="Expand">
                        <ExpandIcon />
                      </button>
                    </div>
                  </div>
                  <div
                    id="chatgpt-body"
                    className={cardBodyClass(chatgptRes)}
                    {...(chatgptRes.status === "done"
                      ? { dangerouslySetInnerHTML: { __html: renderMarkdown(chatgptRes.text) } }
                      : { children: cardBodyText(chatgptRes, "Your ChatGPT response will appear here.") }
                    )}
                  />
                  <div className="response-footer">
                    <span className="token-count">{tokenLabel(chatgptRes)}</span>
                    <button
                      className="btn-copy"
                      onClick={() =>
                        chatgptRes.status === "done" &&
                        copyText(chatgptRes.text, setCopiedChatgpt)
                      }
                    >
                      <CopyIcon size={12} />
                      {copiedChatgpt ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Collaborated Answer — hidden for now */}
        </div>
      </div>
    </div>
  );
}
