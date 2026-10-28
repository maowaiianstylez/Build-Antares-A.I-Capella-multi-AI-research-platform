import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Sign in · Antares A.I Capella" };

export default function Page() {
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />
      <AuthForm mode="signin" />
    </div>
  );
}
