import type { Metadata } from "next";
import { OwnerResetForm } from "@/components/PasswordResetForms";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Owner reset · Rehua A.I Capella", robots: { index: false } };

export default function Page() {
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />
      <OwnerResetForm />
    </div>
  );
}
