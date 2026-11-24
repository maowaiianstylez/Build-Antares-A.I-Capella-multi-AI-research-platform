import type { Metadata } from "next";
import AccountPanel from "@/components/AccountPanel";
import { AccountTabs } from "@/components/AccountTabs";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Account · Rehua A.I Capella" };

export default function AccountPage() {
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />
      <AccountTabs />
      <AccountPanel />
    </div>
  );
}
