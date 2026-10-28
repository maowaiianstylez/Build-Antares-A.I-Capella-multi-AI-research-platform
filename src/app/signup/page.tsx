import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Create account · Antares A.I Capella" };

export default function Page() {
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />
      <AuthForm mode="signup" />
    </div>
  );
}
