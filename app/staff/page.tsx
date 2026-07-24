import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getStaffSession,
  hasStaffUsers,
  SHOP_SESSION_COOKIE,
} from "../../lib/shop-auth";
import { ShopLogin } from "../components/shop-login";
import { SiteHeader } from "../components/site-header";
import { StaffScanner } from "../components/staff-scanner";

export const metadata = {
  title: "Shop scanner",
  description: "Scan donated books into a shop's live inventory in seconds.",
};

export default async function StaffPage() {
  if (process.env.SITE_MODE === "catalogue") redirect("/");

  const cookieStore = await cookies();
  const session = await getStaffSession(
    cookieStore.get(SHOP_SESSION_COOKIE)?.value,
  ).catch(() => null);
  const setupRequired = session ? false : !(await hasStaffUsers().catch(() => true));

  return (
    <main className="staff-page">
      <SiteHeader staff />
      {session ? (
        <StaffScanner
          shop={session.configuredShop}
          username={session.user.username}
          role={session.user.role}
        />
      ) : (
        <ShopLogin setupRequired={setupRequired} />
      )}
    </main>
  );
}
