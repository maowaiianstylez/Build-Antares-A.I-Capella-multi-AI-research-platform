import Link from "next/link";
import { Wordmark } from "@/components/Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted sm:gap-5">
          <Link href="/#capabilities" className="hidden hover:text-foreground md:inline">
            Capabilities
          </Link>
          <Link href="/#sync" className="hidden hover:text-foreground md:inline">
            Sync
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/signin" className="hidden hover:text-foreground sm:inline">
            Sign in
          </Link>
          <Link
            href="/chat"
            className="rounded-full bg-capella px-4 py-1.5 font-medium text-background hover:brightness-110"
          >
            Launch Antares
          </Link>
        </div>
      </nav>
    </header>
  );
}
