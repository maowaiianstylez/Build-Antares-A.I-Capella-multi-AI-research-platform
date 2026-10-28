import Link from "next/link";
import { StarMark } from "@/components/Logo";
import { SiteHeader } from "@/components/SiteHeader";

const capabilities = [
  {
    title: "Research with evidence",
    body: "Antares searches the web, compares sources, and backs its answers with citations you can open and check.",
    icon: "🔭",
  },
  {
    title: "Advanced calculations",
    body: "From quick math to multi-step engineering and financial problems, with the working shown so you can follow it.",
    icon: "∑",
  },
  {
    title: "Programming",
    body: "Write, explain, debug, and review code in any major language. Ask for a script, get a script.",
    icon: "</>",
  },
  {
    title: "Writing and editing",
    body: "Drafts, rewrites, emails, essays, and proofreading in your voice, at the length and tone you ask for.",
    icon: "✎",
  },
  {
    title: "Video creation",
    body: "Turn an idea into a script, storyboard, and finished video content.",
    icon: "▶",
    soon: true,
  },
  {
    title: "Antares Shield",
    body: "Scans the email, social, and device accounts you approve for phishing, scams, and suspicious activity.",
    icon: "🛡",
    soon: true,
  },
];

const syncSteps = [
  {
    place: "Home",
    line: "“Antares, what time is my meeting?”",
    reply: "“Your design review is at 9:30. You have 40 minutes.”",
  },
  {
    place: "Phone",
    line: "You walk out the door. The conversation is already on your phone.",
    reply: "“Want me to text the team that you’re on the way?”",
  },
  {
    place: "Vehicle",
    line: "You start the car. Antares picks up mid-sentence.",
    reply: "“Traffic is light. You’ll arrive at 9:12.”",
  },
];

export default function Home() {
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />

      <main>
        <section className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <div className="star-glow pointer-events-none absolute top-6 -z-0 h-72 w-72 rounded-full bg-antares/20 blur-3xl" />
          <StarMark className="relative h-20 w-20" />
          <p className="relative mt-6 text-sm uppercase tracking-[0.3em] text-capella">
            Capella edition
          </p>
          <h1 className="relative mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
            One AI assistant that goes everywhere you go.
          </h1>
          <p className="relative mt-6 max-w-2xl text-lg text-muted">
            Ask Antares anything. Get researched answers backed by evidence, solve hard problems,
            write and code, then carry the same conversation from your home to your phone to your
            car without missing a beat.
          </p>
          <div className="relative mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/chat"
              className="rounded-full bg-capella px-7 py-3 font-medium text-background hover:brightness-110"
            >
              Start free
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-border px-7 py-3 font-medium hover:bg-surface"
            >
              See plans and pricing
            </Link>
          </div>
        </section>

        <section id="capabilities" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold">What Antares can do</h2>
          <p className="mt-2 text-muted">
            Built for everyday people, families, creators, and businesses.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c) => (
              <div key={c.title} className="rounded-2xl border border-border bg-surface/80 p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 font-mono text-capella">
                    {c.icon}
                  </span>
                  {c.soon && (
                    <span className="rounded-full border border-antares/40 px-2.5 py-0.5 text-xs text-antares">
                      Coming soon
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-medium">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="sync" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold">Your conversation follows you</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Link your home system, phone, tablet, computer, and vehicle once. After that, every
            device shares the same live conversation, so you never have to repeat yourself.
          </p>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {syncSteps.map((s, i) => (
              <li key={s.place} className="relative rounded-2xl border border-border bg-surface/80 p-6">
                <span className="text-xs uppercase tracking-widest text-capella">
                  {i + 1}. {s.place}
                </span>
                <p className="mt-3">{s.line}</p>
                <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-muted">
                  <span className="font-medium text-foreground">Antares: </span>
                  {s.reply}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section id="shield" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-3xl border border-antares/30 bg-gradient-to-br from-antares/10 to-surface p-8 sm:p-12">
            <span className="rounded-full border border-antares/40 px-3 py-1 text-xs text-antares">
              Coming soon
            </span>
            <h2 className="mt-4 text-3xl font-semibold">Antares Shield</h2>
            <p className="mt-3 max-w-2xl text-muted">
              Shield watches the accounts and devices you choose for phishing emails, account
              takeovers, scam messages, and suspicious logins, then tells you in plain language what
              it found and what to do. You approve each connection, you can revoke it at any time,
              and Shield never sees anything you have not shared with it.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 pt-8 text-center sm:px-6">
          <h2 className="text-3xl font-semibold">Ready when you are.</h2>
          <Link
            href="/chat"
            className="mt-6 inline-block rounded-full bg-capella px-7 py-3 font-medium text-background hover:brightness-110"
          >
            Launch Antares
          </Link>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <span>© 2026 Antares Systems</span>
          <span>Antares A.I Capella, for personal and commercial use.</span>
        </div>
      </footer>
    </div>
  );
}
