"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { StarMark } from "@/components/Logo";
import type { PublicUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

type Source = { url: string; title: string };
type PanelEntry = { provider: string; name: string; company: string; model: string; text?: string; error?: string };
type Provider = { id: string; name: string; company: string };
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  panel?: PanelEntry[];
  modelName?: string;
  device?: string;
  streaming?: boolean;
};
type ConvoSummary = { id: string; title: string; updatedAt: number };

const POLL_MS = 1500;

function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/iPhone|Android.*Mobile/i.test(ua)) return "Phone";
  if (/CrOS|Tesla|Android Automotive/i.test(ua)) return "Vehicle";
  return "Computer";
}

export default function ChatApp() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [live, setLive] = useState(true);
  const [notice, setNotice] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [convos, setConvos] = useState<ConvoSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [research, setResearch] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [model, setModel] = useState("auto");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [device, setDevice] = useState("Computer");
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.status === 401) {
      router.push("/signin?next=/chat");
      return;
    }
    const data = await res.json();
    setUser(data.user);
    setLive(data.live);
    setProviders(data.providers ?? []);
  }, [router]);

  // Every device signed into the same account shares one conversation space.
  useEffect(() => {
    (async () => {
      await loadMe();
      setDevice(detectDevice());
    })();
  }, [loadMe]);

  const refreshConvos = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const { conversations } = await res.json();
    setConvos(conversations);
    // Follow the most recently active conversation, which is how a handoff lands on this device.
    setActiveId((cur) => cur ?? conversations[0]?.id ?? null);
  }, [user]);

  const refreshActive = useCallback(async () => {
    if (!user || !activeId || sendingRef.current) return;
    const res = await fetch(`/api/conversations/${activeId}`);
    if (!res.ok) return;
    const { conversation } = await res.json();
    if (!sendingRef.current) setMessages(conversation.messages);
  }, [user, activeId]);

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
    if (!user) return null;
    const { conversation } = await fetch("/api/conversations", { method: "POST" }).then((r) => r.json());
    setActiveId(conversation.id);
    setMessages([]);
    setSidebarOpen(false);
    await refreshConvos();
    return conversation.id as string;
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
    }
    refreshConvos();
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || !user) return;
    const convoId = activeId ?? (await newConversation());
    if (!convoId) return;

    setInput("");
    setNotice(null);
    setSending(true);
    sendingRef.current = true;
    setStatus(research ? "Starting Deep Dive…" : "Thinking…");
    const pendingId = `pending-${Date.now()}`;
    const userMsgId = `u-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: userMsgId, role: "user", text, device },
      { id: pendingId, role: "assistant", text: "", sources: [], streaming: true },
    ]);

    const patchReply = (fn: (m: Message) => Message) =>
      setMessages((all) => all.map((m) => (m.id === pendingId ? fn(m) : m)));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convoId,
          text,
          mode: research ? "research" : "chat",
          model,
          device,
        }),
      });
      if (!res.ok || !res.body) {
        // Plan limits and sign-in problems: undo the optimistic messages and explain.
        const data = await res.json().catch(() => ({}));
        setMessages((all) => all.filter((m) => m.id !== pendingId && m.id !== userMsgId));
        setInput(text);
        setNotice({ text: data.error ?? "Couldn't reach Antares. Please try again.", upgrade: data.upgrade });
        return;
      }

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
          } else if (ev.type === "panel") {
            patchReply((m) => ({ ...m, panel: [...(m.panel ?? []), ev.entry] }));
          } else if (ev.type === "model") {
            patchReply((m) => ({ ...m, modelName: ev.name }));
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
      loadMe();
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
          {user && (
            <Link
              href="/account"
              className="mt-3 flex items-center justify-between rounded-xl px-2 py-2 text-sm hover:bg-surface-2"
            >
              <span className="min-w-0">
                <span className="block truncate">{user.name}</span>
                <span className="block text-xs text-muted">
                  {PLANS[user.plan].name} · {user.usedToday}/{user.dailyLimit.toLocaleString()} today
                </span>
              </span>
              {user.plan === "free" && (
                <span className="shrink-0 rounded-full bg-capella px-2 py-0.5 text-xs font-medium text-background">
                  Upgrade
                </span>
              )}
            </Link>
          )}
          <p className="mt-1 px-2 text-xs text-muted">This device: {device}</p>
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
                <h1 className="mt-4 text-2xl font-semibold">What do you want to get to the bottom of?</h1>
                <p className="mt-2 text-sm text-muted">
                  Turn on Deep Dive and Antares asks every connected AI, checks them against real sources, and
                  gives you one answer you can trust.
                </p>
                <div className="mx-auto mt-8 grid max-w-xl gap-2 sm:grid-cols-2">
                  {[
                    "Is intermittent fasting better than calorie counting for weight loss?",
                    "Should I pay off my 6.5% mortgage early or invest the money?",
                    "Which home EV charger is worth buying in 2026?",
                    "Write a Python script that renames photos by date taken",
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
                    {m.modelName && <p className="mb-1 text-xs font-medium text-capella">{m.modelName}</p>}
                    {!!m.panel?.length && <PanelView panel={m.panel} streaming={!!m.streaming && !m.text} />}
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
          {notice && (
            <div className="mx-auto mb-3 flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-capella/40 bg-capella/10 px-4 py-2.5 text-sm">
              <span>{notice.text}</span>
              {notice.upgrade && (
                <Link href="/pricing" className="shrink-0 rounded-full bg-capella px-3 py-1 font-medium text-background">
                  See plans
                </Link>
              )}
            </div>
          )}
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
                placeholder={research ? "What should Antares research?" : "Ask Antares anything…"}
                className="max-h-48 w-full resize-none bg-transparent px-4 pt-3 outline-none placeholder:text-muted"
              />
              <div className="flex items-center justify-between gap-2 px-3 pb-2">
                <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (user && !PLANS[user.plan].research) {
                      setNotice({ text: "Deep Dive cross-checks every AI model against cited sources. It's part of Pro and Max.", upgrade: true });
                      return;
                    }
                    setResearch((r) => !r);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs ${research ? "border-capella bg-capella/15 text-capella" : "border-border text-muted"}`}
                  aria-pressed={research}
                >
                  🔭 Deep Dive {research ? "on" : "off"}
                </button>
                {!research && providers.length > 1 && (
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    aria-label="AI model"
                    className="min-w-0 rounded-full border border-border bg-surface px-2 py-1 text-xs text-muted outline-none"
                  >
                    <option value="auto">Antares Auto</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                </div>
                <button
                  type="submit"
                  disabled={sending || !user || !input.trim()}
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

      {linkOpen && <LinkDialog onClose={() => setLinkOpen(false)} />}
    </div>
  );
}

