import type { Metadata } from "next";
import ShieldPanel from "@/components/ShieldPanel";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Shield · Rehua A.I Capella" };

export default function ShieldPage() {
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />
      <ShieldPanel />
    </div>
  );
}
