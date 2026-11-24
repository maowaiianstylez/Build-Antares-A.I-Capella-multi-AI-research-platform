"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/account", label: "Account" },
  { href: "/settings", label: "Settings" },
  { href: "/plugins", label: "Plugins" },
];

/** The tab strip shared by the Account, Settings, and Plugins pages. */
export function AccountTabs() {
  const path = usePathname();
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
      <nav aria-label="Account sections" className="flex gap-1 rounded-full border border-border bg-surface/80 p-1 text-sm">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 rounded-full px-4 py-1.5 text-center ${active ? "bg-capella font-medium text-background" : "text-muted hover:text-foreground"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
