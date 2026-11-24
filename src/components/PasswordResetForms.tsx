"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StarMark } from "@/components/Logo";

const field =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 outline-none focus:border-capella";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [noEmail, setNoEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <StarMark className="mx-auto h-12 w-12" />
      <h1 className="mt-4 text-center text-2xl font-semibold">Reset your password</h1>
      {sent && noEmail ? (
        <p className="mt-6 text-center text-muted">
          Sending email isn&apos;t set up on this site yet, so no reset email will arrive. If you run this site,{" "}
          <Link href="/owner-reset" className="text-capella underline">
            use the owner reset
          </Link>{" "}
          instead.
        </p>
      ) : sent ? (
        <p className="mt-6 text-center text-muted">
          If an account uses {email}, a reset link is on its way. It works for one hour.
        </p>
      ) : (
        <form
          className="mt-8 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await fetch("/api/auth/forgot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            setBusy(false);
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              setNoEmail(data.emailConfigured === false);
              setSent(true);
            } else setError(data.error ?? "Something went wrong.");
          }}
        >
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className={field} />
          {error && <p className="text-sm text-antares">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-capella py-2.5 font-medium text-background disabled:opacity-50">
            {busy ? "Sending…" : "Email me a reset link"}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/signin" className="text-capella underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <StarMark className="mx-auto h-12 w-12" />
      <h1 className="mt-4 text-center text-2xl font-semibold">Choose a new password</h1>
      <form
        className="mt-8 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const token = new URLSearchParams(window.location.search).get("token") ?? "";
          const res = await fetch("/api/auth/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password }),
          });
          if (res.ok) return router.push("/chat");
          setBusy(false);
          setError((await res.json().catch(() => ({}))).error ?? "Something went wrong.");
        }}
      >
        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (8+ characters)" autoComplete="new-password" className={field} />
        {error && <p className="text-sm text-antares">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-capella py-2.5 font-medium text-background disabled:opacity-50">
          {busy ? "Saving…" : "Save and sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">This signs you out on your other devices.</p>
    </div>
  );
}

/** For the site owner when email isn't set up: email + OWNER_RESET_CODE -> the normal reset page. */
export function OwnerResetForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <StarMark className="mx-auto h-12 w-12" />
      <h1 className="mt-4 text-center text-2xl font-semibold">Owner password reset</h1>
      <p className="mt-3 text-center text-sm text-muted">
        For admin accounts only. Enter your admin email and the OWNER_RESET_CODE you set in Railway.
      </p>
      <form
        className="mt-8 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await fetch("/api/auth/owner-reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && typeof data.resetUrl === "string") return router.push(data.resetUrl);
          setBusy(false);
          setError(data.error ?? "Something went wrong.");
        }}
      >
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin email" autoComplete="email" className={field} />
        <input type="password" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="Owner reset code" autoComplete="off" className={field} />
        {error && <p className="text-sm text-antares">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-capella py-2.5 font-medium text-background disabled:opacity-50">
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/signin" className="text-capella underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
