import { PublicCatalogue } from "./components/public-catalogue";
import { SiteHeader } from "./components/site-header";

export default function Home() {
  return (
    <main>
      <SiteHeader />
      <PublicCatalogue />
    </main>
  );
}
