"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Delete account" on the account page. Required inside the app by Apple and Google. */
export default function DeleteAccount({ paid }: { paid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push("/?deleted=1");
      return;
    }
    setError(data.error ?? "Couldn't delete your account. Please try again.");
    setBusy(false);
  }

  return (
    <section className="mt-10 rounded-2xl border border-antares/30 p-6">
      <h2 className="font-semibold">Delete account</h2>
      <p className="mt-1 text-sm text-muted">
        Permanently deletes your account, every conversation on every device, and your sign-in.
        {paid && " Your subscription is cancelled right away and you won't be charged again."} This can&rsquo;t be undone.
      </p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 rounded-full border border-antares/60 px-4 py-2 text-sm text-antares hover:bg-antares/10"
        >
          Delete my account
        </button>
      ) : (
        <form onSubmit={remove} className="mt-4 space-y-3">
          <label className="block text-sm">
            Enter your password to confirm
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2"
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1" />
            I understand my account and all my conversations will be deleted forever.
          </label>
          {error && <p className="text-sm text-antares">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!sure || !password || busy}
              className="rounded-full bg-antares px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Delete forever"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setSure(false);
                setError(null);
              }}
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <p className="mt-4 text-xs text-muted">
        Can&rsquo;t sign in? Request deletion from the <a href="/support#delete" className="underline">support page</a>.
      </p>
    </section>
  );
}
