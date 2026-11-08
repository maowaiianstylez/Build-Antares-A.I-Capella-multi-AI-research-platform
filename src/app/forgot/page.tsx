import type { Metadata } from "next";
import { ForgotForm } from "@/components/PasswordResetForms";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Reset password · Antares A.I Capella" };

export default function Page() {
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />
      <ForgotForm />
    </div>
  );
}
