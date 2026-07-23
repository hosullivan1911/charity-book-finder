import { redirect } from "next/navigation";
import { PublicCatalogue } from "./components/public-catalogue";
import { SiteHeader } from "./components/site-header";

export default function Home() {
  if (process.env.SITE_MODE === "scanner") redirect("/staff");

  return (
    <main>
      <SiteHeader />
      <PublicCatalogue />
    </main>
  );
}
