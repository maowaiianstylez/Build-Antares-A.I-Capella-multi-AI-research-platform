"use client";

import { useState } from "react";

const TOPICS = [
  ["help", "Help using Rehua"],
  ["billing", "Billing or subscription"],
  ["delete", "Delete my account (I can't sign in)"],
  ["report", "Report a harmful answer"],
  ["privacy", "Privacy or my data"],
  ["other", "Something else"],
] as const;

export default function SupportForm() {
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<string>("help");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, topic, message }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return setState("sent");
    setError(data.error ?? "Couldn't send your message. Please try again.");
    setState("idle");
  }

  if (state === "sent") {
    return (
      <p className="rounded-xl border border-capella/40 bg-capella/10 p-4 text-sm">
        Thanks, we got your message and will reply by email, usually within 2 business days.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-surface/80 p-5 not-prose">
      <label className="block text-sm">
        Your email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Topic
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2"
        >
          {TOPICS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        How can we help?
        <textarea
          required
          rows={5}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-antares">{error}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-full bg-capella px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
