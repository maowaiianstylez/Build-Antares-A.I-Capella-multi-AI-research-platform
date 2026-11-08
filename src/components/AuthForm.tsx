"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StarMark } from "@/components/Logo";

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/chat";
  // Only allow same-site paths so the sign-in page can't be used as an open redirect.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/chat";
}

export default function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(url: string, body: unknown, method = "POST") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push(nextPath());
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const signup = mode === "signup";

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <StarMark className="mx-auto h-12 w-12" />
      <h1 className="mt-4 text-center text-2xl font-semibold">
        {signup ? "Create your Antares account" : "Welcome back"}
      </h1>
      <form
        className="mt-8 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(signup ? "/api/auth/signup" : "/api/auth/signin", { email, password, name });
        }}
      >
        {signup && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 outline-none focus:border-capella"
          />
        )}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 outline-none focus:border-capella"
        />
        <input
          type="password"
          required
          minLength={signup ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={signup ? "Password (8+ characters)" : "Password"}
          autoComplete={signup ? "new-password" : "current-password"}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 outline-none focus:border-capella"
        />
        {!signup && (
          <p className="text-right text-xs">
            <Link href="/forgot" className="text-muted hover:text-capella">
              Forgot password?
            </Link>
          </p>
        )}
        {error && <p className="text-sm text-antares">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-capella py-2.5 font-medium text-background disabled:opacity-50"
        >
          {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {signup ? "Already have an account? " : "New to Antares? "}
        <Link href={signup ? "/signin" : "/signup"} className="text-capella underline">
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>

      {!signup && (
        <div className="mt-10 border-t border-border pt-6">
          <p className="text-sm font-medium">Signing in a phone, tablet, or car?</p>
          <p className="mt-1 text-sm text-muted">
            On a device that&apos;s already signed in, choose &ldquo;Link another device&rdquo; and enter
            the code here.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit("/api/link", { code }, "PUT");
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              aria-label="Device code"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono uppercase tracking-widest outline-none focus:border-capella"
            />
            <button disabled={busy || code.length < 6} className="rounded-lg border border-capella px-4 text-sm text-capella disabled:opacity-40">
              Use code
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
