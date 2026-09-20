import { useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "assistant" | "tool" | "system" | "error";
type Msg = { id: string; role: Role; text: string };

const uid = () => Math.random().toString(36).slice(2);

export default function App() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: uid(),
      role: "assistant",
      text: "Hi! Describe the UI you want and I'll build it live. Try: “Create a landing page for a coffee shop with a hero and a menu grid.”",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [prState, setPrState] = useState<"idle" | "working" | "done">("idle");
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages]);

  const append = (m: Msg) => setMessages((prev) => [...prev, m]);
  const patchLast = (role: Role, fn: (t: string) => string) =>
    setMessages((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === role) {
          copy[i] = { ...copy[i], text: fn(copy[i].text) };
          break;
        }
      }
      return copy;
    });

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    append({ id: uid(), role: "user", text });
    const assistantId = uid();
    append({ id: assistantId, role: "assistant", text: "" });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: any;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === "text") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, text: m.text + evt.text } : m
              )
            );
          } else if (evt.type === "tool") {
            append({ id: uid(), role: "tool", text: `🔧 ${evt.text}` });
          } else if (evt.type === "error") {
            append({ id: uid(), role: "error", text: `⚠️ ${evt.text}` });
          }
        }
      }
    } catch (e: any) {
      append({ id: uid(), role: "error", text: `⚠️ ${e.message}` });
    } finally {
      setBusy(false);
      // Nudge the preview to reflect the latest generated code.
      setPreviewNonce((n) => n + 1);
    }
  }, [input, busy]);

  const raisePr = useCallback(async () => {
    const title = window.prompt(
      "Pull request title:",
      "Add UI changes from Agentic UI Builder"
    );
    if (!title) return;
    setPrState("working");
    setPrUrl(null);
    try {
      const res = await fetch("/api/pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      setPrUrl(data.url);
      setPrState("done");
      append({
        id: uid(),
        role: "system",
        text: data.created
          ? `✅ Opened PR: ${data.url}`
          : `✅ Updated PR (${data.branch}): ${data.url}`,
      });
    } catch (e: any) {
      append({ id: uid(), role: "error", text: `⚠️ PR failed: ${e.message}` });
      setPrState("idle");
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-900">
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧱</span>
          <h1 className="font-semibold">Agentic UI Builder</h1>
        </div>
        <div className="flex items-center gap-3">
          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-emerald-600 hover:underline"
            >
              View PR ↗
            </a>
          )}
          <button
            onClick={raisePr}
            disabled={prState === "working"}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {prState === "working"
              ? "Working…"
              : prState === "done"
              ? "Update PR"
              : "Raise PR"}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Chat */}
        <section className="w-[420px] flex flex-col border-r border-slate-200 bg-white">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.text} />
            ))}
            {busy && (
              <div className="text-xs text-slate-400 px-1">thinking…</div>
            )}
          </div>
          <div className="p-3 border-t border-slate-200">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Describe a change…  (Enter to send)"
                rows={2}
                className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </section>

        {/* Live preview */}
        <section className="flex-1 flex flex-col min-w-0 bg-slate-50">
          <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-200 bg-white flex items-center justify-between">
            <span>Live preview · src/generated/App.tsx</span>
            <button
              onClick={() => setPreviewNonce((n) => n + 1)}
              className="hover:text-slate-800"
            >
              ⟳ refresh
            </button>
          </div>
          <iframe
            key={previewNonce}
            src="/preview.html"
            title="preview"
            className="flex-1 w-full bg-white"
          />
        </section>
      </div>
    </div>
  );
}

function Bubble({ role, text }: { role: Role; text: string }) {
  if (role === "user")
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 text-white px-3 py-2 text-sm whitespace-pre-wrap">
          {text}
        </div>
      </div>
    );
  if (role === "tool")
    return (
      <div className="text-xs text-slate-500 font-mono px-1">{text}</div>
    );
  if (role === "error")
    return (
      <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
        {text}
      </div>
    );
  if (role === "system")
    return (
      <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 break-all">
        {text}
      </div>
    );
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 text-slate-800 px-3 py-2 text-sm whitespace-pre-wrap">
        {text || "…"}
      </div>
    </div>
  );
}
