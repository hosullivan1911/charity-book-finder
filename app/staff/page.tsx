import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { masterShops } from "../../config/shops";
import { SHOP_SESSION_COOKIE, readShopSession } from "../../lib/shop-auth";
import { ShopLogin } from "../components/shop-login";
import { SiteHeader } from "../components/site-header";
import { StaffScanner } from "../components/staff-scanner";

export const metadata = {
  title: "Shop scanner",
  description: "Scan, value and locate donated books in seconds.",
};

export default async function StaffPage() {
  if (process.env.SITE_MODE === "catalogue") redirect("/");

  const cookieStore = await cookies();
  const session = readShopSession(cookieStore.get(SHOP_SESSION_COOKIE)?.value);
  const shop = masterShops.find((item) => item.slug === session?.shopSlug);

  return (
    <main className="staff-page">
      <SiteHeader staff />
      {shop ? <StaffScanner shop={shop} /> : <ShopLogin />}
    </main>
  );
}
