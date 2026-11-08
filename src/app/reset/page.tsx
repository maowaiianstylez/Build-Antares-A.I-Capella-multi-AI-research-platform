import type { Metadata } from "next";
import { ResetForm } from "@/components/PasswordResetForms";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Choose a new password · Antares A.I Capella" };

export default function Page() {
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />
      <ResetForm />
    </div>
  );
}
