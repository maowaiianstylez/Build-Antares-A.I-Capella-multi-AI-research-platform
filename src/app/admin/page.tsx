import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth";

// Blocks on the server so a non-admin gets a real 404 or sign-in redirect, never a partial page.
export const instant = false;

export const metadata: Metadata = { title: "Admin · Rehua A.I Capella", robots: { index: false } };

export default async function AdminPage() {
  // Checked on the server before anything renders; the API routes check again on every call.
  const user = await currentUser();
  if (!user) redirect("/signin?next=/admin");
  if (!user.isAdmin) notFound();
  return (
    <div className="starfield min-h-screen">
      <SiteHeader />
      <AdminDashboard adminId={user.id} />
    </div>
  );
}
