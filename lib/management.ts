import { cookies } from "next/headers";
import {
  getStaffSession,
  isManagementRole,
  SHOP_SESSION_COOKIE,
} from "./shop-auth";

export async function getManagementSession() {
  if (process.env.SITE_MODE === "catalogue") return null;
  const cookieStore = await cookies();
  const session = await getStaffSession(
    cookieStore.get(SHOP_SESSION_COOKIE)?.value,
  );
  return session && isManagementRole(session.user.role) ? session : null;
}

