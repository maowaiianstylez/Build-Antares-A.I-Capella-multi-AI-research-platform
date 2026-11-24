import type { Metadata } from "next";
import PluginsPanel from "@/components/PluginsPanel";
import { AccountTabs } from "@/components/AccountTabs";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Plugins · Rehua A.I Capella" };

export default function PluginsPage() {
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />
      <AccountTabs />
      <PluginsPanel />
    </div>
  );
}
