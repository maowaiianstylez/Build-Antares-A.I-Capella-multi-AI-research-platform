import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LEGAL_UPDATED } from "@/lib/site";

/** Shared layout for the privacy policy, terms and support pages. */
export function LegalPage({ title, children, updated = true }: { title: string; children: React.ReactNode; updated?: boolean }) {
  return (
    <div className="starfield flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {updated && <p className="mt-2 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>}
        <div className="legal mt-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