function PanelView({ panel, streaming }: { panel: PanelEntry[]; streaming: boolean }) {
  const answered = panel.filter((p) => p.text);
  return (
    <details className="mb-3 rounded-xl border border-border bg-surface/60" open={streaming}>
      <summary className="cursor-pointer select-none px-3 py-2 text-xs text-muted">
        <span className="font-medium text-foreground">Compared {answered.length} AI model{answered.length === 1 ? "" : "s"}</span>
        <span className="ml-2">{panel.map((p) => `${p.error ? "✕" : "✓"} ${p.name}`).join("  ")}</span>
      </summary>
      <div className="space-y-3 border-t border-border px-3 py-3">
        {panel.map((p) => (
          <div key={p.provider}>
            <p className="text-xs font-medium">
              {p.name} <span className="font-normal text-muted">· {p.company} · {p.model}</span>
            </p>
            {p.error ? (
              <p className="mt-1 text-xs text-antares">Didn&apos;t answer: {p.error}</p>
            ) : (
              <div className="prose-antares mt-1 text-sm text-muted">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.text ?? ""}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function LinkDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    fetch("/api/link", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        setOrigin(window.location.origin);
        setCode(d.code);
      });
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Link another device</h2>
        <p className="mt-1 text-sm text-muted">
          You can sign in with your email and password on any device. For a phone, tablet, or car where
          typing is a pain, open the sign-in page there and enter this one-time code instead.
        </p>
        <div className="mt-5 rounded-xl bg-surface-2 p-4 text-center">
          <p className="font-mono text-3xl tracking-[0.3em] text-capella">{code ?? "······"}</p>
          {origin && <p className="mt-2 break-all text-xs text-muted">{origin}/signin</p>}
          <p className="mt-2 text-xs text-muted">Works once, expires in 10 minutes</p>
        </div>
        <button onClick={onClose} className="mt-6 w-full rounded-lg border border-border py-2 text-sm hover:bg-surface-2">
          Done
        </button>
      </div>
    </div>
  );
}
