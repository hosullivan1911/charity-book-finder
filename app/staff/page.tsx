import { SiteHeader } from "../components/site-header";
import { StaffScanner } from "../components/staff-scanner";

export const metadata = {
  title: "Shop scanner",
  description: "Scan, value and locate donated books in seconds.",
};

export default function StaffPage() {
  return (
    <main className="staff-page">
      <SiteHeader staff />
      <StaffScanner />
    </main>
  );
}
