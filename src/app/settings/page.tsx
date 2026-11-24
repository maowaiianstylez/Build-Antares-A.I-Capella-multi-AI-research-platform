import type { Metadata } from "next";
import SettingsPanel from "@/components/SettingsPanel";
import { AccountTabs } from "@/components/AccountTabs";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Settings · Rehua A.I Capella" };

export default function SettingsPage() {
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />
      <AccountTabs />
      <SettingsPanel />
    </div>
  );
}
