import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicCatalogue } from "./components/public-catalogue";
import { SiteHeader } from "./components/site-header";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  if (process.env.SITE_MODE === "scanner") redirect("/staff");

  return (
    <main>
      <SiteHeader />
      <PublicCatalogue />
    </main>
  );
}
