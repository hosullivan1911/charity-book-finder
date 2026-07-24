import { redirect } from "next/navigation";
import { getManagementSession } from "../../lib/management";
import { AdminDashboard } from "../components/admin-dashboard";
import { SiteHeader } from "../components/site-header";

export const metadata = {
  title: "Management",
  description: "Manage Giveleaf shops, staff access and book inventory.",
};

export default async function AdminPage() {
  if (process.env.SITE_MODE === "catalogue") redirect("/");
  const session = await getManagementSession().catch(() => null);
  if (!session) redirect("/staff");

  return (
    <main className="admin-page">
      <SiteHeader staff />
      <AdminDashboard />
    </main>
  );
}

