"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { StarMark } from "@/components/Logo";

type Source = { url: string; title: string };
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  device?: string;
  streaming?: boolean;
};
type ConvoSummary = { id: string; title: string; updatedAt: number };

const SPACE_KEY = "antares.space";
const POLL_MS = 1500;

function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/iPhone|Android.*Mobile/i.test(ua)) return "Phone";
  if (/CrOS|Tesla|Android Automotive/i.test(ua)) return "Vehicle";
  return "Computer";
}

function readSpace(): string | null {
  try {
    return localStorage.getItem(SPACE_KEY);
  } catch {
    return null;
  }
}

function saveSpace(id: string) {
  try {
    localStorage.setItem(SPACE_KEY, id);
  } catch {
    /* private mode: space lives for this tab only */
  }
}

export default function ChatApp() {
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [convos, setConvos] = useState<ConvoSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [research, setResearch] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [device, setDevice] = useState("Computer");
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  // Join or create the user's sync space. A ?link=CODE in the URL joins an existing one.
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("link");
      if (code) {
        const res = await fetch(`/api/link?code=${encodeURIComponent(code)}`);
        if (res.ok) {
          const { spaceId } = await res.json();
          saveSpace(spaceId);
        }
        window.history.replaceState(null, "", "/chat");
      }
      let id = readSpace();
      if (id) {
        const check = await fetch(`/api/space?space=${id}`).then((r) => r.json());
        setLive(check.live);
        if (!check.exists) id = null;
      }
      if (!id) {
        const created = await fetch("/api/space", { method: "POST" }).then((r) => r.json());
        id = created.spaceId as string;
        saveSpace(id);
      }
      setDevice(detectDevice());
      setSpaceId(id);
    })();
  }, []);

  const refreshConvos = useCallback(async () => {
    if (!spaceId) return;
    const res = await fetch(`/api/conversations?space=${spaceId}`);
    if (!res.ok) return;
    const { conversations } = await res.json();
    setConvos(conversations);
    // Follow the most recently active conversation, which is how a handoff lands on this device.
    setActiveId((cur) => cur ?? conversations[0]?.id ?? null);
  }, [spaceId]);

  const refreshActive = useCallback(async () => {
    if (!spaceId || !activeId || sendingRef.current) return;
    const res = await fetch(`/api/conversations/${activeId}?space=${spaceId}`);
    if (!res.ok) return;
    const { conversation } = await res.json();
    if (!sendingRef.current) setMessages(conversation.messages);
  }, [spaceId, activeId]);

  useEffect(() => {
    const tick = () => {
      refreshConvos();
      refreshActive();
    };
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refreshConvos, refreshActive]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function newConversation() {
    if (!spaceId) return null;
    const { conversation } = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId }),
    }).then((r) => r.json());
    setActiveId(conversation.id);
    setMessages([]);
    setSidebarOpen(false);
    await refreshConvos();
    return conversation.id as string;
  }

  async function deleteConversation(id: string) {
    if (!spaceId) return;
    await fetch(`/api/conversations/${id}?space=${spaceId}`, { method: "DELETE" });
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
    }
    refreshConvos();
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || !spaceId) return;
    const convoId = activeId ?? (await newConversation());
    if (!convoId) return;

    setInput("");
    setSending(true);
    sendingRef.current = true;
    setStatus(research ? "Researching…" : "Thinking…");
    const pendingId = `pending-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: "user", text, device },
      { id: pendingId, role: "assistant", text: "", sources: [], streaming: true },
    ]);

    const patchReply = (fn: (m: Message) => Message) =>
      setMessages((all) => all.map((m) => (m.id === pendingId ? fn(m) : m)));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId,
          conversationId: convoId,
          text,
          mode: research ? "research" : "chat",
          device,
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") {
            setStatus(null);
            patchReply((m) => ({ ...m, text: m.text + ev.text }));
          } else if (ev.type === "status") {
            setStatus(ev.text);
          } else if (ev.type === "source") {
            patchReply((m) => ({ ...m, sources: [...(m.sources ?? []), ev.source] }));
          } else if (ev.type === "error") {
            patchReply((m) => ({ ...m, text: `${m.text}\n\n_${ev.message}_` }));
          }
        }
      }
    } catch {
      patchReply((m) => ({ ...m, text: m.text || "_Couldn't reach Antares. Please try again._" }));
    } finally {
      patchReply((m) => ({ ...m, streaming: false }));
      setStatus(null);
      setSending(false);
      sendingRef.current = false;
      refreshConvos();
    }
  }

  const otherDeviceStreaming = !sending && messages.some((m) => m.streaming);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-border bg-surface transition-transform md:static md:translate-x-0`}
      >
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <StarMark className="h-6 w-6" /> Antares
          </Link>
          <button className="text-muted md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            ✕
          </button>
        </div>
        <div className="px-3">
          <button
            onClick={newConversation}
            className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-surface-2"
          >
            + New conversation
          </button>
        </div>
        <nav className="mt-3 flex-1 overflow-y-auto px-3">
          {convos.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center rounded-lg ${c.id === activeId ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
            >
              <button
                onClick={() => {
                  setActiveId(c.id);
                  setMessages([]);
                  setSidebarOpen(false);
                }}
                className="flex-1 truncate px-3 py-2 text-left text-sm"
              >
                {c.title}
              </button>
              <button
                onClick={() => deleteConversation(c.id)}
                className="px-2 text-muted opacity-0 hover:text-antares group-hover:opacity-100"
                aria-label="Delete conversation"
              >
                ✕
              </button>
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <button
            onClick={() => setLinkOpen(true)}
            className="w-full rounded-xl bg-surface-2 px-3 py-2 text-sm hover:brightness-125"
          >
            🔗 Link another device
          </button>
          <p className="mt-2 px-1 text-xs text-muted">This device: {device}</p>
        </div>
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button className="md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <span className="truncate text-sm text-muted">
            {convos.find((c) => c.id === activeId)?.title ?? "Antares A.I Capella"}
          </span>
          {!live && (
            <span className="ml-auto shrink-0 rounded-full border border-capella/40 px-2 py-0.5 text-xs text-capella">
              Demo mode
            </span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {messages.length === 0 && (
              <div className="mt-16 text-center">
                <StarMark className="mx-auto h-14 w-14" />
                <h1 className="mt-4 text-2xl font-semibold">How can Antares help?</h1>
                <div className="mx-auto mt-8 grid max-w-xl gap-2 sm:grid-cols-2">
                  {[
                    "What's the evidence that intermittent fasting works?",
                    "Calculate the monthly payment on a $350k loan at 6.5% over 30 years",
                    "Write a Python script that renames photos by date taken",
                    "Edit this paragraph to sound more confident",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-xl border border-border bg-surface p-3 text-left text-sm text-muted hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="my-4 flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-surface-2 px-4 py-2.5">
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.device && m.device !== device && (
                      <p className="mt-1 text-right text-xs text-muted">from {m.device}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="my-5 flex gap-3">
                  <StarMark className="mt-1 h-6 w-6 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="prose-antares">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    </div>
                    {m.streaming && !m.text && (
                      <p className="animate-pulse text-sm text-muted">{status ?? "Antares is answering…"}</p>
                    )}
                    {!!m.sources?.length && (
                      <div className="mt-3">
                        <p className="text-xs uppercase tracking-wider text-muted">Sources</p>
                        <ol className="mt-1 flex flex-wrap gap-2">
                          {m.sources.slice(0, 12).map((s, i) => (
                            <li key={s.url}>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                title={s.url}
                                className="flex max-w-64 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs hover:border-capella"
                              >
                                <span className="text-capella">{i + 1}</span>
                                <span className="truncate">{s.title || new URL(s.url).hostname}</span>
                              </a>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {status && messages.at(-1)?.text && <p className="animate-pulse text-sm text-muted">{status}</p>}
            {otherDeviceStreaming && (
              <p className="text-xs text-capella">Continuing live from another device…</p>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-border bg-background px-4 pb-4 pt-3">
          <form
            className="mx-auto max-w-3xl"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div className="rounded-2xl border border-border bg-surface focus-within:border-capella/60">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Ask Antares anything…"
                className="max-h-48 w-full resize-none bg-transparent px-4 pt-3 outline-none placeholder:text-muted"
              />
              <div className="flex items-center justify-between px-3 pb-2">
                <button
                  type="button"
                  onClick={() => setResearch((r) => !r)}
                  className={`rounded-full border px-3 py-1 text-xs ${research ? "border-capella bg-capella/15 text-capella" : "border-border text-muted"}`}
                  aria-pressed={research}
                >
                  🔭 Deep research {research ? "on" : "off"}
                </button>
                <button
                  type="submit"
                  disabled={sending || !spaceId || !input.trim()}
                  className="rounded-full bg-capella px-4 py-1.5 text-sm font-medium text-background disabled:opacity-40"
                >
                  {sending ? "…" : "Send"}
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted">
              Antares can make mistakes. Check important facts against the cited sources.
            </p>
          </form>
        </div>
      </main>

      {linkOpen && spaceId && <LinkDialog spaceId={spaceId} onClose={() => setLinkOpen(false)} />}
    </div>
  );
}

function LinkDialog({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId }),
    })
      .then((r) => r.json())
      .then((d) => setCode(d.code));
  }, [spaceId]);

  const url = code ? `${window.location.origin}/chat?link=${code}` : "";

  async function join() {
    const res = await fetch(`/api/link?code=${encodeURIComponent(joinCode.trim())}`);
    if (!res.ok) return setError("That code has expired or doesn't exist.");
    const { spaceId: joined } = await res.json();
    saveSpace(joined);
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Link another device</h2>
        <p className="mt-1 text-sm text-muted">
          On your phone, tablet, computer, or vehicle, open this link or enter the code. Both
          devices will share every conversation live.
        </p>
        <div className="mt-5 rounded-xl bg-surface-2 p-4 text-center">
          <p className="font-mono text-3xl tracking-[0.3em] text-capella">{code ?? "······"}</p>
          {code && <p className="mt-2 break-all text-xs text-muted">{url}</p>}
          <p className="mt-2 text-xs text-muted">Expires in 10 minutes</p>
        </div>
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm">Have a code from another device?</p>
          <div className="mt-2 flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono uppercase tracking-widest outline-none focus:border-capella"
            />
            <button onClick={join} className="rounded-lg bg-capella px-4 text-sm font-medium text-background">
              Join
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-antares">{error}</p>}
        </div>
        <button onClick={onClose} className="mt-6 w-full rounded-lg border border-border py-2 text-sm hover:bg-surface-2">
          Done
        </button>
      </div>
    </div>
  );
}
